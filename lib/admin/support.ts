import { db } from "@/lib/db";
import { supportDb, supportDbConfigured } from "./support-db";
import { record } from "./audit";
import { canActOn } from "./levels";
import { isSuperAdmin, type AdminActor } from "./guard";
import { SCOPE_LABEL, type Scope } from "./scopes";

/**
 * Reading somebody's content, with their permission.
 *
 * Five steps, and the person owns three of them: you ask, they decide,
 * you get a short read-only window, they can see everything you opened,
 * and they can end it whenever they like.
 *
 * Write access does not exist here and is not planned. An admin who
 * could edit somebody's notes would be a worse problem than one who
 * could read them, and every reason for wanting it is better served by
 * telling the person what to change.
 */

export const REQUEST_TTL_HOURS = 168; // a week to notice and decide
export const ACCESS_TTL_HOURS = 24;

export { SCOPES, SCOPE_LABEL, type Scope } from "./scopes";

export type Outcome = { ok: true } | { ok: false; error: string };

/** A request that is approved, unrevoked, and still inside its window. */
export async function liveAccess(adminEmail: string, userId: string, now = new Date()) {
  return db.supportAccess.findFirst({
    where: {
      adminEmail,
      userId,
      approvedAt: { not: null },
      declinedAt: null,
      revokedAt: null,
      accessUntil: { gt: now },
    },
    select: { id: true, scopes: true, accessUntil: true, reason: true },
  });
}

export async function pendingRequest(adminEmail: string, userId: string, now = new Date()) {
  return db.supportAccess.findFirst({
    where: {
      adminEmail,
      userId,
      approvedAt: null,
      declinedAt: null,
      requestExpiresAt: { gt: now },
    },
    select: { id: true, requestExpiresAt: true, scopes: true },
  });
}

/** Everything the account holder should see about who asked for what. */
export async function requestsFor(userId: string) {
  return db.supportAccess.findMany({
    where: { userId },
    orderBy: { requestedAt: "desc" },
    take: 50,
    select: {
      id: true, adminEmail: true, reason: true, scopes: true,
      requestedAt: true, requestExpiresAt: true,
      approvedAt: true, declinedAt: true, accessUntil: true, revokedAt: true,
      views: {
        orderBy: { viewedAt: "desc" },
        select: { id: true, scope: true, count: true, viewedAt: true },
      },
    },
  });
}

export async function ask(
  actor: AdminActor,
  userId: string,
  scopes: Scope[],
  reason: string,
  now = new Date(),
): Promise<Outcome> {
  if (scopes.length === 0) {
    return { ok: false, error: "Choose at least one thing to ask about." };
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, adminRole: { select: { revokedAt: true } } },
  });
  if (!target) return { ok: false, error: "That account no longer exists." };

  const level = isSuperAdmin(target.email)
    ? "superadmin"
    : target.adminRole && target.adminRole.revokedAt === null
      ? "admin"
      : "standard";

  // The same rule as every other action: an admin manages standard
  // accounts. Asking to read another admin's notes is not an exception.
  if (!canActOn(actor.level, level)) {
    await record({
      actor, action: "support.request.refused", target: target.email,
      reason: `${reason} — refused: ${actor.level} may not ask ${level}`,
    });
    return { ok: false, error: "You cannot ask this account for access." };
  }

  if (await pendingRequest(actor.email, userId, now)) {
    return { ok: false, error: "You already have a request waiting with them." };
  }
  if (await liveAccess(actor.email, userId, now)) {
    return { ok: false, error: "You already have access to this account." };
  }

  await db.supportAccess.create({
    data: {
      userId,
      adminEmail: actor.email,
      reason: reason.trim(),
      scopes,
      requestExpiresAt: new Date(now.getTime() + REQUEST_TTL_HOURS * 3_600_000),
    },
  });
  await record({
    actor, action: "support.requested", target: target.email,
    reason: `${reason} — scopes: ${scopes.join(", ")}`,
  });
  return { ok: true };
}

/** The account holder's decision. Taken as the user, never as an admin. */
export async function decide(
  userId: string,
  requestId: string,
  approve: boolean,
  now = new Date(),
): Promise<Outcome> {
  const req = await db.supportAccess.findUnique({
    where: { id: requestId },
    select: { userId: true, adminEmail: true, approvedAt: true, declinedAt: true, requestExpiresAt: true },
  });
  // Ownership is the authorisation. A request id from somebody else's
  // account is simply not found as far as this is concerned.
  if (!req || req.userId !== userId) return { ok: false, error: "That request no longer exists." };
  if (req.approvedAt || req.declinedAt) return { ok: false, error: "You already answered that." };
  if (req.requestExpiresAt <= now) return { ok: false, error: "That request has expired." };

  await db.supportAccess.update({
    where: { id: requestId },
    data: approve
      ? { approvedAt: now, accessUntil: new Date(now.getTime() + ACCESS_TTL_HOURS * 3_600_000) }
      : { declinedAt: now },
  });

  await db.auditLog.create({
    data: {
      actorEmail: req.adminEmail,
      actorLevel: "admin",
      action: approve ? "support.approved" : "support.declined",
      target: req.adminEmail,
      reason: `The account holder ${approve ? "approved" : "declined"} the request`,
    },
  });
  return { ok: true };
}

/** Ending it early. Always available while it is live. */
export async function revoke(userId: string, requestId: string): Promise<Outcome> {
  const req = await db.supportAccess.findUnique({
    where: { id: requestId },
    select: { userId: true, adminEmail: true, revokedAt: true, approvedAt: true },
  });
  if (!req || req.userId !== userId) return { ok: false, error: "That request no longer exists." };
  if (!req.approvedAt) return { ok: false, error: "That was never approved." };
  if (req.revokedAt) return { ok: true };

  await db.supportAccess.update({ where: { id: requestId }, data: { revokedAt: new Date() } });
  await db.auditLog.create({
    data: {
      actorEmail: req.adminEmail, actorLevel: "admin",
      action: "support.revoked", target: req.adminEmail,
      reason: "The account holder ended the access early",
    },
  });
  return { ok: true };
}

export type ViewedContent =
  | { ok: true; scope: Scope; items: { id: string; text: string; at: Date }[] }
  | { ok: false; error: string };

/**
 * The unsealing itself.
 *
 * Everything above is bookkeeping; this is the only function that reads
 * anything a person wrote, and it refuses unless a live consent record
 * names both the account and this exact scope. Every read is written to
 * support_views first, so the person's own settings show what was opened
 * even if the request is revoked a second later.
 */
export async function view(
  actor: AdminActor,
  userId: string,
  scope: Scope,
  now = new Date(),
): Promise<ViewedContent> {
  if (!supportDbConfigured()) {
    return { ok: false, error: "Support access is not configured on this deployment." };
  }

  const access = await liveAccess(actor.email, userId, now);
  if (!access) return { ok: false, error: "You do not have live access to this account." };
  if (!access.scopes.includes(scope)) {
    await record({
      actor, action: "support.view.refused", target: userId,
      reason: `Asked for ${scope}, which is outside the approved scope`,
    });
    return { ok: false, error: `${SCOPE_LABEL[scope]} is not part of what they approved.` };
  }

  const items = await readScope(userId, scope);

  await db.supportView.create({
    data: { accessId: access.id, scope, count: items.length },
  });
  await record({
    actor, action: "support.viewed", target: userId,
    reason: `Opened ${items.length} ${scope} under approved access`,
  });

  return { ok: true, scope, items };
}

/** Each branch names its columns; nothing selects more than it shows. */
async function readScope(userId: string, scope: Scope) {
  const take = 200;
  switch (scope) {
    case "notes": {
      const rows = await supportDb.note.findMany({
        where: { userId }, select: { id: true, body: true, createdAt: true },
        orderBy: { createdAt: "desc" }, take,
      });
      return rows.map((r) => ({ id: r.id, text: r.body, at: r.createdAt }));
    }
    case "tasks": {
      const rows = await supportDb.task.findMany({
        where: { userId }, select: { id: true, title: true, createdAt: true },
        orderBy: { createdAt: "desc" }, take,
      });
      return rows.map((r) => ({ id: r.id, text: r.title, at: r.createdAt }));
    }
    case "events": {
      const rows = await supportDb.event.findMany({
        where: { userId }, select: { id: true, title: true, startsAt: true },
        orderBy: { startsAt: "desc" }, take,
      });
      return rows.map((r) => ({ id: r.id, text: r.title, at: r.startsAt }));
    }
    case "links": {
      const rows = await supportDb.link.findMany({
        where: { userId }, select: { id: true, url: true, savedAt: true },
        orderBy: { savedAt: "desc" }, take,
      });
      return rows.map((r) => ({ id: r.id, text: r.url, at: r.savedAt }));
    }
  }
}
