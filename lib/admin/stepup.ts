import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Proving it is still you before the portal opens.
 *
 * The ordinary session lasts thirty days, which is right for a planner
 * and wrong for a portal that can act on other people's accounts. Left
 * as it was, a laptop someone walks up to is an admin portal, because
 * the cookie that gets you into Today is the whole of what gets you into
 * /admin.
 *
 * So entering the portal asks for the password again and issues a
 * separate, short-lived cookie. A stolen session is then not a stolen
 * portal: it does not carry the password, and cannot mint one of these.
 *
 * The cookie holds a random token; its SHA-256 is what the session row
 * is checked against — the same shape as the login session, for the same
 * reason. It is scoped to /admin so it is not even sent with ordinary
 * app requests.
 */

export const STEPUP_COOKIE = "krama_admin_stepup";
export const STEPUP_TTL_MINUTES = 30;

type Payload = { userId: string; expiresAt: number; nonce: string };

/** Signed with SESSION_SECRET so the cookie cannot be forged offline. */
function sign(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET must be set before the admin portal can issue step-up tokens.",
    );
  }
  return createHash("sha256").update(`${secret}:${value}`).digest("hex");
}

export function encode(userId: string, now = Date.now()): string {
  const payload: Payload = {
    userId,
    expiresAt: now + STEPUP_TTL_MINUTES * 60_000,
    nonce: randomBytes(16).toString("base64url"),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Returns the userId the token vouches for, or null.
 *
 * Null for every failure — malformed, wrong signature, expired, or for
 * somebody else. The caller only ever needs to know whether to ask for a
 * password again, and distinguishing the reasons would tell an attacker
 * which part of a forgery was wrong.
 */
export function verify(
  token: string | undefined,
  userId: string,
  now = Date.now(),
): boolean {
  if (!token) return false;
  const [body, mac] = token.split(".");
  if (!body || !mac) return false;

  const expected = sign(body);
  const a = Buffer.from(mac, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  let payload: Payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return false;
  }

  if (typeof payload.userId !== "string" || typeof payload.expiresAt !== "number") {
    return false;
  }
  if (payload.userId !== userId) return false;
  return payload.expiresAt > now;
}

export function remainingMs(token: string | undefined, now = Date.now()): number {
  if (!token) return 0;
  const [body] = token.split(".");
  try {
    const payload: Payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return Math.max(0, payload.expiresAt - now);
  } catch {
    return 0;
  }
}

export async function grant(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(STEPUP_COOKIE, encode(userId), {
    httpOnly: true,
    sameSite: "strict", // stricter than the login cookie: nothing links in
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: STEPUP_TTL_MINUTES * 60,
  });
}

export async function clear(): Promise<void> {
  const jar = await cookies();
  jar.set(STEPUP_COOKIE, "", { path: "/admin", maxAge: 0 });
}

export async function isStepped(userId: string): Promise<boolean> {
  const jar = await cookies();
  return verify(jar.get(STEPUP_COOKIE)?.value, userId);
}
