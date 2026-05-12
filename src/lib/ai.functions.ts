import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callGemini(messages: Array<{ role: string; content: string }>, opts?: { tools?: any; tool_choice?: any }) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY not configured");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages, ...(opts ?? {}) }),
  });

  if (res.status === 429) throw new Error("Rate limit exceeded — please try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted — add credits in Workspace Settings → Usage.");
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI gateway error (${res.status}): ${t.slice(0, 200)}`);
  }
  return res.json();
}

/** Analyze user's writing examples and return structured voice profile */
export const analyzeVoice = createServerFn({ method: "POST" })
  .inputValidator((d: { examples: string }) => z.object({ examples: z.string().min(20).max(20000) }).parse(d))
  .handler(async ({ data }) => {
    const tools = [
      {
        type: "function",
        function: {
          name: "save_voice_profile",
          description: "Save a structured analysis of the writer's brand voice.",
          parameters: {
            type: "object",
            properties: {
              tone: { type: "string", description: "e.g. confident, witty, warm, authoritative" },
              humor_level: { type: "string", enum: ["none", "subtle", "moderate", "high"] },
              sentence_length: { type: "string", enum: ["short", "medium", "long", "varied"] },
              formatting_style: { type: "string", description: "use of lists, line breaks, emphasis" },
              hook_style: { type: "string", description: "how they open posts" },
              cta_style: { type: "string", description: "how they close / call to action" },
              emoji_usage: { type: "string", enum: ["none", "rare", "moderate", "heavy"] },
              vocabulary_patterns: { type: "array", items: { type: "string" }, description: "signature phrases or words" },
              summary: { type: "string", description: "one paragraph describing the voice" },
            },
            required: ["tone", "humor_level", "sentence_length", "formatting_style", "hook_style", "cta_style", "emoji_usage", "vocabulary_patterns", "summary"],
            additionalProperties: false,
          },
        },
      },
    ];

    const result = await callGemini(
      [
        { role: "system", content: "You analyze a writer's samples and return a structured brand voice profile. Be concrete and specific." },
        { role: "user", content: `Analyze these writing samples and produce a brand voice profile:\n\n${data.examples}` },
      ],
      { tools, tool_choice: { type: "function", function: { name: "save_voice_profile" } } }
    );

    const call = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("Voice analysis failed — no structured response.");
    const analysis = JSON.parse(call.function.arguments);
    return { analysis };
  });

const PLATFORM_PROMPTS: Record<string, string> = {
  twitter: "Write a Twitter/X thread (5-8 tweets). Each tweet under 280 chars. Use line breaks within tweets. Number them (1/, 2/...). Strong hook tweet, then valuable points, end with a memorable line.",
  linkedin: "Write a LinkedIn post (~150-250 words). Storytelling/authority style. Hook in first 2 lines (before the 'see more' cut). Short paragraphs, generous line breaks. End with a question or insight.",
  instagram: "Write an Instagram caption (~120-180 words). Hook in first sentence, then break into short scannable lines. Light emoji use. End with engagement question and 5-8 relevant hashtags.",
  newsletter: "Write a concise newsletter summary (~250-350 words). Subject line first, then a tight intro, 3 bullet takeaways, and a closing CTA line.",
  tiktok: "Write a TikTok/Reels script (30-60 sec). Format: [HOOK 0-3s], [SETUP 3-10s], [VALUE 10-45s with beats], [CTA 45-60s]. Conversational, punchy.",
};

/** Generate platform-specific content from a transcript using the user's voice */
export const generateContent = createServerFn({ method: "POST" })
  .inputValidator((d: {
    transcript: string;
    platforms: string[];
    voiceAnalysis?: Record<string, unknown> | null;
    toneIntensity?: number;
    feedback?: string;
    previousText?: string;
  }) =>
    z.object({
      transcript: z.string().min(20).max(50000),
      platforms: z.array(z.enum(["twitter", "linkedin", "instagram", "newsletter", "tiktok"])).min(1).max(5),
      voiceAnalysis: z.record(z.string(), z.any()).nullable().optional(),
      toneIntensity: z.number().min(1).max(10).optional(),
      feedback: z.string().max(2000).optional(),
      previousText: z.string().max(20000).optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const voiceBlock = data.voiceAnalysis
      ? `\n\nWRITER'S BRAND VOICE PROFILE (mimic exactly):\n${JSON.stringify(data.voiceAnalysis, null, 2)}\n`
      : "";
    const intensity = data.toneIntensity ?? 6;
    const feedbackBlock = data.feedback
      ? `\n\nUSER FEEDBACK ON PREVIOUS DRAFT (apply these changes):\n"${data.feedback}"\n${data.previousText ? `\nPREVIOUS DRAFT FOR REFERENCE:\n${data.previousText}\n` : ""}`
      : "";

    const outputs: Record<string, string> = {};

    await Promise.all(
      data.platforms.map(async (platform) => {
        const platformInstr = PLATFORM_PROMPTS[platform];
        const result = await callGemini([
          {
            role: "system",
            content:
              `You are an expert content repurposer. Produce platform-native content that does NOT sound like generic AI writing. ` +
              `Avoid clichés (e.g. "in today's fast-paced world", "unlock", "leverage", "delve"). ` +
              `Match the writer's voice. Tone intensity: ${intensity}/10 (higher = more bold/punchy).${voiceBlock}`,
          },
          {
            role: "user",
            content:
              `${platformInstr}\n\nSOURCE TRANSCRIPT:\n${data.transcript}${feedbackBlock}\n\n` +
              `Output ONLY the final content — no preamble, no explanations, no "Here's your...".`,
          },
        ]);
        outputs[platform] = result.choices?.[0]?.message?.content?.trim() ?? "";
      })
    );

    return { outputs };
  });

/** Generate a single sample post in the writer's voice from dummy text — used by "Test Voice". */
export const testVoice = createServerFn({ method: "POST" })
  .inputValidator((d: { voiceAnalysis: Record<string, unknown> }) =>
    z.object({ voiceAnalysis: z.record(z.string(), z.any()) }).parse(d)
  )
  .handler(async ({ data }) => {
    const dummyTopic =
      "Most creators publish too much and reflect too little. The compounding wins come from one good idea published consistently — not ten mediocre ones.";
    const result = await callGemini([
      {
        role: "system",
        content:
          `You are an expert ghostwriter. Mimic this brand voice EXACTLY (tone, hooks, formatting, emoji usage, vocabulary). ` +
          `Profile:\n${JSON.stringify(data.voiceAnalysis, null, 2)}`,
      },
      {
        role: "user",
        content:
          `Write ONE short LinkedIn-style post (90-130 words) about this idea:\n\n"${dummyTopic}"\n\n` +
          `Output only the post, no preamble.`,
      },
    ]);
    const sample = result.choices?.[0]?.message?.content?.trim() ?? "";
    if (!sample) throw new Error("Could not generate a sample.");
    return { sample };
  });

/** Transcribe audio/video using Google Chirp 3 (Speech-to-Text v2) */
export const transcribeAudio = createServerFn({ method: "POST" })
  .inputValidator((d: { signedUrl: string; mimeType: string }) =>
    z.object({ signedUrl: z.string().url(), mimeType: z.string().min(1).max(100) }).parse(d)
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
    if (!apiKey) throw new Error("GOOGLE_CLOUD_API_KEY is not configured");

    // Fetch the file and base64-encode for inline STT request
    const fileRes = await fetch(data.signedUrl);
    if (!fileRes.ok) throw new Error(`Could not fetch file (${fileRes.status})`);
    const buf = new Uint8Array(await fileRes.arrayBuffer());

    if (buf.byteLength > 9 * 1024 * 1024) {
      throw new Error("File too large for inline transcription (max ~9MB). Try a shorter clip.");
    }

    // Base64
    let bin = "";
    for (let i = 0; i < buf.byteLength; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);

    // Use Speech-to-Text v2 with chirp_2 model (Chirp 3-class universal model)
    const url = `https://speech.googleapis.com/v2/projects/-/locations/global/recognizers/_:recognize?key=${apiKey}`;
    const body = {
      config: {
        autoDecodingConfig: {},
        model: "chirp_2",
        languageCodes: ["en-US"],
      },
      content: b64,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Transcription failed (${res.status}): ${t.slice(0, 300)}`);
    }
    const json = await res.json();
    const transcript =
      (json.results ?? [])
        .map((r: any) => r.alternatives?.[0]?.transcript ?? "")
        .join(" ")
        .trim();

    if (!transcript) throw new Error("No speech detected in the file.");
    return { transcript };
  });
