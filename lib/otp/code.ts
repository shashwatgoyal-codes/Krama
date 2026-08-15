import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * One-time codes for password reset and email verification.
 *
 * Six digits is a million possibilities — small enough that the storage
 * has to carry the weight, not the code. Three things do that:
 *
 *   - Stored as an HMAC keyed with SESSION_SECRET, not a bare hash. A
 *     plain SHA-256 of six digits is a rainbow table you could build on
 *     a laptop over lunch; without the server-side key, a leaked
 *     verification_codes table is useless on its own.
 *   - The user id and purpose are inside the HMAC, so a reset code can
 *     never be replayed as a verification code, or against another
 *     account.
 *   - Short life and a hard attempt ceiling, enforced in the database.
 */

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
/** Wrong guesses before the code is burnt and a new one is required. */
export const MAX_CODE_ATTEMPTS = 5;

export type CodePurpose = "password_reset" | "email_verify";

function pepper(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    // Loud on purpose. Falling back to an empty key would leave the
    // codes effectively unhashed while looking entirely fine.
    throw new Error(
      "SESSION_SECRET must be set (32+ random bytes) before one-time codes can be issued.",
    );
  }
  return secret;
}

/**
 * Uniform across all 10^6 values. randomInt rejects biased samples
 * internally, which a naive `random() * range` does not.
 */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

export function hashCode(
  code: string,
  userId: string,
  purpose: CodePurpose,
): string {
  return createHmac("sha256", pepper())
    .update(`${purpose}:${userId}:${code}`)
    .digest("hex");
}

/** Constant-time, so a wrong code can't be narrowed down by timing. */
export function codesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function codeExpiry(from = new Date()): Date {
  return new Date(from.getTime() + CODE_TTL_MINUTES * 60_000);
}

/** Digits only, exactly the right length. Spaces are forgiven. */
export function normaliseCode(input: string): string {
  return input.replace(/\D/g, "").slice(0, CODE_LENGTH);
}

export function isWellFormed(code: string): boolean {
  return new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code);
}
