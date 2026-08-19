import { redirect } from "next/navigation";
import { getSessionUser } from "./session";

/**
 * Used by /login and /signup. This is the authoritative check — it hits
 * the database, so a cookie whose session no longer exists simply falls
 * through and the sign-in form renders.
 *
 * The proxy can't do this (no database on the Edge runtime), which is
 * exactly why it no longer tries.
 */
export async function redirectIfSignedIn(): Promise<void> {
  const user = await getSessionUser();
  if (user) redirect("/app");
}
