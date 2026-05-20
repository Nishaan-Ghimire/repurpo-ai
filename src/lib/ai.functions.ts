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

export const HOOK_STYLES = [
  "controversial",
  "curiosity",
  "storytelling",
  "authority",
  "statistical",
  "emotional",
  "bold_claim",
  "question",
] as const;
export type HookStyle = (typeof HOOK_STYLES)[number];

const HOOK_STYLE_GUIDE: Record<HookStyle, string> = {
  controversial: "Challenge conventional wisdom. Take a stance most people would push back on. No hedging.",
  curiosity: "Open an information gap. Make the reader NEED to know what comes next. Don't reveal the punchline.",
  storytelling: "Drop the reader into a specific moment, scene, or turning point. Concrete, sensory, first-person.",
  authority: "Show you've earned the right to speak — credentials, scale, track record — without sounding arrogant.",
  statistical: "Lead with a sharp, specific number or stat that reframes the topic. No vague 'studies show'.",
  emotional: "Name a feeling the reader is quietly having (frustration, fear, longing, relief). Make them feel seen.",
  bold_claim: "Make a confident, declarative statement that sounds inevitable in hindsight. No qualifiers.",
  question: "Ask a sharp question the reader has actually asked themselves. Pointed, not rhetorical fluff.",
};

const PLATFORM_HOOK_TONE: Record<string, string> = {
  twitter: "Punchy and concise. Max ~200 chars. No emojis unless essential. Earn the second line.",
  linkedin: "Professional, insight-driven. 1–2 sentences. Sounds like a smart practitioner, not a guru.",
  instagram: "Emotional, curiosity-heavy. 1 sentence. Make a thumb stop scrolling.",
  newsletter: "Authority + storytelling. Can be a subject line or first sentence. Specific, not clickbait-y.",
  tiktok: "Spoken-aloud hook for the first 3 seconds. Pattern-interrupt. Conversational.",
};

/** Generate opening-hook variations for a topic/transcript, grouped by style. */
export const generateHooks = createServerFn({ method: "POST" })
  .inputValidator((d: {
    topic: string;
    platform: string;
    styles: string[];
    perStyle?: number;
    voiceAnalysis?: Record<string, unknown> | null;
  }) =>
    z.object({
      topic: z.string().min(10).max(50000),
      platform: z.enum(["twitter", "linkedin", "instagram", "newsletter", "tiktok"]),
      styles: z.array(z.enum(HOOK_STYLES)).min(1).max(HOOK_STYLES.length),
      perStyle: z.number().int().min(3).max(5).optional(),
      voiceAnalysis: z.record(z.string(), z.any()).nullable().optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const perStyle = data.perStyle ?? 4;
    const platformTone = PLATFORM_HOOK_TONE[data.platform];
    const voiceBlock = data.voiceAnalysis
      ? `\n\nWRITER'S BRAND VOICE (mimic):\n${JSON.stringify(data.voiceAnalysis, null, 2)}\n`
      : "";

    const tools = [
      {
        type: "function",
        function: {
          name: "save_hooks",
          description: "Return generated opening hooks grouped by style.",
          parameters: {
            type: "object",
            properties: {
              hooks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    style: { type: "string", enum: [...HOOK_STYLES] },
                    text: { type: "string" },
                  },
                  required: ["style", "text"],
                  additionalProperties: false,
                },
              },
            },
            required: ["hooks"],
            additionalProperties: false,
          },
        },
      },
    ];

    const stylesBlock = data.styles
      .map((s) => `- ${s}: ${HOOK_STYLE_GUIDE[s as HookStyle]}`)
      .join("\n");

    const result = await callGemini(
      [
        {
          role: "system",
          content:
            `You are a world-class attention engineer. You write scroll-stopping opening hooks for social content. ` +
            `Hooks must be specific to the source material — no generic templates, no "in today's world", no "unlock/leverage/delve". ` +
            `Platform tone: ${platformTone}${voiceBlock}`,
        },
        {
          role: "user",
          content:
            `SOURCE MATERIAL:\n${data.topic}\n\n` +
            `Generate exactly ${perStyle} hook variations for EACH of these styles (total ${perStyle * data.styles.length}):\n${stylesBlock}\n\n` +
            `Each hook is 1–2 sentences max. Return via the save_hooks tool.`,
        },
      ],
      { tools, tool_choice: { type: "function", function: { name: "save_hooks" } } }
    );

    const call = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("Hook generation failed — no structured response.");
    const parsed = JSON.parse(call.function.arguments) as { hooks: Array<{ style: HookStyle; text: string }> };
    return { hooks: parsed.hooks };
  });

/** Generate platform-specific content from a transcript using the user's voice */
export const generateContent = createServerFn({ method: "POST" })
  .inputValidator((d: {
    transcript: string;
    platforms: string[];
    voiceAnalysis?: Record<string, unknown> | null;
    toneIntensity?: number;
    feedback?: string;
    previousText?: string;
    selectedHook?: string;
  }) =>
    z.object({
      transcript: z.string().min(20).max(50000),
      platforms: z.array(z.enum(["twitter", "linkedin", "instagram", "newsletter", "tiktok"])).min(1).max(5),
      voiceAnalysis: z.record(z.string(), z.any()).nullable().optional(),
      toneIntensity: z.number().min(1).max(10).optional(),
      feedback: z.string().max(2000).optional(),
      previousText: z.string().max(20000).optional(),
      selectedHook: z.string().max(1000).optional(),
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
    const hookBlock = data.selectedHook
      ? `\n\nREQUIRED OPENING HOOK — use this VERBATIM as the very first line, then build the rest of the post naturally from it:\n"${data.selectedHook}"\n`
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
              `${platformInstr}\n\nSOURCE TRANSCRIPT:\n${data.transcript}${hookBlock}${feedbackBlock}\n\n` +
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

export const REWRITE_STYLES = [
  "shorter",
  "longer",
  "more_professional",
  "more_casual",
  "more_aggressive",
  "more_emotional",
  "more_viral",
  "more_persuasive",
  "simpler",
  "more_storytelling",
] as const;
export type RewriteStyle = (typeof REWRITE_STYLES)[number];

const REWRITE_STYLE_GUIDE: Record<RewriteStyle, string> = {
  shorter: "Cut roughly 30–50% of the length. Keep only the strongest ideas. Tighten every sentence. Do not summarize blandly — make it sharper.",
  longer: "Expand with concrete examples, specifics, and an extra beat or two. Do NOT pad with fluff or clichés. Add real substance only.",
  more_professional: "Raise the register. Polished, credible, executive tone. No slang. Confident without being stiff.",
  more_casual: "Drop the formality. Sound like a smart friend texting. Contractions, conversational rhythm, plain words.",
  more_aggressive: "Sharper, more confrontational stance. Direct claims, no hedging, fewer qualifiers. Strong verbs.",
  more_emotional: "Lean into feeling. Name what the reader is experiencing. Vivid, human, specific moments over abstractions.",
  more_viral: "Engineer scroll-stopping appeal: punchier hook, pattern-interrupt, tighter rhythm, a quotable line. Still substantive.",
  more_persuasive: "Tighten the argument. Lead with the strongest claim, back it with proof/specifics, end with a clear takeaway.",
  simpler: "Plain language only. Short sentences. Grade-7 reading level. Remove jargon. Anyone should understand it.",
  more_storytelling: "Reframe as a story or scene. Concrete moment, tension, turn, lesson. First-person if natural.",
};

const REWRITE_PLATFORM_RULES: Record<string, string> = {
  twitter: "Preserve thread structure (numbered tweets, line breaks). Each tweet < 280 chars. Punchy.",
  linkedin: "Preserve LinkedIn structure: strong first 2 lines, short paragraphs, generous line breaks. Readable.",
  instagram: "Keep emotional, scannable cadence. Preserve hashtags at the end if present.",
  newsletter: "Preserve subject line + section structure (intro, bullets, CTA). Stay narrative.",
  tiktok: "Preserve script beats ([HOOK]/[SETUP]/[VALUE]/[CTA]). Spoken-aloud cadence.",
};

/** Rewrite a single generated content block with a style modifier, preserving platform structure. */
export const rewriteContent = createServerFn({ method: "POST" })
  .inputValidator((d: { text: string; platform: string; style: string }) =>
    z.object({
      text: z.string().min(5).max(20000),
      platform: z.enum(["twitter", "linkedin", "instagram", "newsletter", "tiktok"]),
      style: z.enum(REWRITE_STYLES),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const styleGuide = REWRITE_STYLE_GUIDE[data.style as RewriteStyle];
    const platformRule = REWRITE_PLATFORM_RULES[data.platform];

    const result = await callGemini([
      {
        role: "system",
        content:
          `You are an expert editor. Rewrite the user's post in the same brand voice, preserving the original topic, intent, ` +
          `and platform-native formatting. Do not introduce new facts. Avoid generic AI clichés ("unlock", "leverage", "delve", "in today's world"). ` +
          `Platform rules: ${platformRule}`,
      },
      {
        role: "user",
        content:
          `REWRITE GOAL: ${styleGuide}\n\n` +
          `ORIGINAL POST:\n${data.text}\n\n` +
          `Output ONLY the rewritten post — no preamble, no explanations, no "Here's...".`,
      },
    ]);

    const rewritten = result.choices?.[0]?.message?.content?.trim() ?? "";
    if (!rewritten) throw new Error("Rewrite failed — empty response.");
    return { rewritten };
  });

/** Detect the highest-potential viral moments inside a long-form transcript. */
export const detectViralMoments = createServerFn({ method: "POST" })
  .inputValidator((d: { transcript: string; max?: number }) =>
    z.object({
      transcript: z.string().min(50).max(60000),
      max: z.number().int().min(3).max(12).optional(),
    }).parse(d)
  )
  .handler(async ({ data }) => {
    const max = data.max ?? 8;

    const tools = [
      {
        type: "function",
        function: {
          name: "save_moments",
          description: "Return the most scroll-stopping, share-worthy moments inside the transcript, ranked by viral potential.",
          parameters: {
            type: "object",
            properties: {
              moments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    quote: { type: "string", description: "Direct quote or tight paraphrase from the source. 1–3 sentences." },
                    score: { type: "integer", minimum: 1, maximum: 100, description: "Viral potential 1–100." },
                    reason: { type: "string", description: "Why this moment will perform — psychological / structural reasoning." },
                    angle: { type: "string", description: "The angle to lean into (controversy, surprise, contrarian take, story turn, sharp stat, etc.)" },
                    suggested_platforms: {
                      type: "array",
                      items: { type: "string", enum: ["twitter", "linkedin", "instagram", "newsletter", "tiktok"] },
                    },
                    suggested_hook_style: {
                      type: "string",
                      enum: [...HOOK_STYLES],
                    },
                  },
                  required: ["quote", "score", "reason", "angle", "suggested_platforms", "suggested_hook_style"],
                  additionalProperties: false,
                },
              },
            },
            required: ["moments"],
            additionalProperties: false,
          },
        },
      },
    ];

    const result = await callGemini(
      [
        {
          role: "system",
          content:
            "You are a viral content analyst. You read long-form transcripts (podcasts, videos, talks, blog drafts) and identify the moments most likely to stop the scroll on social media. " +
            "Look for: sharp contrarian takes, surprising stats, vulnerable personal stories, big claims, pattern-interrupts, quotable one-liners, and emotional turns. " +
            "Avoid generic motivational filler. Score honestly — most moments are 40–70; reserve 85+ for genuinely viral material. Rank from highest to lowest score.",
        },
        {
          role: "user",
          content:
            `TRANSCRIPT:\n${data.transcript}\n\n` +
            `Return up to ${max} of the strongest viral moments via the save_moments tool. Quotes must come from the transcript (verbatim or tightly paraphrased).`,
        },
      ],
      { tools, tool_choice: { type: "function", function: { name: "save_moments" } } }
    );

    const call = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!call) throw new Error("Viral moment detection failed — no structured response.");
    const parsed = JSON.parse(call.function.arguments) as {
      moments: Array<{
        quote: string;
        score: number;
        reason: string;
        angle: string;
        suggested_platforms: string[];
        suggested_hook_style: HookStyle;
      }>;
    };
    parsed.moments.sort((a, b) => b.score - a.score);
    return { moments: parsed.moments };
  });

/** Strip HTML to readable text (lightweight, no deps). */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function detectUrlKind(url: string): "youtube" | "twitter" | "article" {
  const u = url.toLowerCase();
  if (u.includes("youtube.com/watch") || u.includes("youtu.be/")) return "youtube";
  if (u.includes("twitter.com/") || u.includes("x.com/")) return "twitter";
  return "article";
}

async function fetchYoutubeTranscript(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].replace(/ - YouTube$/, "").trim() : "YouTube video";

    // Extract captionTracks from ytInitialPlayerResponse
    const playerMatch = html.match(/"captionTracks":(\[.*?\])/);
    if (!playerMatch) return { title, text: "" };
    const tracks = JSON.parse(playerMatch[1].replace(/\\u0026/g, "&")) as Array<{ baseUrl: string; languageCode: string }>;
    const track = tracks.find((t) => t.languageCode?.startsWith("en")) ?? tracks[0];
    if (!track) return { title, text: "" };

    const capRes = await fetch(track.baseUrl);
    if (!capRes.ok) return { title, text: "" };
    const xml = await capRes.text();
    const text = xml
      .replace(/<\/?text[^>]*>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
    return { title, text };
  } catch {
    return null;
  }
}

/** Import readable content from a URL (YouTube transcript, blog article, X thread). */
export const importFromUrl = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) =>
    z.object({ url: z.string().url().max(2000) }).parse(d)
  )
  .handler(async ({ data }) => {
    const kind = detectUrlKind(data.url);

    if (kind === "youtube") {
      const yt = await fetchYoutubeTranscript(data.url);
      if (yt && yt.text && yt.text.length > 40) {
        return { kind, title: yt.title, content: yt.text, sourceUrl: data.url };
      }
      throw new Error(
        "Couldn't fetch a transcript for this YouTube video (it may have captions disabled). Try pasting the transcript directly."
      );
    }

    // Generic article / Twitter — fetch & strip
    const res = await fetch(data.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RepurpoBot/1.0)",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`Could not fetch URL (${res.status}).`);
    const html = await res.text();
    if (html.length > 2_000_000) throw new Error("Page too large to import.");

    const titleMatch =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i) ||
      html.match(/<title>([^<]+)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1].trim() : "Imported content";

    const rawText = htmlToText(html);
    if (rawText.length < 200) throw new Error("Couldn't extract enough readable content from this URL.");

    // Use Gemini to extract the main article body, dropping nav/footer/ads
    const truncated = rawText.slice(0, 30000);
    const result = await callGemini([
      {
        role: "system",
        content:
          "You are a content extractor. Given raw page text (with nav, footers, ads, and unrelated chrome mixed in), return ONLY the main article/post body as clean plain text. Preserve paragraphs and natural line breaks. No commentary, no markdown headers like 'Article:', no preamble.",
      },
      {
        role: "user",
        content: `URL: ${data.url}\nKIND: ${kind}\n\nRAW PAGE TEXT:\n${truncated}`,
      },
    ]);
    const content = result.choices?.[0]?.message?.content?.trim() ?? "";
    if (!content || content.length < 100) throw new Error("Couldn't extract meaningful content from this URL.");

    return { kind, title: rawTitle.slice(0, 200), content, sourceUrl: data.url };
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
