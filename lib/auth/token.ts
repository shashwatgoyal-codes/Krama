import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "krama_session";
export const SESSION_TTL_DAYS = 30;

/**
 * The session token given to the browser. 32 random bytes, base64url,
 * so it carries no meaning and can't be guessed or derived.
 */
export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Only this ever reaches the database. If the sessions table leaks,
 * the hashes in it can't be replayed as cookies.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare, so timing can't be used to probe a token. */
export function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function sessionExpiry(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + SESSION_TTL_DAYS);
  return d;
}

/** Sliding expiry: refresh once the session is more than halfway through. */
export function shouldRefresh(expiresAt: Date, now: Date = new Date()): boolean {
  const halfLife = (SESSION_TTL_DAYS / 2) * 24 * 60 * 60 * 1000;
  return expiresAt.getTime() - now.getTime() < halfLife;
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
