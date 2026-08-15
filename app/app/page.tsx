import { requireUser } from "@/lib/auth/guard";
import { getSettings, getTodayStats } from "@/lib/repositories/profile";
import { listOpenTasks } from "@/lib/repositories/tasks";
import { listDayBlocks, scheduledTaskIds } from "@/lib/repositories/events";
import { listNotes } from "@/lib/repositories/notes";
import { recentLinks } from "@/lib/repositories/links";
import { dayKeyFor } from "@/lib/day";
import { materialiseRecurring } from "@/lib/repositories/recurring";
import { formatDay } from "@/lib/format";
import { formatClock, formatDuration, minutesBetween, totalCommitted } from "@/lib/time";
import { describeRecurrence } from "@/lib/recurrence";
import { POINTS } from "@/lib/points";
import Today from "@/components/Today";
import type { PlanBlockView } from "@/components/plan/Plan";
import type { NoteColour } from "@/lib/notes";

export default async function TodayPage() {
  const user = await requireUser();
  const settings = await getSettings(user.id);
  const dayKey = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);

  // Routines appear on their own — that's the whole point of them. Done
  // on load rather than by a scheduled job so it works without any
  // background infrastructure, and it's idempotent, so opening two tabs
  // doesn't produce two standups.
  await materialiseRecurring(user.id, dayKey);

  const [stats, blocks, open, scheduled, notes, saved] = await Promise.all([
    getTodayStats(user.id),
    listDayBlocks(user.id, dayKey, settings.timezone, settings.dayEndsAtHour),
    listOpenTasks(user.id),
    scheduledTaskIds(user.id, dayKey, settings.timezone, settings.dayEndsAtHour),
    listNotes(user.id),
    recentLinks(user.id, 2),
  ]);

  // Only one block is "next": the first unfinished one. Everything after
  // it is still ahead, and saying so about all of them at once would
  // just be a wall of accent colour.
  const firstOpen = blocks.find((b) => !b.taskDone)?.id;

  const view: PlanBlockView[] = blocks.map((b) => {
    const parts = [
      b.areaName,
      // "recurring, weekdays" reads as one fact; the cadence alone
      // wouldn't say that the block returns on its own.
      b.recurring && b.recurrence
        ? `recurring, ${describeRecurrence(b.recurrence, b.recurrenceValue).toLowerCase()}`
        : null,
      // Only the heaviest tier is worth naming. Labelling every block
      // with its size turns the plan into a scoreboard.
      !b.taskDone && b.points && b.points >= POINTS.deepBlock
        ? "deep block"
        : null,
      b.taskDone ? "done" : null,
      b.taskDone && b.points ? `+${b.points}` : null,
    ].filter(Boolean);

    return {
      id: b.id,
      title: b.title,
      clock: formatClock(b.startsAt, settings.timezone),
      duration: formatDuration(minutesBetween(b.startsAt, b.endsAt)),
      meta: parts.join(" · ") || "No area",
      tone: b.taskDone ? "done" : b.id === firstOpen ? "next" : "later",
      taskId: b.taskId,
    };
  });

  // The right pane is what has no time yet — anything already on the
  // plan would be listed twice.
  const waiting = open
    .filter((t) => !scheduled.has(t.id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      points: t.points,
      done: false,
      recurring: t.recurrence !== "none",
      chip:
        t.recurrence !== "none"
          ? describeRecurrence(t.recurrence, t.recurrenceValue).toLowerCase()
          : undefined,
    }));

  return (
    <Today
      name={user.name}
      day={formatDay(new Date())}
      blocks={view}
      committed={totalCommitted(blocks)}
      waiting={waiting}
      notes={notes.slice(0, 2).map((n) => ({
        id: n.id,
        body: n.body,
        colour: n.colour as NoteColour,
      }))}
      saved={saved.map((l) => ({
        id: l.id,
        title: l.title,
        unread: !l.readAt,
      }))}
      stats={stats}
      showScoring={settings.scoringVisibility !== "hidden"}
    />
  );
}
