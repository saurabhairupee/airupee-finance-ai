// Small helper: pause for `ms` milliseconds (used before retrying Gemini once)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Groq call — OpenAI-compatible chat completions API, free tier, high rate limits.
// NOTE: Groq's Llama models here are text-only — they cannot read an uploaded
// PDF/image, so this is only ever called when there's no file attached.
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

// Gemini call — supports an optional single { mediaType, data } file, OR a
// `files` array of { label, mediaType, data } for multi-document tools.
// Returns { text, status } so the caller can detect 429s.
async function callGemini(prompt, systemPrompt, file, files) {
  const parts = [];
  if (files && files.length > 0) {
    for (const f of files) {
      parts.push({ text: `The following document is: ${f.label}` });
      parts.push({ inlineData: { mimeType: f.mediaType, data: f.data } });
    }
  } else if (file) {
    parts.push({ inlineData: { mimeType: file.mediaType, data: file.data } });
  }
  parts.push({ text: `${systemPrompt}\n\n${prompt}` });

  const hasAnyFile = file || (files && files.length > 0);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { maxOutputTokens: hasAnyFile ? 3000 : 800 },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text();
    console.error("Gemini error:", response.status, errBody);
    return { status: response.status, text: null };
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  console.log("Gemini finishReason:", candidate?.finishReason, "| parts:", candidate?.content?.parts?.length);

  // Concatenate ALL text parts — reading only parts[0] can silently drop
  // the rest of the answer if Gemini splits the response into multiple parts.
  const text = (candidate?.content?.parts || [])
    .map(p => p.text || "")
    .join("")
    .trim() || null;

  return { status: 200, text };
}

// Claude call — supports an optional single { mediaType, data } file, OR a
// `files` array of { label, mediaType, data } for multi-document tools.
async function callClaude(prompt, systemPrompt, file, files) {
  const content = [];
  if (files && files.length > 0) {
    for (const f of files) {
      const isPdf = f.mediaType === "application/pdf";
      content.push({ type: "text", text: `The following document is: ${f.label}` });
      content.push({
        type: isPdf ? "document" : "image",
        source: { type: "base64", media_type: f.mediaType, data: f.data },
      });
    }
  } else if (file) {
    const isPdf = file.mediaType === "application/pdf";
    content.push({
      type: isPdf ? "document" : "image",
      source: { type: "base64", media_type: file.mediaType, data: file.data },
    });
  }
  content.push({ type: "text", text: prompt });

  const hasAnyFile = file || (files && files.length > 0);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: hasAnyFile ? 3000 : 1200,
      system: systemPrompt,
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("Claude error:", response.status, errBody);
    return null;
  }

  const data = await response.json();
  console.log("Claude stop_reason:", data.stop_reason, "| blocks:", data.content?.length);

  // Concatenate ALL text blocks — reading only content[0] can silently
  // drop part of the answer if Claude returns it as multiple blocks.
  const text = (data.content || [])
    .filter(block => block.type === "text")
    .map(block => block.text)
    .join("\n");

  return text || null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, systemPrompt, useClaude, file, files } = req.body;
  const hasAnyFile = file || (files && files.length > 0);

  try {
    if (useClaude) {
      // Pro & Firm tier — try Claude Sonnet first if a key is configured
      // (Claude can read the uploaded PDF/image directly).
      if (process.env.ANTHROPIC_API_KEY) {
        const text = await callClaude(prompt, systemPrompt, file, files);
        if (text) return res.status(200).json({ text });
      } else {
        console.warn("ANTHROPIC_API_KEY not set — routing premium request to fallback.");
      }

      // No Claude available. If there's an attached file, Groq can't read
      // it (text-only model) — try Gemini instead, since it can handle files.
      if (hasAnyFile) {
        const geminiResult = await callGemini(prompt, systemPrompt, file, files);
        if (geminiResult.text) return res.status(200).json({ text: geminiResult.text });
        return res.status(200).json({
          text: "Document analysis needs Claude or Gemini access, and both are temporarily unavailable. Please try again shortly, or paste the key details as text instead.",
        });
      }

      // No file — safe to fall back to Groq (premium-tuned)
      const groqText = await callGroq(prompt, systemPrompt, true);
      if (groqText) return res.status(200).json({ text: groqText });

      return res.status(200).json({ text: "Sorry, please try again in a moment." });
    } else {
      // Free, Starter & Pay-once tier — Gemini Flash (handles files too),
      // with one retry on 429, then a Groq fallback for TEXT-ONLY requests.
      let result = await callGemini(prompt, systemPrompt, file, files);

      if (result.status === 429) {
        await sleep(1200);
        result = await callGemini(prompt, systemPrompt, file, files);
      }

      if (result.text) {
        return res.status(200).json({ text: result.text });
      }

      if (hasAnyFile) {
        // Groq can't read files — no safe fallback here, be upfront about it.
        return res.status(200).json({
          text: "Document analysis is temporarily unavailable — please try again in a moment, or paste the key details as text instead.",
        });
      }

      const groqText = await callGroq(prompt, systemPrompt, false);
      if (groqText) return res.status(200).json({ text: groqText });

      return res.status(200).json({ text: "Sorry, please try again in a moment." });
    }
  } catch (error) {
    console.error("Handler error:", error);
    return res.status(500).json({ text: "Connection error. Please try again." });
  }
}
