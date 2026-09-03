"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { retentionSchema, type ActionResult } from "@/lib/validation";
import { updateProfileSettings } from "@/lib/repositories/profile";

/** How long finished tasks are kept. Nothing is deleted here — the sweep
 *  that runs with the day's maintenance reads this setting. */
export async function saveRetention(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = retentionSchema.safeParse({
    keepFinishedDays: formData.get("keepFinishedDays"),
  });
  if (!parsed.success) return { ok: false, error: "Pick one of the options." };

  await updateProfileSettings(user.id, {
    keepFinishedDays: parsed.data.keepFinishedDays,
  });
  revalidatePath("/app/profile");
  return { ok: true };
}
