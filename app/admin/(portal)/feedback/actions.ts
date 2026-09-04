"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/guard";
import { record } from "@/lib/admin/audit";
import type { ActionResult } from "@/lib/validation";

/**
 * Acting on feedback.
 *
 * The portal reads through the restricted role, which has SELECT and
 * nothing else. Writes go through the application's own connection after
 * requireAdmin has run — so the read path stays provably incapable of
 * changing anything, and every change here leaves an audit entry.
 *
 * The message itself is never edited. Only what an administrator adds.
 */

const replySchema = z.object({
  id: z.string().cuid(),
  reply: z.string().trim().max(2000),
});

const markSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["new", "read", "done"]),
});

export async function replyToFeedback(
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireAdmin();

  const parsed = replySchema.safeParse({
    id: formData.get("id"),
    reply: formData.get("reply"),
  });
  if (!parsed.success) return { ok: false, error: "That reply won't save." };

  const updated = await db.feedback.updateMany({
    where: { id: parsed.data.id },
    data: {
      reply: parsed.data.reply || null,
      status: "done",
      handledBy: actor.email,
      handledAt: new Date(),
    },
  });
  if (updated.count === 0) return { ok: false, error: "That message is gone." };

  await record({
    actor,
    action: "feedback.replied",
    target: parsed.data.id,
    reason: "Replied to feedback",
  });

  revalidatePath("/admin/feedback");
  return { ok: true };
}

export async function markFeedback(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();

  const parsed = markSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "Unknown message." };

  const updated = await db.feedback.updateMany({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      handledBy: actor.email,
      handledAt: new Date(),
    },
  });
  if (updated.count === 0) return { ok: false, error: "That message is gone." };

  await record({
    actor,
    action: `feedback.${parsed.data.status}`,
    target: parsed.data.id,
    reason: `Marked feedback ${parsed.data.status}`,
  });

  revalidatePath("/admin/feedback");
  return { ok: true };
}
