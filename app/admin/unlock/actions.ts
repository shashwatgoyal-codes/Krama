"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { currentAdmin } from "@/lib/admin/guard";
import { canOpenPortal } from "@/lib/admin/levels";
import { grant } from "@/lib/admin/stepup";
import { record } from "@/lib/admin/audit";
import {
  checkRateLimit,
  recordFailure,
  clearAttempts,
} from "@/lib/repositories/auth-attempts";
import { retryMessage } from "@/lib/auth/rate-limit";
import type { ActionResult } from "@/lib/validation";

/**
 * Unlocking the portal.
 *
 * Throttled through the same limiter as sign-in, on its own key. Without
 * it this screen would be an unlimited password oracle against an
 * account already known to be an admin — a better target than the login
 * form, because the attacker knows the guess is worth making.
 *
 * Both outcomes are recorded. A failed unlock is exactly the event
 * somebody would go looking for afterwards.
 */
export async function unlock(formData: FormData): Promise<ActionResult> {
  const actor = await currentAdmin();
  if (!actor || !canOpenPortal(actor.level)) redirect("/app");

  const parsed = z
    .object({ password: z.string().min(1), next: z.string().optional() })
    .safeParse({
      password: formData.get("password"),
      next: formData.get("next"),
    });
  if (!parsed.success) return { ok: false, error: "Enter your password." };

  const key = `admin-unlock:${actor.userId}`;
  const limit = await checkRateLimit(key);
  if (!limit.allowed) {
    await record({
      actor,
      action: "admin.unlock.refused",
      target: actor.email,
      reason: "Too many failed unlock attempts",
    });
    return { ok: false, error: retryMessage(limit.retryAfterMs) };
  }

  const user = await db.user.findUnique({
    where: { id: actor.userId },
    select: { passwordHash: true },
  });
  const valid = user
    ? await verifyPassword(user.passwordHash, parsed.data.password)
    : false;

  if (!valid) {
    await recordFailure(key);
    await record({
      actor,
      action: "admin.unlock.refused",
      target: actor.email,
      reason: "Wrong password at the portal unlock",
    });
    return { ok: false, error: "That password is not right." };
  }

  await clearAttempts(key);
  await grant(actor.userId);
  await record({
    actor,
    action: "admin.unlocked",
    target: actor.email,
    reason: "Confirmed password to open the portal",
  });

  const next = parsed.data.next;
  redirect(next && next.startsWith("/admin") ? next : "/admin");
}
