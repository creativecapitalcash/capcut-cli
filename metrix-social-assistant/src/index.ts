#!/usr/bin/env node

import {
  cmdSocialCalendar,
  cmdSocialDaemon,
  cmdSocialGenerate,
  cmdSocialPost,
  cmdSocialSchedule,
  cmdSocialSetup,
  cmdSocialStatus,
  parseSocialFlags,
} from "./commands.js";

const HELP = `metrix -- AI-powered social media content creation & scheduling

Usage: metrix <command> [options]

Commands:
  setup                          Brand voice interview + API key + platform config
  generate [options]             Generate AI content (text + optional image)
    --platform <p>               Platform: twitter/x, instagram/ig, linkedin/li, facebook/fb
    --topic <t>                  Topic to post about
    --with-image                 Generate an image with Pollinations.ai (free)
    --count <n>                  Number of posts to generate (default 1)
    --api-key <key>              Anthropic API key (or set ANTHROPIC_API_KEY)
    --openrouter-key <key>       OpenRouter API key (or set OPENROUTER_API_KEY)
    --model <id>                 Model ID (default: claude-haiku-4-5-20251001)
  calendar [options]             View/manage the content calendar
    --days <n>                   Show upcoming N days (default 7)
    --status <s>                 Filter by status: draft/scheduled/posted/failed
    --delete <id>                Delete a post by ID prefix
  schedule <text> --platform <p> --at <datetime>
  schedule --id <id> --at <datetime>
                                 Schedule a post for a specific date/time
  post --id <id>                 Post one entry via headless browser (Playwright)
  post --all-due                 Post all due scheduled content
  post --login --platform <p>    Log in to a platform (saves session)
  status                         Dashboard: post counts, upcoming, past-due
  daemon [--interval <s>]        Run scheduler loop (default 60s check interval)

Global flags:
  -H, --human                    Human-readable output (default: JSON)
  -q, --quiet                    Suppress output on success
  -v, --version                  Print version
  -h, --help                     Show this help

Quickstart:
  metrix setup                   # interview + configure
  metrix generate -H             # create content with AI
  metrix schedule --id <id> --at "2025-12-25 14:00"
  metrix post --login --platform twitter
  metrix daemon                  # auto-post on schedule

Data directory: ~/.social-scheduler/
Text generation: Claude via Anthropic API or OpenRouter (set ANTHROPIC_API_KEY or OPENROUTER_API_KEY)
Image generation: Pollinations.ai (free, no API key)
Posting: Playwright headless browser (npm install playwright)
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("-h") || args.includes("--help")) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  if (args.includes("-v") || args.includes("--version")) {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const pkgPath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as { version: string };
    process.stdout.write(`metrix ${pkg.version}\n`);
    process.exit(0);
  }

  const cmd = args[0];
  const { positional, flags } = parseSocialFlags(args.slice(1));

  switch (cmd) {
    case "setup":
      await cmdSocialSetup(flags);
      break;
    case "generate":
      await cmdSocialGenerate(positional, flags);
      break;
    case "calendar":
      cmdSocialCalendar(flags);
      break;
    case "schedule":
      cmdSocialSchedule(positional, flags);
      break;
    case "post":
      await cmdSocialPost(positional, flags);
      break;
    case "status":
      cmdSocialStatus(flags);
      break;
    case "daemon":
      await cmdSocialDaemon(flags);
      break;
    default:
      process.stderr.write(`Unknown command: ${cmd}\nRun 'metrix --help' for usage.\n`);
      process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
