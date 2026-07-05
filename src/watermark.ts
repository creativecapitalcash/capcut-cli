import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { probeMedia } from "./probe.js";

export interface WatermarkRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  startTime?: number;
  endTime?: number;
}

export interface RemoveWatermarkOptions {
  input: string;
  out?: string;
  platform?: "tiktok" | "auto";
  regions?: WatermarkRegion[];
  crf?: number;
  ffmpegCmd?: string;
  ffprobeCmd?: string;
  dryRun?: boolean;
}

export interface RemoveWatermarkResult {
  ok: boolean;
  output: string;
  regions: WatermarkRegion[];
  platform: string;
  args: string[];
  executed: boolean;
}

function detectTikTokRegions(width: number, height: number): WatermarkRegion[] {
  const isPortrait = height > width;
  if (isPortrait) {
    return [
      {
        x: Math.round(width * 0.01),
        y: Math.round(height * 0.42),
        w: Math.round(width * 0.32),
        h: Math.round(height * 0.12),
        startTime: 0,
        endTime: 5,
      },
      {
        x: Math.round(width * 0.7),
        y: Math.round(height * 0.76),
        w: Math.round(width * 0.29),
        h: Math.round(height * 0.13),
        startTime: 4,
      },
    ];
  }
  return [
    {
      x: Math.round(width * 0.01),
      y: Math.round(height * 0.85),
      w: Math.round(width * 0.18),
      h: Math.round(height * 0.12),
    },
    {
      x: Math.round(width * 0.82),
      y: Math.round(height * 0.85),
      w: Math.round(width * 0.17),
      h: Math.round(height * 0.12),
    },
  ];
}

function clampRegion(r: WatermarkRegion, width: number, height: number): WatermarkRegion {
  const x = Math.max(2, Math.min(r.x, width - r.w - 2));
  const y = Math.max(2, Math.min(r.y, height - r.h - 2));
  const w = Math.min(r.w, width - x - 2);
  const h = Math.min(r.h, height - y - 2);
  return { ...r, x, y, w, h };
}

function buildDelogoFilter(regions: WatermarkRegion[], duration: number): string {
  return regions
    .map((r) => {
      const base = `delogo=x=${r.x}:y=${r.y}:w=${r.w}:h=${r.h}`;
      const start = r.startTime ?? 0;
      const end = r.endTime ?? Math.ceil(duration) + 1;
      return `${base}:enable='between(t,${start},${end})'`;
    })
    .join(",");
}

export function removeWatermark(opts: RemoveWatermarkOptions): RemoveWatermarkResult {
  if (!existsSync(opts.input)) {
    throw new Error(`Input file not found: ${opts.input}`);
  }

  const ffmpeg = opts.ffmpegCmd ?? "ffmpeg";
  const probe = probeMedia(opts.input, opts.ffprobeCmd);
  if (!probe?.width || !probe.height) {
    throw new Error("Could not detect video dimensions. Install ffprobe or pass explicit --region coordinates.");
  }

  const width = probe.width;
  const height = probe.height;
  const duration = (probe.durationUs ?? 30_000_000) / 1_000_000;

  let regions: WatermarkRegion[];
  let platform: string;

  if (opts.regions && opts.regions.length > 0) {
    regions = opts.regions.map((r) => clampRegion(r, width, height));
    platform = "manual";
  } else {
    regions = detectTikTokRegions(width, height).map((r) => clampRegion(r, width, height));
    platform = opts.platform ?? "tiktok";
  }

  const output = opts.out ?? opts.input.replace(/(\.[^.]+)$/, "_no_watermark$1");
  const filter = buildDelogoFilter(regions, duration);
  const crf = String(opts.crf ?? 18);

  const args = [
    "-y",
    "-i",
    opts.input,
    "-vf",
    filter,
    "-c:v",
    "libx264",
    "-crf",
    crf,
    "-preset",
    "medium",
    "-c:a",
    "copy",
    output,
  ];

  if (opts.dryRun) {
    return { ok: true, output, regions, platform, args, executed: false };
  }

  const r = spawnSync(ffmpeg, args, { encoding: "utf-8", timeout: 600_000 });
  if (r.error || r.status !== 0) {
    const stderr = r.stderr?.slice(-600) || r.error?.message || `ffmpeg exited ${r.status}`;
    throw new Error(`remove-watermark: ffmpeg failed.\n${stderr}`);
  }

  return { ok: true, output, regions, platform, args, executed: true };
}
