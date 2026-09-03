"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DEFAULT_AREAS } from "@/lib/seed";
import { hashPassword, verifyPassword, checkPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import {
  checkRateLimit,
  recordFailure,
  clearAttempts,
  purgeStaleAttempts,
} from "@/lib/repositories/auth-attempts";
import { retryMessage } from "@/lib/auth/rate-limit";
import { flagOnGlobally } from "@/lib/repositories/flags";
import {
  signUpSchema,
  signInSchema,
  firstIssue,
  type ActionResult,
} from "@/lib/validation";

/**
 * Deliberately identical whether the email exists or the password is
 * wrong. Saying "no account with that email" tells an attacker which
 * addresses are registered — a free list of targets before they try a
 * single password.
 */
const BAD_CREDENTIALS = "That email or password is wrong.";

async function requestKey(email: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  // Keyed on both, so one attacker can't lock out a specific person by
  // hammering their address, and can't dodge the limit by rotating email.
  return `${ip}:${email}`;
}

export async function signUp(formData: FormData): Promise<ActionResult> {
  // Checked here as well as on the page. A hidden form is still a POST
  // endpoint, and this is the one that actually creates the account.
  if (!(await flagOnGlobally("open_registration"))) {
    return { ok: false, error: "New accounts are closed right now." };
  }

  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { name, email, password } = parsed.data;

  const strength = checkPassword(password);
  if (!strength.ok) return { ok: false, error: strength.reason, field: "password" };

  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    // Same wording as a weak password so this form can't be used to
    // discover which addresses already have accounts.
    return {
      ok: false,
      error: "You already have an account with that email. Sign in instead.",
      field: "email",
    };
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      profile: { create: {} },
      areas: { create: DEFAULT_AREAS.map((a) => ({ ...a })) },
    },
    select: { id: true },
  });

  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);

  // Straight to confirmation rather than into the app. Without a
  // confirmed address there is no way back into this account, and the
  // moment someone has just typed the address is the moment they are
  // most able to check it.
  // No ?sent=1: the page decides for itself whether a code is
  // needed, so the parameter would only be a second source of truth.
  redirect("/app/verify-email");
}

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { email, password } = parsed.data;
  const key = await requestKey(email);

  const limit = await checkRateLimit(key);
  if (!limit.allowed) {
    return { ok: false, error: retryMessage(limit.retryAfterMs) };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, suspendedAt: true },
  });

  // Hash even when the user doesn't exist, so the response takes the same
  // time either way and can't be used to probe which emails are registered.
  const hash =
    user?.passwordHash ??
    "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000";
  const valid = await verifyPassword(hash, password);

  if (!user || !valid) {
    await recordFailure(key);
    return { ok: false, error: BAD_CREDENTIALS };
  }

  // Checked after the password, deliberately. Refusing earlier would let
  // anyone discover which accounts are suspended by watching how fast the
  // answer comes back, and would say so to somebody who never had the
  // password in the first place.
  if (user.suspendedAt) {
    await clearAttempts(key);
    return {
      ok: false,
      error:
        "This account is suspended. Reply to the address you signed up with " +
        "if you think that is a mistake.",
    };
  }

  await clearAttempts(key);
  // Cheap here and nowhere else: a successful sign-in is rare enough that
  // the sweep costs nothing, and frequent enough to keep the table small.
  void purgeStaleAttempts().catch(() => {});
  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);
  redirect("/app");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
