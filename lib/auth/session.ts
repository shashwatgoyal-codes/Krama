import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  SESSION_COOKIE,
  createSessionToken,
  hashSessionToken,
  sessionExpiry,
  sessionCookieOptions,
  shouldRefresh,
} from "./token";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

/**
 * Issues a session and sets the cookie. The raw token is returned to the
 * browser and immediately forgotten here — only its SHA-256 is stored, so
 * a leaked sessions table can't be replayed as cookies.
 */
export async function createSession(
  userId: string,
  userAgent?: string,
): Promise<void> {
  const token = createSessionToken();
  const expiresAt = sessionExpiry();

  await db.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
      userAgent: userAgent?.slice(0, 255),
    },
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { ...sessionCookieOptions, expires: expiresAt });
}

/**
 * Resolves the cookie to a user, or null. Expired sessions are deleted on
 * sight rather than left to accumulate.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Sliding expiry — an active user is never logged out mid-use.
  if (shouldRefresh(session.expiresAt)) {
    const expiresAt = sessionExpiry();
    await db.session
      .update({ where: { id: session.id }, data: { expiresAt } })
      .catch(() => {});
    jar.set(SESSION_COOKIE, token, {
      ...sessionCookieOptions,
      expires: expiresAt,
    });
  }

  return session.user;
}

/** Signs out this device only. */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session
      .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
      .catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

/** Signs out everywhere — used after a password change or reset. */
export async function destroyAllSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
