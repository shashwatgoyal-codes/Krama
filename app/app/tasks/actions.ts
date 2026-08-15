"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import { getTask, updateTaskFields } from "@/lib/repositories/tasks";
import {
  createBlock,
  getBlock,
  moveBlock,
  deleteBlock,
} from "@/lib/repositories/events";
import { zonedTimeToInstant } from "@/lib/time";
import {
  scheduleAtSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validation";

/**
 * The detail panel's actions.
 *
 * Scheduling here is explicit — a date, a time and a length the user
 * picked — rather than the "next free slot today" that the drag
 * shortcut uses. Both exist on purpose: one is fast, this one is exact.
 */

function touched() {
  revalidatePath("/app");
  revalidatePath("/app/tasks");
  revalidatePath("/app/calendar");
}

/** Puts a task on the calendar at a chosen date, time and length. */
export async function scheduleAt(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = scheduleAtSchema.safeParse({
    id: formData.get("id"),
    dayKey: formData.get("dayKey"),
    hour: formData.get("hour"),
    minute: formData.get("minute"),
    durationMinutes: formData.get("durationMinutes"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const task = await getTask(user.id, parsed.data.id);
  if (!task) return { ok: false, error: "That task no longer exists." };

  const settings = await getSettings(user.id);
  const start = zonedTimeToInstant(
    parsed.data.dayKey,
    parsed.data.hour,
    parsed.data.minute,
    settings.timezone,
  );
  const end = new Date(start.getTime() + parsed.data.durationMinutes * 60_000);

  // Re-timing an already-scheduled task moves its block rather than
  // adding a second one, which is what "Reschedule" means.
  const existing = await getTask(user.id, task.id);
  const blockId = formData.get("blockId");
  if (existing && typeof blockId === "string" && blockId) {
    const block = await getBlock(user.id, blockId);
    if (block) {
      await moveBlock(user.id, block.id, start, end);
      touched();
      return { ok: true };
    }
  }

  await createBlock(user.id, {
    title: task.title,
    startsAt: start,
    endsAt: end,
    taskId: task.id,
    areaId: task.areaId ?? undefined,
  });

  touched();
  return { ok: true };
}

/** Takes a task off the calendar without deleting the task. */
export async function clearSchedule(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ blockId: z.string().cuid() })
    .safeParse({ blockId: formData.get("blockId") });
  if (!parsed.success) return { ok: false, error: "Unknown block." };

  await deleteBlock(user.id, parsed.data.blockId);
  touched();
  return { ok: true };
}

const detailsSchema = z.object({
  id: z.string().cuid(),
  notes: z.string().trim().max(2000).optional(),
  // An empty date field means "no due date", not "invalid".
  dueOn: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date."),
  recurrence: z.enum(["none", "daily", "weekdays", "weekly", "monthly"]),
  recurrenceValue: z.coerce.number().int().min(0).max(31).optional(),
});

export async function saveDetails(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = detailsSchema.safeParse({
    id: formData.get("id"),
    notes: formData.get("notes") ?? undefined,
    dueOn: formData.get("dueOn") ?? undefined,
    recurrence: formData.get("recurrence") ?? "none",
    recurrenceValue: formData.get("recurrenceValue") ?? undefined,
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const updated = await updateTaskFields(user.id, parsed.data.id, {
    notes: parsed.data.notes ?? null,
    dueOn: parsed.data.dueOn ? new Date(`${parsed.data.dueOn}T00:00:00.000Z`) : null,
    recurrence: parsed.data.recurrence,
    recurrenceValue:
      parsed.data.recurrence === "weekly" || parsed.data.recurrence === "monthly"
        ? (parsed.data.recurrenceValue ?? null)
        : null,
  });
  if (!updated) return { ok: false, error: "That task no longer exists." };

  touched();
  return { ok: true };
}
