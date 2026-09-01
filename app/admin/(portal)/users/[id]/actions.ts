"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import {
  suspend,
  restore,
  signOutEverywhere,
  promote,
  demote,
  deleteAccount,
} from "@/lib/admin/accounts";
import { firstIssue, type ActionResult } from "@/lib/validation";

/**
 * Each of these re-checks the actor and the target server-side. The
 * screen already hides what you cannot do, but a hidden form is not a
 * closed door — these are POST endpoints reachable without the page.
 */

const schema = z.object({
  userId: z.string().cuid(),
  reason: z
    .string()
    .trim()
    .min(3, "Say why. It is what makes the log worth keeping.")
    .max(500),
});

function refresh(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
}

export async function suspendAccount(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = schema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await suspend(actor, parsed.data.userId, parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error };
  refresh(parsed.data.userId);
  return { ok: true };
}

export async function restoreAccount(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = schema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await restore(actor, parsed.data.userId, parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error };
  refresh(parsed.data.userId);
  return { ok: true };
}

export async function endSessions(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = schema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await signOutEverywhere(actor, parsed.data.userId, parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error };
  refresh(parsed.data.userId);
  return { ok: true };
}

export async function promoteToAdmin(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = schema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await promote(actor, parsed.data.userId, parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error };
  refresh(parsed.data.userId);
  revalidatePath("/admin/admins");
  return { ok: true };
}

export async function demoteToStandard(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = schema.safeParse({
    userId: formData.get("userId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await demote(actor, parsed.data.userId, parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error };
  refresh(parsed.data.userId);
  revalidatePath("/admin/admins");
  return { ok: true };
}

/**
 * Deletion takes the email as its confirmation rather than a checkbox.
 * "Are you sure" is a question people answer without reading; typing the
 * address is a question you cannot answer without looking at it.
 */
export async function removeAccount(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = z
    .object({
      userId: z.string().cuid(),
      confirmation: z.string().trim().min(1, "Type the email address to confirm."),
      reason: z
        .string()
        .trim()
        .min(3, "Say why. It is what makes the log worth keeping.")
        .max(500),
    })
    .safeParse({
      userId: formData.get("userId"),
      confirmation: formData.get("confirmation"),
      reason: formData.get("reason"),
    });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await deleteAccount(
    actor,
    parsed.data.userId,
    parsed.data.confirmation,
    parsed.data.reason,
  );
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/users");
  revalidatePath("/admin/audit");
  redirect("/admin/users");
}
