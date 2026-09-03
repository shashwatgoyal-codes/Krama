import { db } from "@/lib/db";
import { dayKeyToDate } from "@/lib/day";
import { occursOn } from "@/lib/recurrence";
import type { RoutineTemplate } from "@/lib/projection";

/**
 * Materialises today's instances of recurring tasks.
 *
 * Nothing is generated ahead of time. Instances appear on the day they
 * are due and no earlier, so changing a routine never has to rewrite a
 * queue of future rows.
 *
 * A missed day is simply skipped rather than piling up — opening the app
 * on Monday to four days of last week's standups is the fastest way to
 * make someone stop opening it.
 */
export async function materialiseRecurring(
  userId: string,
  dayKey: string,
): Promise<number> {
  const templates = await db.task.findMany({
    where: {
      userId,
      recurrence: { not: "none" },
      recurrenceParentId: null,
    },
    select: {
      id: true,
      title: true,
      notes: true,
      areaId: true,
      points: true,
      recurrence: true,
      recurrenceValue: true,
      recurrenceDays: true,
      recurrenceUntil: true,
    },
  });

  const due = templates.filter((t) =>
    occursOn(
      dayKey,
      t.recurrence,
      t.recurrenceValue,
      // A routine that has ended stops producing work. Without this the
      // instances would keep appearing forever and the end date would be
      // a label rather than a rule.
      t.recurrenceUntil ? t.recurrenceUntil.toISOString().slice(0, 10) : null,
      t.recurrenceDays,
    ),
  );
  if (due.length === 0) return 0;

  // Which of them already have an instance for today?
  const existing = await db.task.findMany({
    where: {
      userId,
      createdForDate: dayKeyToDate(dayKey),
      recurrenceParentId: { in: due.map((t) => t.id) },
    },
    select: { recurrenceParentId: true },
  });
  const alreadyThere = new Set(existing.map((e) => e.recurrenceParentId));

  const missing = due.filter((t) => !alreadyThere.has(t.id));
  if (missing.length === 0) return 0;

  const result = await db.task.createMany({
    data: missing.map((t) => ({
      userId,
      title: t.title,
      notes: t.notes,
      areaId: t.areaId,
      points: t.points,
      // Instances are one-off rows; only the template carries the rule.
      recurrence: "none" as const,
      recurrenceParentId: t.id,
      createdForDate: dayKeyToDate(dayKey),
    })),
    // Safe to call on every page load — two tabs opening at once
    // shouldn't produce two standups.
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * The routine templates that could appear on a calendar range.
 *
 * Only templates — instances are ordinary tasks and already have real
 * blocks if they were scheduled.
 *
 * Untimed routines are included. They used to be filtered out here,
 * which is what made a repeating task with no hour set simply not exist
 * as far as the calendar was concerned. They belong in the all-day band
 * instead: something that happens every Tuesday is on Tuesday whether or
 * not you have decided when.
 */
export async function listRoutineTemplates(
  userId: string,
): Promise<RoutineTemplate[]> {
  const rows = await db.task.findMany({
    where: {
      userId,
      recurrence: { not: "none" },
      recurrenceParentId: null,
      status: { not: "dropped" },
    },
    select: {
      id: true,
      title: true,
      points: true,
      areaId: true,
      recurrence: true,
      recurrenceValue: true,
      recurrenceDays: true,
      recurrenceUntil: true,
      routineStartMinute: true,
      routineMinutes: true,
    },
  });

  return rows.map((r) => ({
    ...r,
    recurrenceUntil: r.recurrenceUntil
      ? r.recurrenceUntil.toISOString().slice(0, 10)
      : null,
  }));
}

/** A routine occurrence that has a real row behind it. */
export type RoutineInstance = {
  id: string;
  templateId: string;
  dayKey: string;
  done: boolean;
};

/**
 * The routine instances that already exist across a range of days.
 *
 * A projected block is a promise that a row will appear on that day. Once
 * the row is there the row is the truth, including whether it was done —
 * so the calendar needs to know which days have one, and stop drawing a
 * ghost over the top of it.
 */
export async function listRoutineInstances(
  userId: string,
  dayKeys: string[],
): Promise<RoutineInstance[]> {
  if (dayKeys.length === 0) return [];

  const rows = await db.task.findMany({
    where: {
      userId,
      recurrenceParentId: { not: null },
      createdForDate: { in: dayKeys.map(dayKeyToDate) },
      status: { not: "dropped" },
    },
    select: {
      id: true,
      status: true,
      createdForDate: true,
      recurrenceParentId: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    templateId: r.recurrenceParentId as string,
    dayKey: r.createdForDate.toISOString().slice(0, 10),
    done: r.status === "done",
  }));
}
