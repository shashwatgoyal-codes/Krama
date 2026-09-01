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
      user: {
        select: { id: true, email: true, name: true, suspendedAt: true },
      },
    },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Suspending deletes the account's sessions, so this should never fire
  // — it is here for the race where one was created a moment before, and
  // because a suspension enforced in only one place is a suspension with
  // a way around it.
  if (session.user.suspendedAt) {
    await db.session.deleteMany({ where: { userId: session.user.id } }).catch(() => {});
    return null;
  }

  // Sliding expiry — an active user is never logged out mid-use.
  //
  // The database row is the authority on whether a session is still valid,
  // so extending it here is what actually keeps the user signed in. The
  // cookie only needs its browser-side expiry nudged to match, and that
  // write is not always legal: this function runs during page renders too,
  // where Next forbids modifying cookies. Letting that throw would turn
  // every page load after the refresh threshold into a 500, so the write
  // is best-effort here and done properly in proxy.ts, which is allowed to
  // set cookies on every /app request.
  if (shouldRefresh(session.expiresAt)) {
    const expiresAt = sessionExpiry();
    await db.session
      .update({ where: { id: session.id }, data: { expiresAt } })
      .catch(() => {});
    try {
      jar.set(SESSION_COOKIE, token, {
        ...sessionCookieOptions,
        expires: expiresAt,
      });
    } catch {
      // Read-only render context. The proxy re-stamps it instead.
    }
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
