import { createInterface } from "node:readline/promises";
import type { BrandVoice, SocialPlatform } from "./types.js";
import { ALL_PLATFORMS, PLATFORM_LABELS } from "./types.js";

async function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  const answer = await rl.question(`  ${question} `);
  return answer.trim();
}

function splitComma(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export async function runBrandInterview(): Promise<BrandVoice> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });

  process.stderr.write("\n--- Brand Voice Interview ---\n");
  process.stderr.write("Answer each question to establish your brand's content style.\n\n");

  const tone = await ask(rl, "What is your brand's tone? (e.g., professional, casual, witty, bold):");
  const audience = await ask(rl, "Who is your target audience? (e.g., entrepreneurs, creators, tech professionals):");
  const style = await ask(rl, "What content style? (educational, entertaining, promotional, inspirational, mix):");
  const topicsRaw = await ask(rl, "List 3-5 key topics you post about (comma-separated):");
  const hashtagsRaw = await ask(rl, "Default hashtags to include (comma-separated, or 'none'):");
  const personality = await ask(rl, "Describe your brand personality in one sentence:");
  const dosRaw = await ask(rl, "Content dos — things you always want (comma-separated, or 'none'):");
  const dontsRaw = await ask(rl, "Content don'ts — things to avoid (comma-separated, or 'none'):");

  rl.close();

  return {
    tone: tone || "professional",
    audience: audience || "general audience",
    style: style || "educational",
    topics: splitComma(topicsRaw),
    hashtags: hashtagsRaw.toLowerCase() === "none" ? [] : splitComma(hashtagsRaw),
    personality: personality || "knowledgeable and approachable",
    dos: dosRaw.toLowerCase() === "none" ? [] : splitComma(dosRaw),
    donts: dontsRaw.toLowerCase() === "none" ? [] : splitComma(dontsRaw),
  };
}

export async function choosePlatforms(): Promise<SocialPlatform[]> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });

  process.stderr.write("\n--- Platform Selection ---\n");
  for (let i = 0; i < ALL_PLATFORMS.length; i++) {
    process.stderr.write(`  ${i + 1}. ${PLATFORM_LABELS[ALL_PLATFORMS[i]]}\n`);
  }
  const answer = await ask(rl, "Which platforms? (numbers comma-separated, e.g., 1,2,3):");
  rl.close();

  const indices = splitComma(answer)
    .map(Number)
    .filter((n) => n >= 1 && n <= ALL_PLATFORMS.length);
  if (indices.length === 0) return ["twitter"];
  return indices.map((i) => ALL_PLATFORMS[i - 1]);
}

export async function askProfileUrls(
  platforms: SocialPlatform[],
): Promise<Partial<Record<SocialPlatform, { profileUrl: string }>>> {
  const rl = createInterface({ input: process.stdin, output: process.stderr });

  process.stderr.write("\n--- Social Profile URLs ---\n");
  process.stderr.write("Provide the URL to each of your social profiles.\n\n");

  const result: Partial<Record<SocialPlatform, { profileUrl: string }>> = {};
  for (const p of platforms) {
    const url = await ask(rl, `${PLATFORM_LABELS[p]} profile URL:`);
    if (url) result[p] = { profileUrl: url };
  }
  rl.close();
  return result;
}
