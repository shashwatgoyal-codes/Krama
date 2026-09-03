"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, checkPassword } from "@/lib/auth/password";
import { destroyAllSessions, createSession } from "@/lib/auth/session";
import { checkRateLimit, recordFailure } from "@/lib/repositories/auth-attempts";
import { sendCode } from "@/lib/otp/dispatch";
import { consumeCode } from "@/lib/repositories/verification";
import {
  requestResetSchema,
  resetPasswordSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validation";

/**
 * The reply is the same whether or not an account exists. A forgotten
 * password form that says "no account with that email" is a free
 * membership check for anyone who wants a list of targets — and it costs
 * the honest user nothing to be told the same thing either way.
 */
const SENT = "If that address has an account, a code is on its way.";

async function limiterKey(email: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  return `reset:${ip}:${email}`;
}

export async function requestReset(
  formData: FormData,
): Promise<ActionResult<string>> {
  const parsed = requestResetSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { email } = parsed.data;
  const key = await limiterKey(email);

  // Throttled even for addresses with no account, or the throttle itself
  // becomes the oracle the identical wording was meant to close.
  if (!(await checkRateLimit(key)).allowed) {
    return { ok: false, error: "Too many tries. Wait a few minutes and try again." };
  }
  await recordFailure(key);

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (user) {
    const sent = await sendCode(user, "password_reset");
    // A cooldown or a provider outage is not reported back either — both
    // would distinguish a real address from an invented one.
    if (!sent.ok && sent.reason === "send_failed") {
      console.error("[reset] could not send a code to an existing account");
    }
  }

  return { ok: true, data: SENT };
}

export async function resetPassword(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { email, code, password } = parsed.data;
  const key = await limiterKey(email);

  if (!(await checkRateLimit(key)).allowed) {
    return { ok: false, error: "Too many tries. Wait a few minutes and try again." };
  }

  const strength = checkPassword(password);
  if (!strength.ok) {
    return { ok: false, error: strength.reason, field: "password" };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  // Same message for a wrong address and a wrong code, so this form
  // can't be used to test which addresses are registered either.
  const WRONG = "That code is wrong or too old. Ask for a new one.";

  if (!user) {
    await recordFailure(key);
    return { ok: false, error: WRONG, field: "code" };
  }

  const result = await consumeCode(user.id, "password_reset", code);
  if (!result.ok) {
    await recordFailure(key);
    return {
      ok: false,
      field: "code",
      error:
        result.reason === "locked"
          ? "Too many wrong tries. Ask for a new code."
          : WRONG,
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(password) },
  });

  // Whoever asked for this reset may well be locked out of their own
  // account precisely because someone else is in it. Ending every
  // session is the point of the exercise.
  await destroyAllSessions(user.id);

  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);
  redirect("/app");
}
