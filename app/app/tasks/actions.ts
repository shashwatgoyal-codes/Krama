"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import { getTask, updateTaskFields } from "@/lib/repositories/tasks";
import { areaBelongsTo } from "@/lib/repositories/areas";
import { setTagsOn } from "@/lib/repositories/tags";
import { parseTagInput } from "@/lib/tags";
import { parseWeekdays } from "@/lib/recurrence";
import { dayKeyFor } from "@/lib/day";
import {
  resolveUntil,
  isUntilPreset,
  type UntilPreset,
} from "@/lib/until";
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
  // Empty means unfiled — a real choice, not a missing field.
  areaId: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  notes: z.string().trim().max(2000).optional(),
  // Same 1–30 band the create form uses. Editing this changes what the
  // task will pay next time it is completed; it never rewrites a ledger
  // row that has already been written.
  points: z.coerce.number().int().min(1).max(30).optional(),
  // An empty date field means "no due date", not "invalid".
  dueOn: z
    .string()
    .optional()
    .transform((v) => (v && v.length ? v : null))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), "Pick a date."),
  recurrence: z.enum(["none", "daily", "weekdays", "weekly", "monthly"]),
  recurrenceValue: z.coerce.number().int().min(0).max(31).optional(),
  // "1,2,3" from the picker. Parsed rather than coerced because an
  // empty string means "no days", not "day zero".
  recurrenceDays: z.string().optional(),
  // A comma-separated list of names, not ids: a tag you have just
  // invented has no id yet, and the server is what turns names into rows.
  tags: z.string().max(400).optional(),
  // The preset, not a resolved date: "end of this month" depends on
  // which day the user is on, and only the server knows their timezone.
  until: z.string().optional(),
  untilDate: z.string().optional(),
});

export async function saveDetails(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = detailsSchema.safeParse({
    id: formData.get("id"),
    areaId: formData.get("areaId") ?? undefined,
    notes: formData.get("notes") ?? undefined,
    points: formData.get("points") || undefined,
    dueOn: formData.get("dueOn") ?? undefined,
    recurrence: formData.get("recurrence") ?? "none",
    recurrenceValue: formData.get("recurrenceValue") ?? undefined,
    recurrenceDays: formData.get("recurrenceDays") ?? undefined,
    tags: formData.get("tags") ?? undefined,
    until: formData.get("until") ?? undefined,
    untilDate: formData.get("untilDate") ?? undefined,
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  // Proven to be this user's area before it is written, so a crafted
  // post can't file a task under somebody else's category.
  if (parsed.data.areaId && !(await areaBelongsTo(user.id, parsed.data.areaId))) {
    return { ok: false, error: "That area doesn't exist.", field: "areaId" };
  }

  const settings = await getSettings(user.id);
  const todayKey = dayKeyFor(
    new Date(),
    settings.timezone,
    settings.dayEndsAtHour,
  );

  // An end date only means anything for something that repeats; keeping
  // one on a task set back to "never" would resurrect it if the routine
  // were ever turned on again.
  const untilKey =
    parsed.data.recurrence === "none"
      ? null
      : resolveUntil(
          isUntilPreset(parsed.data.until ?? "") 
            ? (parsed.data.until as UntilPreset)
            : "never",
          todayKey,
          parsed.data.untilDate,
        );

  const weekdays =
    parsed.data.recurrence === "weekly"
      ? parseWeekdays(parsed.data.recurrenceDays)
      : [];

  const updated = await updateTaskFields(user.id, parsed.data.id, {
    recurrenceDays: weekdays,
    recurrenceUntil: untilKey ? new Date(`${untilKey}T00:00:00.000Z`) : null,
    areaId: parsed.data.areaId,
    notes: parsed.data.notes ?? null,
    points: parsed.data.points,
    dueOn: parsed.data.dueOn ? new Date(`${parsed.data.dueOn}T00:00:00.000Z`) : null,
    recurrence: parsed.data.recurrence,
    recurrenceValue:
      parsed.data.recurrence === "weekly" || parsed.data.recurrence === "monthly"
        ? (parsed.data.recurrenceValue ?? null)
        : null,
  });
  if (!updated) return { ok: false, error: "That task no longer exists." };

  // After the row is proven to be this user's, so a crafted post can
  // neither borrow someone else's tag nor label someone else's task.
  await setTagsOn(user.id, "task", parsed.data.id, parseTagInput(parsed.data.tags ?? ""));

  touched();
  return { ok: true };
}
