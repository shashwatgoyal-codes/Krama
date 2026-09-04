"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { decide, revoke } from "@/lib/admin/support";
import { firstIssue, type ActionResult } from "@/lib/validation";

/**
 * The account holder's side. Takes the session user and never an actor —
 * the whole point is that this decision is not an admin's to make.
 */

const idSchema = z.object({ id: z.string().cuid() });

export async function approveRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await decide(user.id, parsed.data.id, true);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/app/access");
  revalidatePath("/app");
  return { ok: true };
}

export async function declineRequest(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await decide(user.id, parsed.data.id, false);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/app/access");
  revalidatePath("/app");
  return { ok: true };
}

export async function revokeAccess(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = idSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await revoke(user.id, parsed.data.id);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/app/access");
  revalidatePath("/app");
  return { ok: true };
}
