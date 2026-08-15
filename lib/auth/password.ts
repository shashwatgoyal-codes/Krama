import { hash, verify } from "@node-rs/argon2";

// Argon2id, memory-hard so GPUs don't help an attacker much.
// These are OWASP's current minimums, not defaults.
const OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * A small blocklist of passwords that pass a length check but are
 * trivially guessable. The real defence is length plus a breach check;
 * this catches the laziest cases before we ever hash them.
 */
const COMMON = new Set([
  "password123",
  "12345678910",
  "qwertyuiop123",
  "letmein12345",
  "iloveyou1234",
  "adminadmin12",
  "welcome12345",
  "krama1234567",
]);

export type PasswordCheck =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Validated before hashing. Deliberately no character-class rules —
 * they push people toward predictable patterns like "Password1!"
 * without adding real strength. Length does the work.
 */
export function checkPassword(password: string): PasswordCheck {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return {
      ok: false,
      reason: `Keep it under ${MAX_PASSWORD_LENGTH} characters.`,
    };
  }
  if (COMMON.has(password.toLowerCase())) {
    return { ok: false, reason: "That password is too easy to guess." };
  }
  return { ok: true };
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/**
 * Returns false rather than throwing on a malformed hash, so a corrupt
 * row can't turn into a 500 on the sign-in path.
 */
export async function verifyPassword(
  storedHash: string,
  password: string,
): Promise<boolean> {
  try {
    return await verify(storedHash, password);
  } catch {
    return false;
  }
}
