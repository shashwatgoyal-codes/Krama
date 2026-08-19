import { db } from "@/lib/db";
import { dayKeyToDate } from "@/lib/day";
import { occursOn } from "@/lib/recurrence";

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
