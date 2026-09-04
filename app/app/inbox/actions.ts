"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import { createTask } from "@/lib/repositories/tasks";
import { createNote } from "@/lib/repositories/notes";
import { createLink, findByUrl } from "@/lib/repositories/links";
import {
  capture,
  markTriaged,
  discard,
} from "@/lib/repositories/capture";
import { isCapturable, normaliseCapture } from "@/lib/capture";
import { firstIssue, type ActionResult } from "@/lib/validation";

const textSchema = z.object({
  text: z
    .string()
    .transform(normaliseCapture)
    .refine(isCapturable, "Write something first."),
});

/** The shortcut's only job: get it out of your head and into the app. */
export async function captureText(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = textSchema.safeParse({ text: formData.get("text") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  await capture(user.id, parsed.data.text);
  revalidatePath("/app/inbox");
  revalidatePath("/app");
  return { ok: true };
}

const triageSchema = z.object({
  id: z.string().cuid(),
  text: z.string().transform(normaliseCapture),
  as: z.enum(["task", "note", "link"]),
});

export async function triage(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = triageSchema.safeParse({
    id: formData.get("id"),
    text: formData.get("text"),
    as: formData.get("as"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { id, text, as } = parsed.data;
  if (!isCapturable(text)) return { ok: false, error: "Nothing to file." };

  let resultId: string;
  if (as === "task") {
    const settings = await getSettings(user.id);
    const task = await createTask(user.id, {
      title: text.split("\n")[0].slice(0, 200),
      notes: text.length > 200 ? text : undefined,
      timezone: settings.timezone,
      dayEndsAtHour: settings.dayEndsAtHour,
    });
    resultId = task.id;
  } else if (as === "note") {
    const note = await createNote(user.id, text, "n1");
    resultId = note.id;
  } else {
    // No metadata fetch here. Capture is meant to be instant, and going
    // out to the network at triage time would make filing an item wait
    // on somebody else's server. Explore can enrich it later.
    const url = text.startsWith("http") ? text : `https://${text}`;
    const existing = await findByUrl(user.id, url);
    const link = existing ?? (await createLink(user.id, {
      url,
      title: url.replace(/^https?:\/\//, "").slice(0, 120),
      source: "capture",
    }));
    resultId = link.id;
  }

  // Marked after the thing exists, so a failure leaves the capture in
  // the inbox rather than losing it to a triage that did not happen.
  await markTriaged(user.id, id, as, resultId);

  revalidatePath("/app/inbox");
  revalidatePath("/app");
  return { ok: true };
}

export async function discardCapture(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z.object({ id: z.string().cuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown item." };

  await discard(user.id, parsed.data.id);
  revalidatePath("/app/inbox");
  return { ok: true };
}
