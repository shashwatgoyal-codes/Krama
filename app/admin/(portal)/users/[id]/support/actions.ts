"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { ask, SCOPES, type Scope } from "@/lib/admin/support";
import { firstIssue, type ActionResult } from "@/lib/validation";

export async function askForAccess(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();

  const parsed = z
    .object({
      userId: z.string().cuid(),
      reason: z
        .string()
        .trim()
        .min(10, "Say what you need to see and why. They will read this.")
        .max(500),
      scopes: z.array(z.enum(SCOPES as [Scope, ...Scope[]])).min(1, "Pick at least one."),
    })
    .safeParse({
      userId: formData.get("userId"),
      reason: formData.get("reason"),
      scopes: formData.getAll("scopes"),
    });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await ask(actor, parsed.data.userId, parsed.data.scopes, parsed.data.reason);
  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath(`/admin/users/${parsed.data.userId}/support`);
  revalidatePath("/admin/audit");
  return { ok: true };
}
