"use server";

import { revalidatePath } from "next/cache";
import { resolveUntil, isUntilPreset } from "@/lib/until";
import { parseWeekdays } from "@/lib/recurrence";
import { parseMinute, DEFAULT_ROUTINE_MINUTES } from "@/lib/projection";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import {
  createTask as createTaskRow,
  getTask,
  setTaskStatus,
  deleteTask as deleteTaskRow,
  syncRoutineTimeFromBlock,
} from "@/lib/repositories/tasks";
import { awardPoints, reverseAward } from "@/lib/scoring/award";
import { dayKeyFor } from "@/lib/day";
import { z } from "zod";
import { POINTS } from "@/lib/points";
import {
  nextFreeSlot,
  zonedTimeToInstant,
  hourIn,
  formatClock,
  minutesBetween,
} from "@/lib/time";
import {
  listDayBlocks,
  createBlock,
  deleteBlock,
  moveBlock,
  getBlock,
} from "@/lib/repositories/events";
import {
  createTaskSchema,
  taskIdSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validation";

/**
 * Every action starts with requireUserOrThrow(). The user id it returns
 * is the only one passed to the repository — nothing here ever reads an
 * id out of the form, so a crafted request cannot act on someone else's
 * rows.
 */

export async function createTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const settings = await getSettings(user.id);

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes") || undefined,
    // Falls back to the area chosen in Settings, so a task added in a
    // hurry lands somewhere rather than nowhere.
    areaId: formData.get("areaId") || settings.defaultAreaId || undefined,
    points: formData.get("points") ? Number(formData.get("points")) : undefined,
    recurrence: formData.get("recurrence") || "none",
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const todayKey = dayKeyFor(
    new Date(),
    settings.timezone,
    settings.dayEndsAtHour,
  );
  const untilRaw = String(formData.get("until") ?? "never");
  const untilKey =
    parsed.data.recurrence === "none"
      ? null
      : resolveUntil(
          isUntilPreset(untilRaw) ? untilRaw : "never",
          todayKey,
          formData.get("untilDate")?.toString(),
        );

  await createTaskRow(user.id, {
    ...parsed.data,
    recurrenceDays:
      parsed.data.recurrence === "weekly"
        ? parseWeekdays(formData.get("recurrenceDays")?.toString())
        : [],
    recurrenceUntil: untilKey ? new Date(`${untilKey}T00:00:00.000Z`) : null,
    // Without a time a routine never reaches the calendar, which is the
    // whole reason for setting one up. Only a repeat gets one — a
    // one-off task is scheduled by dragging it, not by a rule.
    routineStartMinute:
      parsed.data.recurrence === "none"
        ? null
        : parseMinute(formData.get("routineTime")?.toString()),
    routineMinutes:
      parsed.data.recurrence === "none"
        ? null
        : Number(formData.get("routineMinutes")) || DEFAULT_ROUTINE_MINUTES,
    timezone: settings.timezone,
    dayEndsAtHour: settings.dayEndsAtHour,
  });

  revalidatePath("/app");
  return { ok: true };
}

/**
 * Completing a task awards points; un-completing appends a reversal.
 * The ledger is append-only, so both stay in the history — which is what
 * makes every total reconstructible from it.
 */
export async function toggleTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = taskIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown task." };

  const task = await getTask(user.id, parsed.data.id);
  // Not theirs, or not there — same answer either way.
  if (!task) return { ok: false, error: "That task no longer exists." };

  const settings = await getSettings(user.id);
  const nextStatus = task.status === "done" ? "open" : "done";
  const countedForDay = task.createdForDate.toISOString().slice(0, 10);

  const updated = await setTaskStatus(user.id, task.id, nextStatus);
  if (!updated) return { ok: false, error: "That task no longer exists." };

  if (nextStatus === "done") {
    await awardPoints({
      userId: user.id,
      sourceType: "task",
      sourceId: task.id,
      basePoints: task.points,
      countedForDay,
      timezone: settings.timezone,
      dayEndsAtHour: settings.dayEndsAtHour,
      dailyFloor: settings.dailyFloor,
      restDays: settings.restDays,
      backdateLimitDays: settings.backdateLimitDays,
    });
  } else {
    await reverseAward({
      userId: user.id,
      sourceType: "task",
      sourceId: task.id,
      countedForDay,
    });
  }

  revalidatePath("/app");
  return { ok: true };
}

export async function deleteTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = taskIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown task." };

  const removed = await deleteTaskRow(user.id, parsed.data.id);
  if (!removed) return { ok: false, error: "That task no longer exists." };

  revalidatePath("/app");
  return { ok: true };
}

/** The day key for the signed-in user, respecting their day boundary. */
/**
 * How long to block out for a task, from what it's worth.
 *
 * A guess, but a defensible one: the point tiers already encode rough
 * effort, so a deep block gets two hours and upkeep gets half of one.
 * The time is editable afterwards, so being slightly wrong costs a drag.
 */
function defaultMinutes(points: number): number {
  if (points >= POINTS.deepBlock) return 120;
  if (points >= POINTS.studySession) return 60;
  if (points >= POINTS.quickTask) return 45;
  return 30;
}

export async function scheduleTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = taskIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown task." };

  const task = await getTask(user.id, parsed.data.id);
  if (!task) return { ok: false, error: "That task no longer exists." };

  const settings = await getSettings(user.id);
  const dayKey = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);
  const blocks = await listDayBlocks(
    user.id,
    dayKey,
    settings.timezone,
    settings.dayEndsAtHour,
  );

  if (blocks.some((b) => b.taskId === task.id)) {
    return { ok: false, error: "That's already on the plan." };
  }

  const slot = nextFreeSlot(blocks, {
    now: new Date(),
    dayKey,
    timeZone: settings.timezone,
    durationMinutes: defaultMinutes(task.points),
  });

  await createBlock(user.id, {
    title: task.title,
    startsAt: slot.start,
    endsAt: slot.end,
    taskId: task.id,
    areaId: task.areaId ?? undefined,
  });

  // A repeat put on the plan is on the plan every time it runs.
  await syncRoutineTimeFromBlock(
    user.id,
    task.id,
    hourIn(slot.start, settings.timezone) * 60 +
      Number(formatClock(slot.start, settings.timezone).slice(3, 5)),
    minutesBetween(slot.start, slot.end),
  );

  revalidatePath("/app");
  revalidatePath("/app/calendar");
  return { ok: true };
}

/**
 * Schedule a task at a time the user actually picked, rather than the
 * next gap. Used when something is dropped onto a specific slot.
 */
export async function scheduleTaskAt(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({
      id: z.string().cuid(),
      dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      hour: z.coerce.number().int().min(0).max(23),
    })
    .safeParse({
      id: formData.get("id"),
      dayKey: formData.get("dayKey"),
      hour: formData.get("hour"),
    });
  if (!parsed.success) return { ok: false, error: "Couldn't schedule that." };

  const task = await getTask(user.id, parsed.data.id);
  if (!task) return { ok: false, error: "That task no longer exists." };

  const settings = await getSettings(user.id);
  const start = zonedTimeToInstant(
    parsed.data.dayKey,
    parsed.data.hour,
    0,
    settings.timezone,
  );

  await createBlock(user.id, {
    title: task.title,
    startsAt: start,
    endsAt: new Date(start.getTime() + defaultMinutes(task.points) * 60_000),
    taskId: task.id,
    areaId: task.areaId ?? undefined,
  });

  // Dropping a repeat on a slot sets the time for the whole series.
  await syncRoutineTimeFromBlock(
    user.id,
    task.id,
    parsed.data.hour * 60,
    defaultMinutes(task.points),
  );

  revalidatePath("/app");
  revalidatePath("/app/calendar");
  return { ok: true };
}

/** Takes it off the plan and puts it back on the waiting list. */
export async function unscheduleBlock(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ id: z.string().cuid() })
    .safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown block." };

  const removed = await deleteBlock(user.id, parsed.data.id);
  if (!removed) return { ok: false, error: "That block no longer exists." };

  revalidatePath("/app");
  revalidatePath("/app/calendar");
  return { ok: true };
}

/** Drag a block to a different hour. Duration is preserved. */
export async function moveBlockToHour(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({
      id: z.string().cuid(),
      dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      hour: z.coerce.number().int().min(0).max(23),
    })
    .safeParse({
      id: formData.get("id"),
      dayKey: formData.get("dayKey"),
      hour: formData.get("hour"),
    });
  if (!parsed.success) return { ok: false, error: "Couldn't move that block." };

  const settings = await getSettings(user.id);
  const block = await getBlock(user.id, parsed.data.id);
  if (!block) return { ok: false, error: "That block no longer exists." };

  const length = block.endsAt.getTime() - block.startsAt.getTime();
  const start = zonedTimeToInstant(
    parsed.data.dayKey,
    parsed.data.hour,
    0,
    settings.timezone,
  );

  await moveBlock(user.id, block.id, start, new Date(start.getTime() + length));

  revalidatePath("/app");
  revalidatePath("/app/calendar");
  return { ok: true };
}

export async function currentDayKey(): Promise<string> {
  const user = await requireUserOrThrow();
  const settings = await getSettings(user.id);
  return dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);
}
