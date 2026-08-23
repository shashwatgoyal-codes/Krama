import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";

/**
 * The front door, which is now a doorway rather than a room.
 *
 * There used to be a landing page here — a heading, a paragraph and a
 * button that said "Open the app". For a product nobody has heard of
 * that page earns its place; for a personal planner it is one click
 * between you and the thing you came to do, every single time.
 *
 * So it decides instead. This is the authoritative check — it reads the
 * session from the database, so a cookie whose session has since been
 * revoked lands on /login rather than bouncing into /app and back out.
 * The proxy cannot do this, having no database on the Edge runtime.
 */
export default async function Root(): Promise<never> {
  const user = await getSessionUser();
  redirect(user ? "/app" : "/login");
}
