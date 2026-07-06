import { existsSync } from "node:fs";
import { join } from "node:path";
import { authDir } from "./store.js";
import type { ContentPost, SocialPlatform } from "./types.js";
import { PLATFORM_LABELS } from "./types.js";

async function loadPlaywright(): Promise<{ chromium: any }> {
  try {
    const mod = "playwright";
    return await import(/* webpackIgnore: true */ mod);
  } catch {
    throw new Error(
      "Playwright is required for posting. Install it:\n" +
        "  npm install playwright\n" +
        "  npx playwright install chromium\n",
    );
  }
}

function authStatePath(platform: SocialPlatform): string {
  return join(authDir(), `${platform}.json`);
}

async function launchBrowser(
  pw: { chromium: any },
  platform: SocialPlatform,
  headless: boolean,
): Promise<{ browser: any; context: any; page: any }> {
  const authFile = authStatePath(platform);
  const hasAuth = existsSync(authFile);

  const browser = await pw.chromium.launch({ headless });
  const context = await browser.newContext({
    ...(hasAuth ? { storageState: authFile } : {}),
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();
  return { browser, context, page };
}

async function saveAuth(context: any, platform: SocialPlatform): Promise<void> {
  await context.storageState({ path: authStatePath(platform) });
}

export async function loginFlow(platform: SocialPlatform): Promise<void> {
  const pw = await loadPlaywright();
  const { browser, context, page } = await launchBrowser(pw, platform, false);

  const urls: Record<SocialPlatform, string> = {
    twitter: "https://x.com/login",
    instagram: "https://www.instagram.com/accounts/login/",
    linkedin: "https://www.linkedin.com/login",
    facebook: "https://www.facebook.com/login",
  };

  await page.goto(urls[platform]);
  process.stderr.write(
    `\nA browser window has opened to ${PLATFORM_LABELS[platform]} login.\n` +
      `Log in manually, then press Enter here when done...\n`,
  );

  await new Promise<void>((resolve) => {
    process.stdin.once("data", () => resolve());
  });

  await saveAuth(context, platform);
  await browser.close();
  process.stderr.write(`Auth saved for ${PLATFORM_LABELS[platform]}.\n`);
}

async function postToTwitter(page: any, text: string, imagePath?: string): Promise<void> {
  await page.goto("https://x.com/compose/post", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const editor = page.getByRole("textbox").first();
  await editor.click();
  await editor.fill(text);

  if (imagePath) {
    const fileInput = page.locator('input[type="file"][accept*="image"]').first();
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(3000);
  }

  const postBtn = page.getByTestId("tweetButton").or(page.locator('[data-testid="tweetButtonInline"]'));
  await postBtn.click();
  await page.waitForTimeout(3000);
}

async function postToLinkedIn(page: any, text: string, imagePath?: string): Promise<void> {
  await page.goto("https://www.linkedin.com/feed/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const startPost = page.locator("button.share-box-feed-entry__trigger").first();
  await startPost.click();
  await page.waitForTimeout(1500);

  const editor = page.locator('[role="textbox"][contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.type(text, { delay: 10 });

  if (imagePath) {
    const mediaBtn = page.locator('button[aria-label*="media"], button[aria-label*="photo"]').first();
    await mediaBtn.click();
    await page.waitForTimeout(1000);
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(3000);
  }

  const postButton = page.locator("button.share-actions__primary-action").first();
  await postButton.click();
  await page.waitForTimeout(3000);
}

async function postToInstagram(page: any, text: string, imagePath?: string): Promise<void> {
  await page.goto("https://www.instagram.com/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  if (!imagePath) {
    throw new Error("Instagram requires an image. Generate one with --with-image.");
  }

  const createBtn = page
    .locator('[aria-label="New post"]')
    .or(page.locator('svg[aria-label="New post"]').locator(".."));
  await createBtn.first().click();
  await page.waitForTimeout(1500);

  const fileInput = page.locator('input[type="file"][accept*="image"]').first();
  await fileInput.setInputFiles(imagePath);
  await page.waitForTimeout(3000);

  const nextBtn = page.locator("button:has-text('Next')");
  await nextBtn.click();
  await page.waitForTimeout(1500);
  await nextBtn.click();
  await page.waitForTimeout(1500);

  const captionArea = page.locator('[aria-label="Write a caption..."]').or(page.locator("textarea")).first();
  await captionArea.click();
  await page.keyboard.type(text, { delay: 10 });

  const shareBtn = page.locator("button:has-text('Share')");
  await shareBtn.click();
  await page.waitForTimeout(5000);
}

async function postToFacebook(page: any, text: string, imagePath?: string): Promise<void> {
  await page.goto("https://www.facebook.com/", { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  const createPost = page
    .locator('[aria-label="Create a post"], [role="button"]:has-text("What\'s on your mind")')
    .first();
  await createPost.click();
  await page.waitForTimeout(2000);

  const editor = page.locator('[role="textbox"][contenteditable="true"]').first();
  await editor.click();
  await page.keyboard.type(text, { delay: 10 });

  if (imagePath) {
    const photoBtn = page.locator('[aria-label*="Photo"], [aria-label*="photo"]').first();
    await photoBtn.click();
    await page.waitForTimeout(1000);
    const fileInput = page.locator('input[type="file"][accept*="image"]').first();
    await fileInput.setInputFiles(imagePath);
    await page.waitForTimeout(3000);
  }

  const postBtn = page.locator('[aria-label="Post"], button:has-text("Post")').first();
  await postBtn.click();
  await page.waitForTimeout(5000);
}

export async function postContent(post: ContentPost): Promise<{ ok: boolean; error?: string }> {
  const pw = await loadPlaywright();
  const { browser, context, page } = await launchBrowser(pw, post.platform, true);

  try {
    const platformPosters: Record<SocialPlatform, (p: any, t: string, img?: string) => Promise<void>> = {
      twitter: postToTwitter,
      linkedin: postToLinkedIn,
      instagram: postToInstagram,
      facebook: postToFacebook,
    };

    await platformPosters[post.platform](page, post.text, post.imagePath);
    await saveAuth(context, post.platform);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    await browser.close();
  }
}
