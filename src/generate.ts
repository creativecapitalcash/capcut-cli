import { createWriteStream } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { imagesDir, uuid } from "./store.js";
import type { BrandVoice, SocialPlatform } from "./types.js";
import { PLATFORM_LABELS, PLATFORM_LIMITS } from "./types.js";

function buildSystemPrompt(voice: BrandVoice, platform: SocialPlatform): string {
  const limit = PLATFORM_LIMITS[platform];
  const lines = [
    `You are a social media content creator writing for ${PLATFORM_LABELS[platform]}.`,
    `Character limit: ${limit} characters.`,
    ``,
    `Brand voice:`,
    `- Tone: ${voice.tone}`,
    `- Target audience: ${voice.audience}`,
    `- Style: ${voice.style}`,
    `- Personality: ${voice.personality}`,
  ];
  if (voice.topics.length > 0) lines.push(`- Key topics: ${voice.topics.join(", ")}`);
  if (voice.dos.length > 0) lines.push(`- Always: ${voice.dos.join("; ")}`);
  if (voice.donts.length > 0) lines.push(`- Never: ${voice.donts.join("; ")}`);
  if (voice.hashtags.length > 0) lines.push(`- Include relevant hashtags from: ${voice.hashtags.join(" ")}`);
  lines.push(
    ``,
    `Write a single post. Output ONLY the post text, no explanations, no quotes around it.`,
    `Stay within the ${limit}-character limit.`,
  );
  return lines.join("\n");
}

const DEFAULT_MODEL = "anthropic/claude-haiku-4-5-20251001";

async function callOpenRouter(opts: {
  apiKey: string;
  model: string;
  system: string;
  userMessage: string;
  maxTokens: number;
}): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${opts.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function generatePostText(opts: {
  brandVoice: BrandVoice;
  platform: SocialPlatform;
  topic?: string;
  apiKey: string;
  model?: string;
}): Promise<string> {
  const model = opts.model ?? DEFAULT_MODEL;
  const systemPrompt = buildSystemPrompt(opts.brandVoice, opts.platform);
  const userMessage = opts.topic
    ? `Write a ${opts.platform} post about: ${opts.topic}`
    : `Write a ${opts.platform} post on one of these topics: ${opts.brandVoice.topics.join(", ") || "anything relevant to the brand"}`;

  return callOpenRouter({ apiKey: opts.apiKey, model, system: systemPrompt, userMessage, maxTokens: 1024 });
}

export async function generateImagePrompt(opts: {
  brandVoice: BrandVoice;
  postText: string;
  apiKey: string;
}): Promise<string> {
  const system = [
    "Generate a concise image description for an AI image generator.",
    "The image should complement a social media post.",
    "Output ONLY the image description, nothing else.",
    "Be specific about style, colors, composition. Keep it under 200 characters.",
    "Do not include any text or words in the image.",
  ].join(" ");
  const userMessage = `Brand: ${opts.brandVoice.personality}. Post: "${opts.postText}". Generate an image prompt.`;

  const text = await callOpenRouter({ apiKey: opts.apiKey, model: DEFAULT_MODEL, system, userMessage, maxTokens: 256 });
  return text || "abstract colorful background";
}

export async function generateImage(opts: { prompt: string; width?: number; height?: number }): Promise<string> {
  const w = opts.width ?? 1080;
  const h = opts.height ?? 1080;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(opts.prompt)}?width=${w}&height=${h}&nologo=true`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Pollinations.ai ${res.status}: image generation failed`);
  }

  const fileName = `${uuid()}.jpg`;
  const outPath = join(imagesDir(), fileName);
  const body = res.body;
  if (!body) throw new Error("Empty response from image API");

  const nodeStream = Readable.fromWeb(body as import("node:stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(outPath));
  return outPath;
}

export function platformImageDimensions(platform: SocialPlatform): { width: number; height: number } {
  switch (platform) {
    case "twitter":
      return { width: 1200, height: 675 };
    case "instagram":
      return { width: 1080, height: 1080 };
    case "linkedin":
      return { width: 1200, height: 627 };
    case "facebook":
      return { width: 1200, height: 630 };
  }
}
