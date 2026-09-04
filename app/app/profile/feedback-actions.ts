"use server";

import { revalidatePath } from "next/cache";
import { requireUserOrThrow } from "@/lib/auth/guard";
import {
  feedbackSchema,
  feedbackIdSchema,
  type ActionResult,
} from "@/lib/validation";
import { sendFeedback, withdrawFeedback } from "@/lib/repositories/feedback";

/**
 * Sending feedback, and taking it back.
 *
 * Separate from the settings actions because it writes to a table the
 * admin portal reads, and that is worth being able to find in one file
 * rather than buried among the preference savers.
 */

export async function submitFeedback(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = feedbackSchema.safeParse({
    kind: formData.get("kind"),
    message: formData.get("message"),
    fromPath: formData.get("fromPath") ?? undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  await sendFeedback({
    userId: user.id,
    kind: parsed.data.kind,
    message: parsed.data.message,
    fromPath: parsed.data.fromPath ?? null,
  });

  revalidatePath("/app/profile");
  return { ok: true };
}

export async function takeBackFeedback(
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUserOrThrow();
  const parsed = feedbackIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { ok: false, error: "Unknown message." };

  const gone = await withdrawFeedback(user.id, parsed.data.id);
  if (!gone) {
    // Either it was never theirs or somebody has already read it. Both
    // mean the same thing here: it is not theirs to take back now.
    return { ok: false, error: "That message has already been read." };
  }

  revalidatePath("/app/profile");
  return { ok: true };
}
