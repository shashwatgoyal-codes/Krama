/**
 * Values shared with middleware.
 *
 * Middleware runs on the Edge runtime, which has no `node:crypto`. Keep
 * this file free of Node imports — anything it pulls in ends up in the
 * edge bundle and breaks the build.
 */

export const SESSION_COOKIE = "krama_session";
export const SESSION_TTL_DAYS = 30;

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
