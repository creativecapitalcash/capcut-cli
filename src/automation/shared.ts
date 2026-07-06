import { existsSync } from "node:fs";
import { join } from "node:path";
import { sessionsDir } from "../store.js";
import type { AutomationPlatform } from "../types.js";
import { AUTOMATION_LOGIN_URLS, AUTOMATION_PLATFORM_LABELS } from "../types.js";

async function loadPlaywright(): Promise<{ chromium: any }> {
  try {
    const mod = "playwright";
    return await import(/* webpackIgnore: true */ mod);
  } catch {
    throw new Error(
      "Playwright is required for browser authentication. Install it:\n" +
        "  npm install playwright\n" +
        "  npx playwright install chromium\n",
    );
  }
}

export function sessionPath(platform: AutomationPlatform): string {
  return join(sessionsDir(), `${platform}.json`);
}

export async function authenticatePlatform(platform: AutomationPlatform): Promise<void> {
  const pw = await loadPlaywright();
  const sessionFile = sessionPath(platform);
  const hasSession = existsSync(sessionFile);
  const label = AUTOMATION_PLATFORM_LABELS[platform];
  const loginUrl = AUTOMATION_LOGIN_URLS[platform];

  const browser = await pw.chromium.launch({ headless: false });
  const context = await browser.newContext({
    ...(hasSession ? { storageState: sessionFile } : {}),
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });

  const page = await context.newPage();

  try {
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    process.stderr.write(
      `\n[${label}] Browser opened -> ${loginUrl}\n` + `  Log in manually, then press Enter here when done...\n`,
    );

    await new Promise<void>((resolve) => {
      process.stdin.once("data", () => resolve());
    });

    await context.storageState({ path: sessionFile });
    process.stderr.write(`  Session saved -> ${sessionFile}\n`);
  } finally {
    await browser.close();
  }
}
