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

export async function generatePostText(opts: {
  brandVoice: BrandVoice;
  platform: SocialPlatform;
  topic?: string;
  apiKey: string;
  model?: string;
}): Promise<string> {
  const model = opts.model ?? "claude-haiku-4-5-20251001";
  const systemPrompt = buildSystemPrompt(opts.brandVoice, opts.platform);
  const userMessage = opts.topic
    ? `Write a ${opts.platform} post about: ${opts.topic}`
    : `Write a ${opts.platform} post on one of these topics: ${opts.brandVoice.topics.join(", ") || "anything relevant to the brand"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = data.content?.find((c) => c.type === "text")?.text ?? "";
  return text.trim();
}

export async function generateImagePrompt(opts: {
  brandVoice: BrandVoice;
  postText: string;
  apiKey: string;
}): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": opts.apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      system: [
        "Generate a concise image description for an AI image generator.",
        "The image should complement a social media post.",
        "Output ONLY the image description, nothing else.",
        "Be specific about style, colors, composition. Keep it under 200 characters.",
        "Do not include any text or words in the image.",
      ].join(" "),
      messages: [
        {
          role: "user",
          content: `Brand: ${opts.brandVoice.personality}. Post: "${opts.postText}". Generate an image prompt.`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return data.content?.find((c) => c.type === "text")?.text?.trim() ?? "abstract colorful background";
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
