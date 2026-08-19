import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";

/**
 * The single gate. Every page under /app and every server action calls
 * this first — there is no code path that reads data without it.
 *
 * Middleware also checks the cookie, but that only proves a cookie
 * exists. This proves it maps to a live session, and it's the check
 * that actually matters.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * For server actions, which should fail rather than redirect — a redirect
 * mid-action produces a confusing half-completed state.
 */
export async function requireUserOrThrow(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}
