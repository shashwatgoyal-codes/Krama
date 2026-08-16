"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { listTags, createTag, deleteTag, recolourTag } from "@/lib/repositories/tags";
import { AREA_COLOURS } from "@/lib/areas";
import { areaBelongsTo } from "@/lib/repositories/areas";
import { updateProfileSettings } from "@/lib/repositories/profile";
import { firstIssue, type ActionResult } from "@/lib/validation";

function touched() {
  revalidatePath("/app/profile");
  revalidatePath("/app/explore");
  revalidatePath("/app/tasks");
}

/**
 * Tags are lower-cased on the way in.
 *
 * "Career" and "career" being two different labels is the failure mode
 * that makes a tag system stop being one, and it happens within a week.
 */
const tagName = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Give the tag a name.")
  .max(32, "Keep a tag under 32 characters.")
  .regex(/^[a-z0-9][a-z0-9 -]*$/, "Letters, numbers, spaces and dashes only.");

export async function addTag(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ name: tagName, colour: z.enum(AREA_COLOURS).default("mut") })
    .safeParse({
      name: formData.get("name"),
      colour: formData.get("colour") ?? "mut",
    });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const existing = await listTags(user.id);
  if (existing.length >= 40) {
    return { ok: false, error: "Forty tags is enough to lose track of." };
  }
  if (existing.some((t) => t.name === parsed.data.name)) {
    return { ok: false, error: "You already have that tag." };
  }

  await createTag(user.id, parsed.data.name, parsed.data.colour);
  touched();
  return { ok: true };
}

export async function removeTag(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ id: z.string().cuid() })
    .safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown tag." };

  await deleteTag(user.id, parsed.data.id);
  touched();
  return { ok: true };
}

/** Where a quick capture lands when no area is picked. */
export async function setDefaultArea(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const raw = formData.get("defaultAreaId");
  const areaId = typeof raw === "string" && raw.length ? raw : null;

  // Proven to be this user's area before it is written.
  if (areaId && !(await areaBelongsTo(user.id, areaId))) {
    return { ok: false, error: "That area doesn't exist." };
  }

  await updateProfileSettings(user.id, { defaultAreaId: areaId });
  touched();
  return { ok: true };
}

/** Cycles a tag through the palette — the design picks a couple out. */
export async function cycleTagColour(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z
    .object({ id: z.string().cuid(), colour: z.enum(AREA_COLOURS) })
    .safeParse({ id: formData.get("id"), colour: formData.get("colour") });
  if (!parsed.success) return { ok: false, error: "Unknown colour." };

  await recolourTag(user.id, parsed.data.id, parsed.data.colour);
  touched();
  return { ok: true };
}
