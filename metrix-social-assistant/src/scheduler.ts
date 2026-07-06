import { getPastDue, updatePostStatus } from "./calendar.js";
import { postContent } from "./poster.js";
import { loadCalendar, saveCalendar } from "./store.js";
import { PLATFORM_LABELS } from "./types.js";

export async function runSchedulerLoop(intervalMs = 60_000): Promise<never> {
  process.stderr.write(
    `Social scheduler started. Checking every ${intervalMs / 1000}s for due posts.\n` + `Press Ctrl+C to stop.\n\n`,
  );

  const tick = async (): Promise<void> => {
    const calendar = loadCalendar();
    const due = getPastDue(calendar);

    if (due.length === 0) return;

    process.stderr.write(`[${new Date().toLocaleTimeString()}] ${due.length} post(s) due.\n`);

    for (const post of due) {
      process.stderr.write(`  Posting to ${PLATFORM_LABELS[post.platform]}: "${post.text.slice(0, 50)}..."\n`);

      const result = await postContent(post);

      if (result.ok) {
        updatePostStatus(calendar, post.id, "posted");
        process.stderr.write(`  -> Posted successfully.\n`);
      } else {
        updatePostStatus(calendar, post.id, "failed", result.error);
        process.stderr.write(`  -> FAILED: ${result.error}\n`);
      }
    }

    saveCalendar(calendar);
  };

  await tick();

  while (true) {
    await new Promise((r) => setTimeout(r, intervalMs));
    await tick();
  }
}
