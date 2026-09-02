"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { canManageAdmins } from "@/lib/admin/levels";
import { setFlag } from "@/lib/repositories/flags";
import { record } from "@/lib/admin/audit";
import { firstIssue, type ActionResult } from "@/lib/validation";

export async function updateFlag(formData: FormData): Promise<ActionResult> {
  const actor = await requireAdmin();
  // Changing what other people can see is configuration, not an action
  // on an account — so it sits with the super admin, like granting.
  if (!canManageAdmins(actor.level)) {
    return { ok: false, error: "Only a super admin can change flags." };
  }

  const parsed = z
    .object({
      key: z.string().min(1),
      enabled: z.enum(["on", "off"]),
      rollout: z.coerce.number().min(0).max(100),
      reason: z
        .string()
        .trim()
        .min(3, "Say why. It is what makes the log worth keeping.")
        .max(500),
    })
    .safeParse({
      key: formData.get("key"),
      enabled: formData.get("enabled"),
      rollout: formData.get("rollout"),
      reason: formData.get("reason"),
    });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { key, enabled, rollout, reason } = parsed.data;
  const changed = await setFlag(key, { enabled: enabled === "on", rollout }, actor.email);
  if (!changed) return { ok: false, error: "No such flag." };

  await record({
    actor,
    action: "flag.changed",
    target: key,
    reason: `${reason} — now ${enabled === "on" ? `on at ${rollout}%` : "off"}`,
  });

  revalidatePath("/admin/flags");
  revalidatePath("/admin/audit");
  return { ok: true };
}
