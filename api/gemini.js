// ============================================================
// AIRupee Finance AI — API Route (Vercel Serverless)
// Supports: Gemini (free, PDFs + images), Groq (free, text + vision),
//            Claude (paid, best quality)
// ============================================================

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── GROQ ────────────────────────────────────────────────────
// Free tier, fast. Llama 4 Scout/Maverick support vision (images).
// PDFs must be converted to images first.
async function callGroq(prompt, systemPrompt, premium = false, imageFile = null) {
  const messages = [
    {
      role: "system",
      content: premium
        ? `${systemPrompt}\n\nRespond with extra care and polish: be precise, well-structured, and thorough — this is a premium-tier request.`
        : systemPrompt,
    },
  ];

  // If image file provided, use vision-capable model
  if (imageFile) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: prompt },
        {
          type: "image_url",
          image_url: {
            url: `data:${imageFile.mediaType};base64,${imageFile.data}`,
          },
        },
      ],
    });
  } else {
    messages.push({ role: "user", content: prompt });
  }

  // Use vision model if image provided, else fast text model
  const model = imageFile
    ? "meta-llama/llama-4-scout-17b-16e-instruct"  // vision-capable
    : "llama-3.3-70b-versatile";                     // fast text-only

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: premium ? 1200 : 600,
      temperature: premium ? 0.4 : 0.7,
      messages,
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

// ── GEMINI ──────────────────────────────────────────────────
// Free tier, native PDF + image support. Best free option.
// Valid models: gemini-1.5-flash, gemini-1.5-flash-latest, gemini-2.0-flash
async function callGemini(prompt, systemPrompt, file) {
  const parts = [{ text: `${systemPrompt}\n\n${prompt}` }];

  if (file) {
    parts.unshift({
      inlineData: {
        mimeType: file.mediaType,
        data: file.data, // base64, NO data: prefix
      },
    });
    console.log("[Gemini] Sending file:", file.mediaType, "| base64 length:", file.data.length);
  }

  // ✅ FIXED: Use valid model name
  const MODEL_NAME = "gemini-3.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  console.log("[Gemini] Calling model:", MODEL_NAME);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        maxOutputTokens: file ? 1200 : 600,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("[Gemini] HTTP error:", response.status, errBody);
    return { status: response.status, text: null, error: errBody };
  }

  const data = await response.json();

  // Check for blocked content / safety issues
  if (data.promptFeedback?.blockReason) {
    console.error("[Gemini] Blocked:", data.promptFeedback.blockReason);
    return { status: 200, text: null, error: `Blocked: ${data.promptFeedback.blockReason}` };
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  return { status: 200, text };
}

// ── CLAUDE ──────────────────────────────────────────────────
// Paid tier — best quality, native PDF + image support.
async function callClaude(prompt, systemPrompt, file) {
  const content = [];

  if (file) {
    const isPdf = file.mediaType === "application/pdf";
    content.push({
      type: isPdf ? "document" : "image",
      source: {
        type: "base64",
        media_type: file.mediaType,
        data: file.data,
      },
    });
  }

  content.push({ type: "text", text: prompt });

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
      messages: [{ role: "user", content }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error("[Claude] HTTP error:", response.status, errBody);
    return null;
  }

  const data = await response.json();
  return data.content?.[0]?.text || null;
}

// ── PDF → IMAGE CONVERSION (for Groq vision fallback) ───────
// Converts PDF pages to PNG images using pdf-lib + canvas
// Returns array of { mediaType, data } objects
async function convertPdfToImages(pdfBase64) {
  try {
    // This requires: npm install pdf-lib canvas
    // For serverless (Vercel), use a lighter approach or pre-convert on client
    console.log("[PDF→Image] Conversion requested — recommend client-side or use Gemini/Claude instead");
    return null; // Placeholder — see note below
  } catch (e) {
    console.error("[PDF→Image] Conversion failed:", e);
    return null;
  }
}

// ── MAIN HANDLER ────────────────────────────────────────────
export default async function handler(req, res) {
  // CORS headers (Vercel handles this, but good for safety)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, systemPrompt, useClaude, file } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  console.log("[Handler] Request received | Claude:", !!useClaude, "| File:", !!file, "| File type:", file?.mediaType);

  try {
    // ═══════════════════════════════════════════════════════
    // PREMIUM TIER: Claude first
    // ═══════════════════════════════════════════════════════
    if (useClaude) {
      if (process.env.ANTHROPIC_API_KEY) {
        const text = await callClaude(prompt, systemPrompt, file);
        if (text) {
          console.log("[Handler] Claude succeeded (premium)");
          return res.status(200).json({ text, provider: "claude" });
        }
      } else {
        console.warn("[Handler] ANTHROPIC_API_KEY not set — falling back");
      }

      // Claude failed or no key — try Gemini for file requests
      if (file) {
        const geminiResult = await callGemini(prompt, systemPrompt, file);
        if (geminiResult.text) {
          console.log("[Handler] Gemini succeeded (premium fallback)");
          return res.status(200).json({ text: geminiResult.text, provider: "gemini" });
        }
        return res.status(200).json({
          text: "Document analysis needs Claude or Gemini access, and both are temporarily unavailable. Please try again shortly, or paste the key details as text instead.",
          provider: "none",
        });
      }

      // No file — safe to fall back to Groq (premium tuned)
      const groqText = await callGroq(prompt, systemPrompt, true);
      if (groqText) {
        console.log("[Handler] Groq succeeded (premium text fallback)");
        return res.status(200).json({ text: groqText, provider: "groq" });
      }

      return res.status(200).json({ text: "Sorry, please try again in a moment.", provider: "none" });
    }

    // ═══════════════════════════════════════════════════════
    // FREE TIER: Gemini first, with retry on 429
    // ═══════════════════════════════════════════════════════
    let result = await callGemini(prompt, systemPrompt, file);

    // Retry once on rate limit (429)
    if (result.status === 429) {
      console.log("[Handler] Gemini 429 — retrying after 1.2s");
      await sleep(1200);
      result = await callGemini(prompt, systemPrompt, file);
    }

    if (result.text) {
      console.log("[Handler] Gemini succeeded (free tier)");
      return res.status(200).json({ text: result.text, provider: "gemini" });
    }

    // Gemini failed — log why
    console.error("[Handler] Gemini failed:", result.status, result.error || "No text returned");

    // If there's a file, we need a vision-capable fallback
    if (file) {
      // Option 1: Try Groq with vision (if image, not PDF)
      // Groq Llama 4 Scout/Maverick can read images but NOT raw PDFs
      const isPdf = file.mediaType === "application/pdf";

      if (!isPdf) {
        // It's an image — Groq can handle it
        console.log("[Handler] Trying Groq vision for image...");
        const groqVision = await callGroq(prompt, systemPrompt, false, file);
        if (groqVision) {
          return res.status(200).json({ text: groqVision, provider: "groq" });
        }
      }

      // No working fallback for files
      return res.status(200).json({
        text: "Document analysis is temporarily unavailable — please try again in a moment, or paste the key details as text instead.",
        provider: "none",
        debug: process.env.NODE_ENV === "development" ? { geminiError: result.error } : undefined,
      });
    }

    // No file — safe to fall back to Groq text
    console.log("[Handler] Trying Groq text fallback...");
    const groqText = await callGroq(prompt, systemPrompt, false);
    if (groqText) {
      return res.status(200).json({ text: groqText, provider: "groq" });
    }

    return res.status(200).json({ text: "Sorry, please try again in a moment.", provider: "none" });

  } catch (error) {
    console.error("[Handler] Unhandled error:", error);
    return res.status(500).json({ text: "Connection error. Please try again.", provider: "none" });
  }
}
