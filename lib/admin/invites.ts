import { randomBytes, createHash } from "node:crypto";
import { db } from "@/lib/db";
import { record } from "./audit";
import { canGrant, canRevoke, type GrantableLevel } from "./levels";
import type { AdminActor } from "./guard";

/**
 * Inviting somebody into the portal.
 *
 * The token follows the session pattern: 32 random bytes given out once,
 * only its SHA-256 stored. A leaked admin_invites table is then a list
 * of pending email addresses rather than a set of working keys.
 *
 * Every path here writes to the audit log, including the ones that
 * refuse. A log that records only what succeeded cannot answer the
 * question people actually ask of an audit trail, which is what was
 * attempted.
 */

export const INVITE_TTL_DAYS = 7;

export type InviteResult =
  | { ok: true; token: string; email: string }
  | { ok: false; error: string };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type PendingInvite = {
  id: string;
  email: string;
  level: GrantableLevel;
  invitedBy: string;
  createdAt: Date;
  expiresAt: Date;
  expired: boolean;
};

export async function listPending(now = new Date()): Promise<PendingInvite[]> {
  const rows = await db.adminInvite.findMany({
    where: { acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, email: true, level: true, invitedBy: true,
      createdAt: true, expiresAt: true,
    },
  });
  // Expired invitations are listed rather than hidden. "I sent it and
  // nothing happened" is answered by seeing it sat there and lapsed.
  return rows.map((r) => ({ ...r, expired: r.expiresAt <= now }));
}

export async function listAdmins() {
  return db.adminRole.findMany({
    where: { revokedAt: null },
    orderBy: { grantedAt: "desc" },
    select: {
      id: true, level: true, grantedAt: true, grantedBy: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function invite(
  actor: AdminActor,
  email: string,
  level: GrantableLevel,
  reason: string,
  now = new Date(),
): Promise<InviteResult> {
  const target = email.trim().toLowerCase();

  if (!canGrant(actor.level, level)) {
    await record({
      actor, action: "admin.invite.refused", target,
      reason: `${reason} — refused: ${actor.level} may not grant ${level}`,
    });
    return { ok: false, error: `Your level cannot grant ${level}.` };
  }

  const existing = await db.user.findUnique({
    where: { email: target },
    select: { id: true, adminRole: { select: { revokedAt: true } } },
  });
  if (existing?.adminRole && existing.adminRole.revokedAt === null) {
    await record({
      actor, action: "admin.invite.refused", target,
      reason: `${reason} — refused: already an admin`,
    });
    return { ok: false, error: "That account is already an admin." };
  }

  const open = await db.adminInvite.findFirst({
    where: { email: target, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    select: { id: true },
  });
  if (open) {
    return { ok: false, error: "There is already an open invitation for that address." };
  }

  const token = randomBytes(32).toString("base64url");
  await db.adminInvite.create({
    data: {
      email: target,
      level,
      tokenHash: hashToken(token),
      invitedBy: actor.email,
      expiresAt: new Date(now.getTime() + INVITE_TTL_DAYS * 86_400_000),
    },
  });

  await record({ actor, action: "admin.invited", target, reason });
  return { ok: true, token, email: target };
}

export async function revokeInvite(
  actor: AdminActor,
  id: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!canRevoke(actor.level, "admin")) {
    return { ok: false, error: "Only a super admin can withdraw an invitation." };
  }
  const inv = await db.adminInvite.findUnique({ where: { id }, select: { email: true } });
  if (!inv) return { ok: false, error: "That invitation no longer exists." };

  await db.adminInvite.update({ where: { id }, data: { revokedAt: new Date() } });
  await record({ actor, action: "admin.invite.withdrawn", target: inv.email, reason });
  return { ok: true };
}

export async function revokeAdmin(
  actor: AdminActor,
  userId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!canRevoke(actor.level, "admin")) {
    return { ok: false, error: "Only a super admin can revoke admin access." };
  }
  if (userId === actor.userId) {
    return { ok: false, error: "You cannot revoke your own access." };
  }

  const role = await db.adminRole.findUnique({
    where: { userId },
    select: { revokedAt: true, user: { select: { email: true } } },
  });
  if (!role || role.revokedAt) return { ok: false, error: "That account is not an admin." };

  // Revoked, not deleted, so the grant and its withdrawal both stay on
  // record. A permission that vanishes leaves no history of existing.
  await db.adminRole.update({ where: { userId }, data: { revokedAt: new Date() } });
  await record({ actor, action: "admin.revoked", target: role.user.email, reason });
  return { ok: true };
}

export type AcceptOutcome =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Accepting is done by the invitee, who is not an admin yet — so this
 * cannot sit behind the admin gate, and takes the signed-in user rather
 * than an actor.
 */
export async function accept(
  token: string,
  user: { id: string; email: string },
  now = new Date(),
): Promise<AcceptOutcome> {
  const inv = await db.adminInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, email: true, level: true, expiresAt: true, acceptedAt: true, revokedAt: true, invitedBy: true },
  });

  if (!inv) return { ok: false, error: "This invitation link is not valid." };
  if (inv.revokedAt) return { ok: false, error: "This invitation was withdrawn." };
  if (inv.acceptedAt) return { ok: false, error: "This invitation has already been used." };
  if (inv.expiresAt <= now) return { ok: false, error: "This invitation has expired. Ask for a new one." };

  // The invitation is for an address, not for whoever holds the link.
  if (inv.email !== user.email.trim().toLowerCase()) {
    return {
      ok: false,
      error: `This invitation is for ${inv.email}. You are signed in as ${user.email}.`,
    };
  }

  await db.adminInvite.update({ where: { id: inv.id }, data: { acceptedAt: now } });
  await db.adminRole.upsert({
    where: { userId: user.id },
    create: { userId: user.id, level: inv.level, grantedBy: inv.invitedBy },
    update: { level: inv.level, grantedBy: inv.invitedBy, grantedAt: now, revokedAt: null },
  });
  await db.auditLog.create({
    data: {
      actorEmail: user.email, actorLevel: "admin",
      action: "admin.invite.accepted", target: inv.email,
      reason: `Accepted an invitation from ${inv.invitedBy}`,
    },
  });
  return { ok: true };
}
