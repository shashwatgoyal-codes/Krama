"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import {
  createTask as createTaskRow,
  getTask,
  setTaskStatus,
  deleteTask as deleteTaskRow,
} from "@/lib/repositories/tasks";
import { awardPoints, reverseAward } from "@/lib/scoring/award";
import { dayKeyFor } from "@/lib/day";
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

  const parsed = createTaskSchema.safeParse({
    title: formData.get("title"),
    notes: formData.get("notes") || undefined,
    areaId: formData.get("areaId") || undefined,
    points: formData.get("points") ? Number(formData.get("points")) : undefined,
    recurrence: formData.get("recurrence") || "none",
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const settings = await getSettings(user.id);
  await createTaskRow(user.id, {
    ...parsed.data,
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
export async function currentDayKey(): Promise<string> {
  const user = await requireUserOrThrow();
  const settings = await getSettings(user.id);
  return dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);
}
