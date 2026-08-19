"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { sendCode } from "@/lib/otp/dispatch";
import { consumeCode } from "@/lib/repositories/verification";
import {
  verifyEmailSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validation";

/**
 * Verification differs from a password reset in one way that matters:
 * the person is already signed in, so there is no account to enumerate
 * and the messages can say what actually went wrong.
 */

export async function sendVerification(): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const fresh = await db.user.findUnique({
    where: { id: user.id },
    select: { emailVerified: true },
  });
  if (fresh?.emailVerified) return { ok: true };

  const sent = await sendCode(user, "email_verify");

  if (!sent.ok) {
    if (sent.reason === "cooldown") {
      const seconds = Math.ceil(sent.retryAfterMs / 1000);
      return { ok: false, error: `A code was just sent. Try again in ${seconds}s.` };
    }
    return { ok: false, error: "Couldn't send the email just now. Try again shortly." };
  }

  return { ok: true };
}

export async function verifyEmail(formData: FormData): Promise<ActionResult> {
  const user = await requireUserOrThrow();

  const parsed = verifyEmailSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const result = await consumeCode(user.id, "email_verify", parsed.data.code);
  if (!result.ok) {
    const message: Record<typeof result.reason, string> = {
      malformed: "The code is six digits.",
      none: "No code is waiting. Send yourself a new one.",
      expired: "That code has expired. Send yourself a new one.",
      locked: "Too many wrong guesses. Send yourself a new one.",
      wrong: "That code isn't right.",
    };
    return { ok: false, field: "code", error: message[result.reason] };
  }

  await db.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date() },
  });

  revalidatePath("/app");
  revalidatePath("/app/verify-email");
  revalidatePath("/app/profile");
  return { ok: true };
}
