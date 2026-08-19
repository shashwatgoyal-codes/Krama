"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { parseTagInput } from "@/lib/tags";
import { setTagsOn } from "@/lib/repositories/tags";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import { createTask } from "@/lib/repositories/tasks";
import {
  createLink,
  updateLink,
  getLink,
  findByUrl,
} from "@/lib/repositories/links";
import { fetchLinkMetadata } from "@/lib/links/fetch";
import { checkUrl } from "@/lib/links/ssrf";
import { firstIssue, type ActionResult } from "@/lib/validation";

function touched() {
  revalidatePath("/app/explore");
  revalidatePath("/app");
}

const idSchema = z.object({ id: z.string().cuid() });

/**
 * Saving a link.
 *
 * The fetch is best-effort by design: if a page can't be read — it's
 * behind a login, it's slow, it dislikes robots — the link is still
 * saved with the host as its title. Refusing to save something because
 * we couldn't draw a thumbnail would lose the thing the user actually
 * wanted to keep.
 */
export async function saveLink(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = z
    .object({ url: z.string().trim().min(1, "Paste a link first.").max(2000) })
    .safeParse({ url: formData.get("url") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  // Judged before any network call, so a private address is never dialled.
  const checked = checkUrl(parsed.data.url);
  if (!checked.ok) return { ok: false, error: checked.reason, field: "url" };

  const already = await findByUrl(user.id, checked.url.href);
  if (already) return { ok: false, error: "That's already saved." };

  const result = await fetchLinkMetadata(checked.url.href);

  if (!result.ok) {
    // A private or unreachable target: refuse the ones that were blocked
    // for safety, keep the ones that merely failed.
    if (result.reason.includes("private")) {
      return { ok: false, error: result.reason, field: "url" };
    }
    await createLink(user.id, {
      url: checked.url.href,
      title: checked.url.hostname.replace(/^www\./, "") + checked.url.pathname,
      source: checked.url.hostname.replace(/^www\./, ""),
    });
    touched();
    return { ok: true };
  }

  const meta = result.metadata;
  await createLink(user.id, {
    url: meta.url,
    title: meta.title?.slice(0, 300) || meta.source,
    description: meta.description,
    imageUrl: meta.imageUrl,
    source: meta.source,
  });

  touched();
  return { ok: true };
}

const detailsSchema = z.object({
  id: z.string().cuid(),
  title: z.string().trim().min(1, "Give it a title.").max(300),
  why: z.string().trim().max(1000).optional(),
  tags: z.string().max(200).optional(),
});

export async function saveLinkDetails(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = detailsSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    why: formData.get("why") ?? undefined,
    tags: formData.get("tags") ?? undefined,
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  // parseTagInput does the splitting, trimming and de-duping, and it is
  // the same function the task, note and event pickers use — so a tag
  // typed on a link and one typed on a task land in the same place.
  const names = parseTagInput(parsed.data.tags ?? "").slice(0, 8);

  const updated = await updateLink(user.id, parsed.data.id, {
    title: parsed.data.title,
    why: parsed.data.why || null,
  });
  if (!updated) return { ok: false, error: "That link no longer exists." };

  await setTagsOn(user.id, "link", parsed.data.id, names);

  touched();
  return { ok: true };
}

export async function toggleRead(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown link." };

  const link = await getLink(user.id, parsed.data.id);
  if (!link) return { ok: false, error: "That link no longer exists." };

  await updateLink(user.id, link.id, { readAt: link.readAt ? null : new Date() });
  touched();
  return { ok: true };
}

export async function archiveLink(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown link." };

  await updateLink(user.id, parsed.data.id, { archivedAt: new Date() });
  touched();
  return { ok: true };
}

/**
 * The step that stops this being a bookmark pile: a saved thing becomes
 * something you've actually committed to doing.
 */
export async function linkToTask(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown link." };

  const link = await getLink(user.id, parsed.data.id);
  if (!link) return { ok: false, error: "That link no longer exists." };
  if (link.taskId) return { ok: false, error: "Already a task." };

  const settings = await getSettings(user.id);
  const task = await createTask(user.id, {
    title: link.title.slice(0, 200),
    // The reason it was saved is the useful part to carry over — it says
    // what to actually do with it.
    notes: [link.why, link.url].filter(Boolean).join("\n\n"),
    timezone: settings.timezone,
    dayEndsAtHour: settings.dayEndsAtHour,
  });

  await updateLink(user.id, link.id, { taskId: task.id });

  touched();
  revalidatePath("/app/tasks");
  return { ok: true };
}
