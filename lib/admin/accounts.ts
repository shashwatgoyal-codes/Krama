import { db } from "@/lib/db";
import { record } from "./audit";
import { canActOn, canManageAdmins, type Level } from "./levels";
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

/**
 * Promoting a standard account to admin, without an invitation.
 *
 * The invitation flow exists for someone who is not here yet. This is
 * for an account already in front of you — the same grant, reached by a
 * different door, and recorded the same way.
 *
 * Super admin only, and it cannot mint another super admin: that level
 * has no row to write, which is the whole reason it lives in the
 * environment.
 */
export async function promote(
  actor: AdminActor,
  userId: string,
  reason: string,
): Promise<Outcome> {
  if (!canManageAdmins(actor.level)) {
    return { ok: false, error: "Only a super admin can change what someone is." };
  }
  const target = await levelOfUser(userId);
  if (!target) return { ok: false, error: "That account no longer exists." };

  if (target.level !== "standard") {
    return { ok: false, error: `That account is already ${target.level}.` };
  }

  await db.adminRole.upsert({
    where: { userId },
    create: { userId, level: "admin", grantedBy: actor.email },
    update: { level: "admin", grantedBy: actor.email, grantedAt: new Date(), revokedAt: null },
  });
  await record({ actor, action: "admin.granted", target: target.email, reason });
  return { ok: true };
}

/** Taking admin back, leaving an ordinary account behind. */
export async function demote(
  actor: AdminActor,
  userId: string,
  reason: string,
): Promise<Outcome> {
  if (!canManageAdmins(actor.level)) {
    return { ok: false, error: "Only a super admin can change what someone is." };
  }
  if (userId === actor.userId) {
    return { ok: false, error: "You cannot demote yourself." };
  }
  const target = await levelOfUser(userId);
  if (!target) return { ok: false, error: "That account no longer exists." };
  if (target.level === "superadmin") {
    return {
      ok: false,
      error: "The super admin comes from the environment. Change SUPER_ADMIN_EMAIL instead.",
    };
  }
  if (target.level !== "admin") return { ok: false, error: "That account is not an admin." };

  await db.adminRole.update({ where: { userId }, data: { revokedAt: new Date() } });
  await record({ actor, action: "admin.revoked", target: target.email, reason });
  return { ok: true };
}

/**
 * Deleting an account and everything in it.
 *
 * The one irreversible thing in the portal, so it is the one with the
 * most in front of it: super admin only, never yourself, never another
 * super admin, and the typed reason has to be the account's email rather
 * than free text — the same shape as a repository-deletion confirmation,
 * because "are you sure" is a question people answer without reading.
 *
 * The audit row is written before the delete and holds the email as a
 * plain string, so the record of the deletion outlives the account. The
 * ledger's append-only trigger is lifted transaction-locally, the way
 * self-deletion does it, since the rows are going with their owner.
 */
export async function deleteAccount(
  actor: AdminActor,
  userId: string,
  confirmation: string,
  reason: string,
): Promise<Outcome> {
  if (!canManageAdmins(actor.level)) {
    return { ok: false, error: "Only a super admin can delete an account." };
  }
  if (userId === actor.userId) {
    return {
      ok: false,
      error: "You cannot delete your own account from here. Use your profile.",
    };
  }

  const target = await levelOfUser(userId);
  if (!target) return { ok: false, error: "That account no longer exists." };
  if (target.level === "superadmin") {
    return { ok: false, error: "The super admin cannot be deleted from here." };
  }

  if (confirmation.trim().toLowerCase() !== target.email.toLowerCase()) {
    await record({
      actor,
      action: "account.delete.refused",
      target: target.email,
      reason: `${reason} — refused: confirmation did not match`,
    });
    return { ok: false, error: `Type ${target.email} exactly to confirm.` };
  }

  // Recorded first. If the delete fails the log has an attempt that did
  // not happen, which is recoverable; the other order risks a deletion
  // with nothing saying who did it.
  await record({ actor, action: "account.deleted", target: target.email, reason });

  await db.$transaction([
    db.$executeRaw`SELECT set_config('krama.allow_ledger_delete', 'on', true)`,
    db.$executeRaw`DELETE FROM users WHERE id = ${userId}`,
  ]);
  return { ok: true };
}
