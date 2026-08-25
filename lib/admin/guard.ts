import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isLevel, type Level } from "./levels";

/**
 * Who is looking at the admin portal, if anyone.
 *
 * Two independent sources, deliberately. The owner comes from
 * SUPER_ADMIN_EMAIL in the environment and has no row anywhere, so
 * database write access alone cannot make one. Everyone else is a row
 * the owner created.
 */

export type AdminActor = { userId: string; email: string; level: Level };

/** Case-insensitive, because email is. Trimmed, because env values are pasted. */
function isOwner(email: string): boolean {
  const configured = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  if (!configured) return false;
  return configured === email.trim().toLowerCase();
}

export async function currentAdmin(): Promise<AdminActor | null> {
  const user = await getSessionUser();
  if (!user) return null;

  if (isOwner(user.email)) {
    return { userId: user.id, email: user.email, level: "owner" };
  }

  const role = await db.adminRole.findUnique({
    where: { userId: user.id },
    select: { level: true, revokedAt: true },
  });
  // A revoked role is not a role. Checked here rather than by deleting
  // the row, so the grant and its revocation both stay on record.
  if (!role || role.revokedAt || !isLevel(role.level)) return null;

  return { userId: user.id, email: user.email, level: role.level };
}

/**
 * Gate for every admin route.
 *
 * Sends a non-admin to /app rather than to a "forbidden" page. Telling
 * someone a portal exists that they cannot reach is an invitation to
 * find out more about it, and the honest answer to "is there an admin
 * area" is one they have no need for.
 */
export async function requireAdmin(): Promise<AdminActor> {
  const actor = await currentAdmin();
  if (!actor) redirect("/app");
  return actor;
}

/** For routes that need more than read access. */
export async function requireLevel(
  allowed: (level: Level) => boolean,
): Promise<AdminActor> {
  const actor = await requireAdmin();
  if (!allowed(actor.level)) redirect("/admin");
  return actor;
}
