import { db } from "@/lib/db";
import { record } from "./audit";
import { canActOn, type Level } from "./levels";
import { isSuperAdmin, type AdminActor } from "./guard";

/**
 * Acting on an account.
 *
 * Every function here checks the target's level as well as the actor's.
 * An admin manages standard accounts and nothing else — without the
 * second half, two admins could suspend each other and an admin could
 * suspend the super admin, locking the one person who can undo it out of
 * the portal that undoes it.
 *
 * Nothing here deletes. A suspension is a door held shut, so it can be
 * undone and its reason survives to explain why it happened.
 */

export type Outcome = { ok: true } | { ok: false; error: string };

async function levelOfUser(userId: string): Promise<{ level: Level; email: string } | null> {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, adminRole: { select: { revokedAt: true } } },
  });
  if (!u) return null;
  if (isSuperAdmin(u.email)) return { level: "superadmin", email: u.email };
  const live = u.adminRole && u.adminRole.revokedAt === null;
  return { level: live ? "admin" : "standard", email: u.email };
}

/** Shared gate. Records the refusal, because refusals are the interesting ones. */
async function permitted(
  actor: AdminActor,
  userId: string,
  action: string,
  reason: string,
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const target = await levelOfUser(userId);
  if (!target) return { ok: false, error: "That account no longer exists." };

  if (!canActOn(actor.level, target.level)) {
    await record({
      actor,
      action: `${action}.refused`,
      target: target.email,
      reason: `${reason} — refused: ${actor.level} may not act on ${target.level}`,
    });
    return {
      ok: false,
      error:
        target.level === "superadmin"
          ? "Nobody can act on the super admin from here."
          : "You manage standard accounts. This one is an admin.",
    };
  }
  return { ok: true, email: target.email };
}

export async function suspend(
  actor: AdminActor,
  userId: string,
  reason: string,
): Promise<Outcome> {
  const gate = await permitted(actor, userId, "account.suspend", reason);
  if (!gate.ok) return gate;

  // Sessions go with it. Leaving them alive would mean a suspended
  // account keeps working until its cookie happens to expire, which is
  // up to thirty days of a suspension that did nothing.
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { suspendedAt: new Date(), suspendedReason: reason.trim() },
    }),
    db.session.deleteMany({ where: { userId } }),
  ]);

  await record({ actor, action: "account.suspended", target: gate.email, reason });
  return { ok: true };
}

export async function restore(
  actor: AdminActor,
  userId: string,
  reason: string,
): Promise<Outcome> {
  const gate = await permitted(actor, userId, "account.restore", reason);
  if (!gate.ok) return gate;

  await db.user.update({
    where: { id: userId },
    data: { suspendedAt: null, suspendedReason: null },
  });
  await record({ actor, action: "account.restored", target: gate.email, reason });
  return { ok: true };
}

/**
 * Sign somebody out of everything.
 *
 * The answer to "I left myself signed in somewhere" when the person
 * cannot reach their own settings to do it.
 */
export async function signOutEverywhere(
  actor: AdminActor,
  userId: string,
  reason: string,
): Promise<Outcome> {
  const gate = await permitted(actor, userId, "account.signout", reason);
  if (!gate.ok) return gate;

  const { count } = await db.session.deleteMany({ where: { userId } });
  await record({
    actor,
    action: "account.signed_out",
    target: gate.email,
    reason: `${reason} — ${count} session${count === 1 ? "" : "s"} ended`,
  });
  return { ok: true };
}
