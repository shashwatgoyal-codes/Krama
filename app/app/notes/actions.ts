"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import { createTask } from "@/lib/repositories/tasks";
import { setTagsOn } from "@/lib/repositories/tags";
import { parseTagInput } from "@/lib/tags";
import {
  createNote as createNoteRow,
  updateNote,
  raiseNote,
  archiveNote,
  tidyNotes,
  getNote,
  setNoteTaskId,
} from "@/lib/repositories/notes";
import { NOTE_COLOURS } from "@/lib/notes";
import { firstIssue, type ActionResult } from "@/lib/validation";

/** Every action gates first and only ever uses the session's user id. */

const colourSchema = z.enum(NOTE_COLOURS);

const createSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Write something first.")
    .max(1000, "Keep a note under 1000 characters."),
  colour: colourSchema.default("n1"),
});

const moveSchema = z.object({
  id: z.string().cuid(),
  // Clamped so a note can't be flung somewhere unreachable.
  x: z.coerce.number().int().min(0).max(6000),
  y: z.coerce.number().int().min(0).max(6000),
});

const idSchema = z.object({ id: z.string().cuid() });

export async function createNote(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = createSchema.safeParse({
    body: formData.get("body"),
    colour: formData.get("colour") ?? "n1",
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  await createNoteRow(user.id, parsed.data.body, parsed.data.colour);
  revalidatePath("/app/notes");
  return { ok: true };
}

export async function moveNote(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = moveSchema.safeParse({
    id: formData.get("id"),
    x: formData.get("x"),
    y: formData.get("y"),
  });
  if (!parsed.success) return { ok: false, error: "Couldn't move that note." };

  const { id, x, y } = parsed.data;
  const z = await raiseNote(user.id, id);
  const moved = await updateNote(user.id, id, { x, y, z });
  if (!moved) return { ok: false, error: "That note no longer exists." };

  // No revalidate: the client already has the note where it dropped it,
  // and re-rendering the board mid-drag would fight the user.
  return { ok: true };
}

export async function recolourNote(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ id: z.string().cuid(), colour: colourSchema })
    .safeParse({ id: formData.get("id"), colour: formData.get("colour") });
  if (!parsed.success) return { ok: false, error: "Unknown colour." };

  await updateNote(user.id, parsed.data.id, { colour: parsed.data.colour });
  revalidatePath("/app/notes");
  return { ok: true };
}

export async function editNote(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({
      id: z.string().cuid(),
      body: z.string().trim().min(1, "A note can't be empty.").max(1000),
    })
    .safeParse({ id: formData.get("id"), body: formData.get("body") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const areaId = formData.get("areaId")?.toString() || null;
  await updateNote(user.id, parsed.data.id, {
    body: parsed.data.body,
    // Empty means unfiled — a choice, not a missing value.
    areaId,
  });
  await setTagsOn(
    user.id,
    "note",
    parsed.data.id,
    parseTagInput(String(formData.get("tags") ?? "")),
  );
  revalidatePath("/app/notes");
  return { ok: true };
}

export async function removeNote(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown note." };

  await archiveNote(user.id, parsed.data.id);
  revalidatePath("/app/notes");
  return { ok: true };
}

export async function tidyBoard(): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  await tidyNotes(user.id);
  revalidatePath("/app/notes");
  return { ok: true };
}

/**
 * The connection that makes this more than a scratchpad: a thought
 * becomes something you've actually committed to.
 */
export async function noteToTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown note." };

  const note = await getNote(user.id, parsed.data.id);
  if (!note) return { ok: false, error: "That note no longer exists." };
  if (note.taskId) return { ok: false, error: "Already a task." };

  const settings = await getSettings(user.id);
  const task = await createTask(user.id, {
    // A note can run long; a task title shouldn't.
    title: note.body.split("\n")[0].slice(0, 200),
    notes: note.body.length > 200 ? note.body : undefined,
    timezone: settings.timezone,
    dayEndsAtHour: settings.dayEndsAtHour,
  });

  await setNoteTaskId(user.id, note.id, task.id);

  revalidatePath("/app/notes");
  revalidatePath("/app");
  return { ok: true };
}
