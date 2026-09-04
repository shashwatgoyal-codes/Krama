"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { canManageAdmins } from "@/lib/admin/levels";
import { invite, revokeInvite, revokeAdmin } from "@/lib/admin/invites";
import { firstIssue, type ActionResult } from "@/lib/validation";

/**
 * Every action re-checks the level server-side.
 *
 * The screen already hides what you cannot do, but a hidden form is not
 * a closed door — these are POST endpoints, reachable without the page
 * that renders them.
 */

const reasonSchema = z
  .string()
  .trim()
  .min(3, "Say why you're doing this. It gets saved.")
  .max(500);

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("That doesn't look like an email address."),
  reason: reasonSchema,
});

export async function inviteAdmin(
  formData: FormData,
): Promise<ActionResult<{ token: string; email: string }>> {
  const actor = await requireAdmin();
  if (!canManageAdmins(actor.level)) {
    return { ok: false, error: "Only a super admin can invite." };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await invite(actor, parsed.data.email, "admin", parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/admin/admins");
  return { ok: true, data: { token: result.token, email: result.email } };
}

export async function withdrawInvite(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = z
    .object({ id: z.string().cuid(), reason: reasonSchema })
    .safeParse({ id: formData.get("id"), reason: formData.get("reason") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await revokeInvite(actor, parsed.data.id, parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not withdraw it." };

  revalidatePath("/admin/admins");
  return { ok: true };
}

export async function removeAdmin(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  const parsed = z
    .object({ userId: z.string().cuid(), reason: reasonSchema })
    .safeParse({ userId: formData.get("userId"), reason: formData.get("reason") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await revokeAdmin(actor, parsed.data.userId, parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error ?? "Could not revoke it." };

  revalidatePath("/admin/admins");
  revalidatePath("/admin/users");
  return { ok: true };
}
