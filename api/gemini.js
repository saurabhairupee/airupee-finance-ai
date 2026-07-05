// Small helper: pause for `ms` milliseconds (used before retrying Gemini once)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Groq fallback — OpenAI-compatible chat completions API, free tier,
// high rate limits. Used when Gemini is out of quota (429).
async function callGroq(prompt, systemPrompt) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 600,
      messages: [
        { role: "system", content: systemPrompt },
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
      // Pro & Firm tier — Claude Sonnet
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

      if (!response.ok) {
        const errBody = await response.text();
        console.error("Claude error:", response.status, errBody);
        return res.status(200).json({ text: "Sorry, please try again in a moment." });
      }

      const data = await response.json();
      const text = data.content?.[0]?.text || "Sorry, please try again.";
      return res.status(200).json({ text });
    } else {
      // Free, Starter & Pay-once tier — Gemini Flash, with one retry
      // then a Groq (Llama 3.3) fallback if Gemini is out of quota.
      let result = await callGemini(prompt, systemPrompt);

      if (result.status === 429) {
        await sleep(1200);
        result = await callGemini(prompt, systemPrompt);
      }

      if (result.text) {
        return res.status(200).json({ text: result.text });
      }

      // Gemini still failing (quota or otherwise) — fall back to Groq
      const groqText = await callGroq(prompt, systemPrompt);
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
