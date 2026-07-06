import type { ContentCalendar, ContentPost, SocialPlatform } from "./types.js";
import { PLATFORM_LABELS } from "./types.js";

export function addToCalendar(calendar: ContentCalendar, post: ContentPost): ContentCalendar {
  calendar.posts.push(post);
  return calendar;
}

export function removeFromCalendar(calendar: ContentCalendar, postId: string): ContentCalendar {
  calendar.posts = calendar.posts.filter((p) => p.id !== postId && !p.id.startsWith(postId));
  return calendar;
}

export function findPost(calendar: ContentCalendar, idPrefix: string): ContentPost | undefined {
  return calendar.posts.find((p) => p.id === idPrefix || p.id.startsWith(idPrefix));
}

export function getUpcoming(calendar: ContentCalendar, days = 7): ContentPost[] {
  const now = Date.now();
  const cutoff = now + days * 24 * 60 * 60 * 1000;
  return calendar.posts
    .filter((p) => {
      if (!p.scheduledAt) return false;
      const t = new Date(p.scheduledAt).getTime();
      return t >= now && t <= cutoff && (p.status === "scheduled" || p.status === "draft");
    })
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
}

export function getPastDue(calendar: ContentCalendar): ContentPost[] {
  const now = Date.now();
  return calendar.posts.filter((p) => {
    if (!p.scheduledAt || p.status !== "scheduled") return false;
    return new Date(p.scheduledAt).getTime() < now;
  });
}

export function updatePostStatus(
  calendar: ContentCalendar,
  postId: string,
  status: ContentPost["status"],
  error?: string,
): void {
  const post = calendar.posts.find((p) => p.id === postId || p.id.startsWith(postId));
  if (post) {
    post.status = status;
    if (error) post.error = error;
  }
}

export function calendarStats(calendar: ContentCalendar): Record<string, number> {
  const stats: Record<string, number> = { draft: 0, scheduled: 0, posted: 0, failed: 0, total: 0 };
  for (const p of calendar.posts) {
    stats[p.status] = (stats[p.status] ?? 0) + 1;
    stats.total++;
  }
  return stats;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

function statusIcon(status: ContentPost["status"]): string {
  switch (status) {
    case "draft":
      return "[draft]    ";
    case "scheduled":
      return "[scheduled]";
    case "posted":
      return "[posted]   ";
    case "failed":
      return "[FAILED]   ";
  }
}

export function renderCalendarHuman(calendar: ContentCalendar): string {
  if (calendar.posts.length === 0) return "No posts in calendar. Run: capcut social-generate";

  const grouped = new Map<string, ContentPost[]>();
  for (const post of calendar.posts) {
    const dateKey = post.scheduledAt
      ? new Date(post.scheduledAt).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "Unscheduled";
    if (!grouped.has(dateKey)) grouped.set(dateKey, []);
    grouped.get(dateKey)!.push(post);
  }

  const lines: string[] = [];
  lines.push("Content Calendar");
  lines.push("=".repeat(80));

  for (const [date, posts] of grouped) {
    lines.push("");
    lines.push(`--- ${date} ---`);
    for (const p of posts) {
      const time = p.scheduledAt
        ? new Date(p.scheduledAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        : "  --:--  ";
      const plat = pad(PLATFORM_LABELS[p.platform], 12);
      const img = p.imagePath ? " [img]" : "";
      lines.push(`  ${time}  ${statusIcon(p.status)}  ${plat}  ${truncate(p.text.replace(/\n/g, " "), 35)}${img}`);
      lines.push(`  ${" ".repeat(10)}id: ${p.id.slice(0, 8)}`);
    }
  }

  return lines.join("\n");
}
