"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { checkAvatar, AVATAR_MAX_BYTES, formatBytes } from "@/lib/images";
import type { ActionResult } from "@/lib/validation";

/**
 * Uploading an avatar.
 *
 * The file is judged by its own bytes, not by what the browser called
 * it, and stored with the type that sniffing produced. Nothing here
 * trusts the filename or the Content-Type.
 */
export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Pick an image first." };
  }

  // Checked before reading, so an enormous file is refused rather than
  // pulled into memory to be measured.
  if (file.size > AVATAR_MAX_BYTES) {
    return {
      ok: false,
      error: `Keep it under ${formatBytes(AVATAR_MAX_BYTES)} — this one is ${formatBytes(file.size)}.`,
    };
  }

  const checked = checkAvatar(await file.arrayBuffer());
  if (!checked.ok) return { ok: false, error: checked.reason };

  await db.user.update({
    where: { id: user.id },
    data: {
      avatar: Buffer.from(checked.bytes),
      avatarType: checked.kind,
      avatarAt: new Date(),
    },
  });

  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true };
}

export async function removeAvatar(): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  await db.user.update({
    where: { id: user.id },
    data: { avatar: null, avatarType: null, avatarAt: null },
  });

  revalidatePath("/app/profile");
  revalidatePath("/app");
  return { ok: true };
}
