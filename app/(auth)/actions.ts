"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword, checkPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import {
  checkRateLimit,
  recordFailure,
  clearAttempts,
} from "@/lib/auth/rate-limit";
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
const BAD_CREDENTIALS = "That email or password isn't right.";

async function requestKey(email: string): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
  // Keyed on both, so one attacker can't lock out a specific person by
  // hammering their address, and can't dodge the limit by rotating email.
  return `${ip}:${email}`;
}

export async function signUp(formData: FormData): Promise<ActionResult> {
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
      error: "That email can't be used. Try signing in instead.",
      field: "email",
    };
  }

  const user = await db.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      profile: { create: {} },
      areas: {
        create: [
          { name: "Work", colour: "acc", order: 0 },
          { name: "Learning", colour: "ok", order: 1 },
          { name: "Personal", colour: "warn", order: 2 },
        ],
      },
    },
    select: { id: true },
  });

  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);
  redirect("/app");
}

export async function signIn(formData: FormData): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { ok: false, ...firstIssue(parsed.error) };

  const { email, password } = parsed.data;
  const key = await requestKey(email);

  const limit = checkRateLimit(key);
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterMs / 60000);
    return {
      ok: false,
      error: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    };
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  // Hash even when the user doesn't exist, so the response takes the same
  // time either way and can't be used to probe which emails are registered.
  const hash =
    user?.passwordHash ??
    "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$0000000000000000000000000000000000000000000";
  const valid = await verifyPassword(hash, password);

  if (!user || !valid) {
    recordFailure(key);
    return { ok: false, error: BAD_CREDENTIALS };
  }

  clearAttempts(key);
  const h = await headers();
  await createSession(user.id, h.get("user-agent") ?? undefined);
  redirect("/app");
}

export async function signOut(): Promise<void> {
  await destroySession();
  redirect("/login");
}
