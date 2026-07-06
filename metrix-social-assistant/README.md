# Metrix Social Assistant

Free AI-powered social media content creation and scheduling CLI.

## Features

- **Brand Voice Interview** — interactive setup to establish your tone, audience, and style
- **AI Text Generation** — Claude (Anthropic API) generates platform-aware posts
- **Free Image Generation** — Pollinations.ai creates images with no API key needed
- **Content Calendar** — schedule, view, and manage posts
- **Auto-Posting** — Playwright headless browser posts to Twitter/X, Instagram, LinkedIn, Facebook
- **Daemon Mode** — runs in the background and posts on schedule

## Quickstart

```bash
# Install
npm install
npm run build

# Set your Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-..."

# Configure your brand voice
metrix setup

# Generate a post
metrix generate -H --platform twitter --topic "productivity tips"

# Generate with an image
metrix generate -H --platform instagram --topic "morning routine" --with-image

# Schedule it
metrix schedule --id <id> --at "2025-12-25 14:00"

# Log in to a platform (opens browser)
metrix post --login --platform twitter

# Post manually
metrix post --id <id>

# Run the auto-poster daemon
metrix daemon
```

## Commands

| Command | Description |
|---------|-------------|
| `setup` | Brand voice interview + platform config |
| `generate` | Generate AI content (text + optional image) |
| `calendar` | View/manage the content calendar |
| `schedule` | Schedule a post for a specific date/time |
| `post` | Post content via headless browser |
| `status` | Dashboard with post counts and upcoming |
| `daemon` | Run scheduler loop for auto-posting |

## Requirements

- **Node.js** >= 18
- **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)
- **Playwright** (optional, for auto-posting) — `npm install playwright && npx playwright install chromium`

## How It Works

1. **Setup** interviews you to build a brand voice profile (tone, audience, style, topics, dos/don'ts)
2. **Generate** sends your brand voice + topic to Claude, which creates platform-optimized posts
3. **Images** are generated free via Pollinations.ai — Claude creates the image prompt, Pollinations renders it
4. **Calendar** stores everything in `~/.social-scheduler/calendar.json`
5. **Posting** uses Playwright to automate the browser — you log in once, it saves your session
6. **Daemon** checks for due posts every 60s and auto-posts them

## Data Storage

All data is stored in `~/.social-scheduler/`:
- `config.json` — brand voice, API key, platform settings
- `calendar.json` — all posts and their statuses
- `images/` — generated images
- `auth/` — browser auth sessions (per platform)

## Supported Platforms

- Twitter/X
- Instagram
- LinkedIn
- Facebook

## License

MIT
