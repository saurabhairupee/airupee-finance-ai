// Small helper: pause for `ms` milliseconds (used before retrying Gemini once)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Groq call — OpenAI-compatible chat completions API, free tier, high rate limits.
// `premium` slightly raises max_tokens and lowers temperature for a more
// polished, careful tone on Pro/Firm tier requests.
async function callGroq(prompt, systemPrompt, premium = false) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: premium ? 1200 : 600,
      temperature: premium ? 0.4 : 0.7,
      messages: [
        {
          role: "system",
          content: premium
            ? `${systemPrompt}\n\nRespond with extra care and polish: be precise, well-structured, and thorough — this is a premium-tier request.`
            : systemPrompt,
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("Groq error:", response.status, errBody);
    return null;
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || null;
}

// Gemini call, returns { text, status } so the caller can detect 429s
async function callGemini(prompt, systemPrompt) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${systemPrompt}\n\n${prompt}` }] }],
        generationConfig: { maxOutputTokens: 600 },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    console.error("Gemini error:", response.status, errBody);
    return { status: response.status, text: null };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  return { status: 200, text };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, systemPrompt, useClaude } = req.body;

  try {
    if (useClaude) {
      // Pro & Firm tier — try Claude Sonnet first if a key is configured.
      // Falls back to Groq (premium-tuned) if no key is set or Claude errors,
      // so the tier never hard-fails just because Anthropic billing isn't set up yet.
      if (process.env.ANTHROPIC_API_KEY) {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1200,
            system: systemPrompt,
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const text = data.content?.[0]?.text;
          if (text) return res.status(200).json({ text });
        } else {
          const errBody = await response.text();
          console.error("Claude error:", response.status, errBody);
        }
      } else {
        console.warn("ANTHROPIC_API_KEY not set — routing premium request to Groq.");
      }

      // Fallback: Groq, premium-tuned
      const groqText = await callGroq(prompt, systemPrompt, true);
      if (groqText) {
        return res.status(200).json({ text: groqText });
      }

      return res.status(200).json({ text: "Sorry, please try again in a moment." });
    } else {
      // Free, Starter & Pay-once tier — Gemini Flash, with one retry
      // then a Groq (standard) fallback if Gemini is out of quota.
      let result = await callGemini(prompt, systemPrompt);

      if (result.status === 429) {
        await sleep(1200);
        result = await callGemini(prompt, systemPrompt);
      }

      if (result.text) {
        return res.status(200).json({ text: result.text });
      }

      const groqText = await callGroq(prompt, systemPrompt, false);
      if (groqText) {
        return res.status(200).json({ text: groqText });
      }

      return res.status(200).json({ text: "Sorry, please try again in a moment." });
    }
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ text: "Connection error. Please try again." });
  }
}
