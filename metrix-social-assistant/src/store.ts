import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ContentCalendar, SocialConfig } from "./types.js";

const DATA_DIR = join(homedir(), ".social-scheduler");
const CONFIG_FILE = join(DATA_DIR, "config.json");
const CALENDAR_FILE = join(DATA_DIR, "calendar.json");
const IMAGES_DIR = join(DATA_DIR, "images");
const AUTH_DIR = join(DATA_DIR, "auth");

export function ensureDataDir(): void {
  for (const d of [DATA_DIR, IMAGES_DIR, AUTH_DIR]) {
    mkdirSync(d, { recursive: true });
  }
}

export function dataDir(): string {
  return DATA_DIR;
}

export function imagesDir(): string {
  ensureDataDir();
  return IMAGES_DIR;
}

export function authDir(): string {
  ensureDataDir();
  return AUTH_DIR;
}

export function loadConfig(): SocialConfig {
  if (!existsSync(CONFIG_FILE)) {
    return { credentials: {}, defaultPlatforms: [] };
  }
  return JSON.parse(readFileSync(CONFIG_FILE, "utf-8")) as SocialConfig;
}

export function saveConfig(config: SocialConfig): void {
  ensureDataDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function loadCalendar(): ContentCalendar {
  if (!existsSync(CALENDAR_FILE)) {
    return { version: 1, posts: [] };
  }
  return JSON.parse(readFileSync(CALENDAR_FILE, "utf-8")) as ContentCalendar;
}

export function saveCalendar(calendar: ContentCalendar): void {
  ensureDataDir();
  writeFileSync(CALENDAR_FILE, JSON.stringify(calendar, null, 2), "utf-8");
}

export function uuid(): string {
  return randomUUID();
}
