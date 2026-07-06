import { authenticatePlatform } from "./automation/shared.js";
import {
  addToCalendar,
  calendarStats,
  findPost,
  getUpcoming,
  removeFromCalendar,
  renderCalendarHuman,
  updatePostStatus,
} from "./calendar.js";
import { generateImage, generateImagePrompt, generatePostText, platformImageDimensions } from "./generate.js";
import { askProfileUrls, choosePlatforms, runBrandInterview } from "./interview.js";
import { loginFlow, postContent } from "./poster.js";
import { runSchedulerLoop } from "./scheduler.js";
import { loadCalendar, loadConfig, saveCalendar, saveConfig, uuid } from "./store.js";
import type { AutomationPlatform, ContentPost, SocialPlatform } from "./types.js";
import { ALL_AUTOMATION_PLATFORMS, ALL_PLATFORMS, AUTOMATION_PLATFORM_LABELS, PLATFORM_LABELS } from "./types.js";

interface SocialFlags {
  human: boolean;
  quiet: boolean;
  platform?: string;
  topic?: string;
  withImage?: boolean;
  count?: number;
  apiKey?: string;
  model?: string;
  days?: number;
  statusFilter?: string;
  deleteId?: string;
  at?: string;
  id?: string;
  allDue?: boolean;
  login?: boolean;
  interval?: number;
}

function out(data: unknown, flags: SocialFlags): void {
  if (flags.quiet) return;
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function die(msg: string): never {
  process.stderr.write(`Error: ${msg}\n`);
  process.exit(1);
}

function requireApiKey(flags: SocialFlags): string {
  const key = flags.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (!key) {
    die("Missing API key. Set OPENROUTER_API_KEY or pass --api-key.\n" + "  Get one at https://openrouter.ai/keys");
  }
  return key;
}

function parsePlatform(s: string): SocialPlatform {
  const lower = s.toLowerCase();
  if (ALL_PLATFORMS.includes(lower as SocialPlatform)) return lower as SocialPlatform;
  const aliases: Record<string, SocialPlatform> = { x: "twitter", ig: "instagram", li: "linkedin", fb: "facebook" };
  if (aliases[lower]) return aliases[lower];
  die(`Unknown platform: ${s}. Valid: ${ALL_PLATFORMS.join(", ")} (or x, ig, li, fb)`);
}

// --- social-setup ---
export async function cmdSocialSetup(flags: SocialFlags): Promise<void> {
  const config = loadConfig();

  process.stderr.write("Setting up your social content scheduler.\n");

  const brandVoice = await runBrandInterview();
  config.brandVoice = brandVoice;

  const platforms = await choosePlatforms();
  config.defaultPlatforms = platforms;

  const credentials = await askProfileUrls(platforms);
  config.credentials = { ...config.credentials, ...credentials };

  const apiKey = flags.apiKey ?? process.env.OPENROUTER_API_KEY;
  if (apiKey) config.openRouterApiKey = apiKey;

  saveConfig(config);

  if (flags.human) {
    process.stderr.write("\nSetup complete!\n");
    process.stderr.write(`  Brand tone: ${brandVoice.tone}\n`);
    process.stderr.write(`  Platforms: ${platforms.map((p) => PLATFORM_LABELS[p]).join(", ")}\n`);
    process.stderr.write(`  Config saved to: ~/.social-scheduler/config.json\n`);
    process.stderr.write(`\nNext: metrix generate --platform twitter --topic "your topic"\n`);
  } else {
    out({ ok: true, brandVoice, platforms, credentials }, flags);
  }
}

// --- social-generate ---
export async function cmdSocialGenerate(positional: string[], flags: SocialFlags): Promise<void> {
  const config = loadConfig();
  if (!config.brandVoice) die("No brand voice configured. Run: metrix setup");

  const apiKey = requireApiKey(flags);
  const count = flags.count ?? 1;

  const platforms: SocialPlatform[] = flags.platform
    ? [parsePlatform(flags.platform)]
    : config.defaultPlatforms.length > 0
      ? config.defaultPlatforms
      : die("No platform specified. Use --platform <name> or run social-setup.");

  const calendar = loadCalendar();
  const posts: ContentPost[] = [];

  for (let i = 0; i < count; i++) {
    for (const platform of platforms) {
      process.stderr.write(
        `Generating ${PLATFORM_LABELS[platform]} post${flags.topic ? ` about "${flags.topic}"` : ""}...\n`,
      );

      const text = await generatePostText({
        brandVoice: config.brandVoice,
        platform,
        topic: flags.topic ?? positional[0],
        apiKey,
        model: flags.model,
      });

      let imagePath: string | undefined;
      let imagePrompt: string | undefined;

      if (flags.withImage) {
        process.stderr.write("  Generating image prompt...\n");
        imagePrompt = await generateImagePrompt({
          brandVoice: config.brandVoice,
          postText: text,
          apiKey,
        });

        process.stderr.write(`  Generating image: "${imagePrompt.slice(0, 60)}..."\n`);
        const dims = platformImageDimensions(platform);
        imagePath = await generateImage({ prompt: imagePrompt, ...dims });
        process.stderr.write(`  Image saved: ${imagePath}\n`);
      }

      const post: ContentPost = {
        id: uuid(),
        platform,
        text,
        imagePath,
        imagePrompt,
        status: "draft",
        createdAt: new Date().toISOString(),
      };

      addToCalendar(calendar, post);
      posts.push(post);
    }
  }

  saveCalendar(calendar);

  if (flags.human) {
    process.stderr.write(`\n${"=".repeat(60)}\n`);
    for (const p of posts) {
      process.stderr.write(`\n[${PLATFORM_LABELS[p.platform]}] (id: ${p.id.slice(0, 8)})\n`);
      process.stderr.write(`${p.text}\n`);
      if (p.imagePath) process.stderr.write(`Image: ${p.imagePath}\n`);
    }
    process.stderr.write(
      `\n${posts.length} post(s) generated as drafts.\n` +
        `Schedule with: metrix schedule --id <id> --at "2024-12-25 14:00"\n`,
    );
  } else {
    out(posts, flags);
  }
}

// --- social-calendar ---
export function cmdSocialCalendar(flags: SocialFlags): void {
  const calendar = loadCalendar();

  if (flags.deleteId) {
    const found = findPost(calendar, flags.deleteId);
    if (!found) die(`Post not found: ${flags.deleteId}`);
    removeFromCalendar(calendar, found.id);
    saveCalendar(calendar);
    if (flags.human) {
      process.stderr.write(`Deleted post ${found.id.slice(0, 8)}.\n`);
    } else {
      out({ ok: true, deleted: found.id }, flags);
    }
    return;
  }

  let filtered = calendar;
  if (flags.statusFilter) {
    filtered = { ...calendar, posts: calendar.posts.filter((p) => p.status === flags.statusFilter) };
  }
  if (flags.days !== undefined) {
    filtered = { ...filtered, posts: getUpcoming(calendar, flags.days) };
  }

  if (flags.human) {
    process.stdout.write(renderCalendarHuman(filtered) + "\n");
  } else {
    out(filtered, flags);
  }
}

// --- social-schedule ---
export function cmdSocialSchedule(positional: string[], flags: SocialFlags): void {
  const calendar = loadCalendar();

  if (flags.id) {
    if (!flags.at) die("Missing --at <datetime>. Example: --at '2024-12-25 14:00'");
    const post = findPost(calendar, flags.id);
    if (!post) die(`Post not found: ${flags.id}`);

    const scheduledAt = new Date(flags.at);
    if (Number.isNaN(scheduledAt.getTime())) die(`Invalid date: ${flags.at}`);

    post.scheduledAt = scheduledAt.toISOString();
    post.status = "scheduled";
    saveCalendar(calendar);

    if (flags.human) {
      process.stderr.write(
        `Scheduled: ${PLATFORM_LABELS[post.platform]} post ${post.id.slice(0, 8)} for ${scheduledAt.toLocaleString()}\n`,
      );
    } else {
      out(post, flags);
    }
    return;
  }

  // Inline scheduling: social-schedule "text" --platform twitter --at "..."
  const text = positional[0];
  if (!text) die("Provide post text or --id. Usage: metrix schedule <text> --platform <p> --at <datetime>");
  if (!flags.platform) die("Missing --platform");
  if (!flags.at) die("Missing --at <datetime>");

  const platform = parsePlatform(flags.platform);
  const scheduledAt = new Date(flags.at);
  if (Number.isNaN(scheduledAt.getTime())) die(`Invalid date: ${flags.at}`);

  const post: ContentPost = {
    id: uuid(),
    platform,
    text,
    status: "scheduled",
    scheduledAt: scheduledAt.toISOString(),
    createdAt: new Date().toISOString(),
  };

  addToCalendar(calendar, post);
  saveCalendar(calendar);

  if (flags.human) {
    process.stderr.write(
      `Scheduled: ${PLATFORM_LABELS[platform]} post ${post.id.slice(0, 8)} for ${scheduledAt.toLocaleString()}\n`,
    );
  } else {
    out(post, flags);
  }
}

// --- social-post ---
export async function cmdSocialPost(positional: string[], flags: SocialFlags): Promise<void> {
  if (flags.login) {
    if (!flags.platform) die("Missing --platform for login.");
    await loginFlow(parsePlatform(flags.platform));
    return;
  }

  const calendar = loadCalendar();
  const toPost: ContentPost[] = [];

  if (flags.allDue) {
    const due = calendar.posts.filter((p) => {
      if (p.status !== "scheduled" || !p.scheduledAt) return false;
      return new Date(p.scheduledAt).getTime() <= Date.now();
    });
    toPost.push(...due);
  } else if (flags.id) {
    const post = findPost(calendar, flags.id);
    if (!post) die(`Post not found: ${flags.id}`);
    toPost.push(post);
  } else {
    die("Specify --id <post-id> or --all-due. Use --login --platform <p> for initial login.");
  }

  if (toPost.length === 0) {
    if (flags.human) {
      process.stderr.write("No posts to send.\n");
    } else {
      out({ ok: true, posted: 0 }, flags);
    }
    return;
  }

  const results: Array<{ id: string; platform: string; ok: boolean; error?: string }> = [];

  for (const post of toPost) {
    process.stderr.write(`Posting to ${PLATFORM_LABELS[post.platform]}...\n`);
    const result = await postContent(post);

    if (result.ok) {
      updatePostStatus(calendar, post.id, "posted");
      process.stderr.write(`  -> Success\n`);
    } else {
      updatePostStatus(calendar, post.id, "failed", result.error);
      process.stderr.write(`  -> Failed: ${result.error}\n`);
    }

    results.push({ id: post.id, platform: post.platform, ...result });
  }

  saveCalendar(calendar);

  if (!flags.human) {
    out({ ok: results.every((r) => r.ok), results }, flags);
  }
}

// --- social-status ---
export function cmdSocialStatus(flags: SocialFlags): void {
  const config = loadConfig();
  const calendar = loadCalendar();
  const stats = calendarStats(calendar);
  const upcoming = getUpcoming(calendar, 7);

  const status = {
    configured: !!config.brandVoice,
    platforms: config.defaultPlatforms.map((p) => PLATFORM_LABELS[p]),
    stats,
    upcoming: upcoming.map((p) => ({
      id: p.id.slice(0, 8),
      platform: PLATFORM_LABELS[p.platform],
      scheduledAt: p.scheduledAt,
      text: p.text.slice(0, 60),
    })),
    brandVoice: config.brandVoice
      ? { tone: config.brandVoice.tone, audience: config.brandVoice.audience, style: config.brandVoice.style }
      : null,
  };

  if (flags.human) {
    process.stderr.write("\nSocial Content Scheduler - Status\n");
    process.stderr.write("=".repeat(40) + "\n\n");

    if (!config.brandVoice) {
      process.stderr.write("Not configured. Run: metrix setup\n\n");
      return;
    }

    process.stderr.write(`Brand: ${config.brandVoice.tone} / ${config.brandVoice.style}\n`);
    process.stderr.write(`Platforms: ${status.platforms.join(", ")}\n\n`);
    process.stderr.write(`Posts:  ${stats.total} total\n`);
    process.stderr.write(`  Draft:     ${stats.draft}\n`);
    process.stderr.write(`  Scheduled: ${stats.scheduled}\n`);
    process.stderr.write(`  Posted:    ${stats.posted}\n`);
    process.stderr.write(`  Failed:    ${stats.failed}\n\n`);

    if (upcoming.length > 0) {
      process.stderr.write("Upcoming (next 7 days):\n");
      for (const p of upcoming) {
        const time = new Date(p.scheduledAt!).toLocaleString();
        process.stderr.write(`  ${time}  ${PLATFORM_LABELS[p.platform]}  "${p.text.slice(0, 40)}..."\n`);
      }
    } else {
      process.stderr.write("No upcoming posts.\n");
    }
  } else {
    out(status, flags);
  }
}

// --- connect / connect-all ---
function parseAutomationPlatform(s: string): AutomationPlatform {
  const lower = s.toLowerCase();
  if (ALL_AUTOMATION_PLATFORMS.includes(lower as AutomationPlatform)) return lower as AutomationPlatform;
  const aliases: Record<string, AutomationPlatform> = {
    x: "facebook",
    ig: "instagram",
    li: "linkedin",
    fb: "facebook",
    tt: "tiktok",
    yt: "youtube",
    pin: "pinterest",
  };
  if (aliases[lower]) return aliases[lower];
  die(`Unknown platform: ${s}. Valid: ${ALL_AUTOMATION_PLATFORMS.join(", ")}`);
}

export async function cmdConnect(positional: string[], flags: SocialFlags): Promise<void> {
  const platformArg = flags.platform ?? positional[0];
  if (!platformArg) die("Specify a platform. Usage: metrix connect --platform <name>");
  const platform = parseAutomationPlatform(platformArg);

  process.stderr.write(`\nConnecting to ${AUTOMATION_PLATFORM_LABELS[platform]}...\n`);
  await authenticatePlatform(platform);

  if (flags.human) {
    process.stderr.write(`\n${AUTOMATION_PLATFORM_LABELS[platform]} connected successfully.\n`);
  } else {
    out({ ok: true, platform }, flags);
  }
}

export async function cmdConnectAll(flags: SocialFlags): Promise<void> {
  process.stderr.write("\nMetrix Connect-All: Authenticate with all supported platforms\n");
  process.stderr.write("=".repeat(60) + "\n");
  process.stderr.write("Sessions are saved to ~/.metrix-assistant/sessions/\n\n");

  const results: Array<{ platform: AutomationPlatform; ok: boolean; error?: string }> = [];

  for (const platform of ALL_AUTOMATION_PLATFORMS) {
    process.stderr.write(
      `\n[${results.length + 1}/${ALL_AUTOMATION_PLATFORMS.length}] ${AUTOMATION_PLATFORM_LABELS[platform]}\n`,
    );
    try {
      await authenticatePlatform(platform);
      results.push({ platform, ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(`  Failed: ${msg}\n`);
      results.push({ platform, ok: false, error: msg });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  if (flags.human) {
    process.stderr.write(`\n${"=".repeat(60)}\n`);
    process.stderr.write(`Done: ${succeeded} connected, ${failed} failed\n`);
    for (const r of results) {
      const icon = r.ok ? "+" : "-";
      process.stderr.write(`  [${icon}] ${AUTOMATION_PLATFORM_LABELS[r.platform]}${r.error ? ` (${r.error})` : ""}\n`);
    }
  } else {
    out({ ok: failed === 0, succeeded, failed, results }, flags);
  }
}

// --- social-daemon ---
export async function cmdSocialDaemon(flags: SocialFlags): Promise<void> {
  const intervalMs = (flags.interval ?? 60) * 1000;
  await runSchedulerLoop(intervalMs);
}

// --- Flag parsing for social commands ---
export function parseSocialFlags(args: string[]): { positional: string[]; flags: SocialFlags } {
  const positional: string[] = [];
  const flags: SocialFlags = { human: false, quiet: false };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case "-H":
      case "--human":
        flags.human = true;
        break;
      case "-q":
      case "--quiet":
        flags.quiet = true;
        break;
      case "--platform":
        flags.platform = args[++i];
        break;
      case "--topic":
        flags.topic = args[++i];
        break;
      case "--with-image":
        flags.withImage = true;
        break;
      case "--count":
        flags.count = Number(args[++i]);
        break;
      case "--api-key":
        flags.apiKey = args[++i];
        break;
      case "--model":
        flags.model = args[++i];
        break;
      case "--days":
        flags.days = Number(args[++i]);
        break;
      case "--status":
        flags.statusFilter = args[++i];
        break;
      case "--delete":
        flags.deleteId = args[++i];
        break;
      case "--at":
        flags.at = args[++i];
        break;
      case "--id":
        flags.id = args[++i];
        break;
      case "--all-due":
        flags.allDue = true;
        break;
      case "--login":
        flags.login = true;
        break;
      case "--interval":
        flags.interval = Number(args[++i]);
        break;
      default:
        positional.push(arg);
        break;
    }
  }

  return { positional, flags };
}
