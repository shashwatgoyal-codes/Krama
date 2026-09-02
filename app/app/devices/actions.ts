"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { currentSessionId } from "@/lib/auth/session";
import { endDevice, endOtherDevices } from "@/lib/repositories/sessions";
import type { ActionResult } from "@/lib/validation";

export async function signOutDevice(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = z.object({ id: z.string().cuid() }).safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown device." };

  const result = await endDevice(user.id, parsed.data.id, await currentSessionId());
  if (!result.ok) return { ok: false, error: result.error ?? "Could not sign that out." };

  revalidatePath("/app/devices");
  return { ok: true };
}

/** Used directly as a form action, so it returns nothing. */
export async function signOutOthers(): Promise<void> {
  const user = await requireUserOrThrow();
  await endOtherDevices(user.id, await currentSessionId());
  revalidatePath("/app/devices");
}
