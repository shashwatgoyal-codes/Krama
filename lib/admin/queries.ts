import { adminDb } from "./db";
import { isSuperAdmin } from "./guard";
import type { Level } from "./levels";

/**
 * Which tier an account is on.
 *
 * Derived rather than stored, because two of the three tiers are not
 * rows: superadmin is an environment variable, standard is the absence
 * of a grant. Reading it back out of one place keeps the table and the
 * badge from ever disagreeing.
 */
function levelOf(email: string, hasLiveGrant: boolean): Level {
  if (isSuperAdmin(email)) return "superadmin";
  return hasLiveGrant ? "admin" : "standard";
}

/**
 * Everything the portal reads.
 *
 * Every query names its columns explicitly. That is not style — the
 * restricted role has no SELECT on content columns, so a findMany
 * without a select would ask for the body of every note and be refused
 * by Postgres. Naming them keeps the failure at the moment someone
 * writes the query rather than the moment a user opens the page.
 */

export type Overview = {
  totalAccounts: number;
  activeSevenDays: number;
  activeThirtyDays: number;
  verifiedAccounts: number;
  signupsFourteenDays: { day: string; count: number }[];
  failedSignins: number;
};

const DAY = 86_400_000;

export async function overview(now = new Date()): Promise<Overview> {
  const sevenAgo = new Date(now.getTime() - 7 * DAY);
  const thirtyAgo = new Date(now.getTime() - 30 * DAY);
  const fourteenAgo = new Date(now.getTime() - 14 * DAY);

  const [totalAccounts, verifiedAccounts, activeSeven, activeThirty, signups, failedSignins] =
    await Promise.all([
      adminDb.user.count(),
      adminDb.user.count({ where: { emailVerified: { not: null } } }),
      // "Active" is a live session, which is the only activity signal
      // available without reading anyone's content.
      adminDb.session.findMany({
        where: { createdAt: { gte: sevenAgo } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      adminDb.session.findMany({
        where: { createdAt: { gte: thirtyAgo } },
        select: { userId: true },
        distinct: ["userId"],
      }),
      adminDb.user.findMany({
        where: { createdAt: { gte: fourteenAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      adminDb.authAttempt.count({ where: { lockedUntil: { not: null } } }),
    ]);

  const byDay = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    byDay.set(new Date(now.getTime() - i * DAY).toISOString().slice(0, 10), 0);
  }
  for (const s of signups) {
    const key = s.createdAt.toISOString().slice(0, 10);
    if (byDay.has(key)) byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  return {
    totalAccounts,
    verifiedAccounts,
    activeSevenDays: activeSeven.length,
    activeThirtyDays: activeThirty.length,
    signupsFourteenDays: [...byDay].map(([day, count]) => ({ day, count })),
    failedSignins,
  };
}

export type UserRow = {
  id: string;
  email: string;
  name: string;
  verified: boolean;
  joined: Date;
  lastSeen: Date | null;
  items: number;
  level: Level;
};

/**
 * The account list.
 *
 * `items` is a count. What those items say is not available here and
 * cannot be made available by changing this file — the grant is what
 * decides that, not the select.
 */
export async function listUsers(query?: string): Promise<UserRow[]> {
  const where = query?.trim()
    ? {
        OR: [
          { email: { contains: query.trim(), mode: "insensitive" as const } },
          { name: { contains: query.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};

  const users = await adminDb.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      _count: { select: { tasks: true, notes: true, events: true, links: true } },
      sessions: {
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      adminRole: { select: { revokedAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    verified: u.emailVerified !== null,
    joined: u.createdAt,
    lastSeen: u.sessions[0]?.createdAt ?? null,
    items: u._count.tasks + u._count.notes + u._count.events + u._count.links,
    level: levelOf(u.email, Boolean(u.adminRole) && u.adminRole?.revokedAt === null),
  }));
}

export type AccountDetail = UserRow & {
  suspendedAt: Date | null;
  suspendedReason: string | null;
  grantedAt: Date | null;
  grantedBy: string | null;
  timezone: string | null;
  breakdown: { tasks: number; notes: number; events: number; links: number };
  liveSessions: number;
};

export async function accountDetail(id: string): Promise<AccountDetail | null> {
  const u = await adminDb.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      emailVerified: true,
      createdAt: true,
      suspendedAt: true,
      suspendedReason: true,
      profile: { select: { timezone: true } },
      _count: { select: { tasks: true, notes: true, events: true, links: true } },
      sessions: {
        select: { createdAt: true, expiresAt: true },
        orderBy: { createdAt: "desc" },
      },
      adminRole: { select: { revokedAt: true, grantedAt: true, grantedBy: true } },
    },
  });
  if (!u) return null;

  const now = new Date();
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    verified: u.emailVerified !== null,
    joined: u.createdAt,
    lastSeen: u.sessions[0]?.createdAt ?? null,
    items: u._count.tasks + u._count.notes + u._count.events + u._count.links,
    level: levelOf(u.email, Boolean(u.adminRole) && u.adminRole?.revokedAt === null),
    suspendedAt: u.suspendedAt,
    suspendedReason: u.suspendedReason,
    grantedAt: u.adminRole?.revokedAt === null ? (u.adminRole?.grantedAt ?? null) : null,
    grantedBy: u.adminRole?.revokedAt === null ? (u.adminRole?.grantedBy ?? null) : null,
    timezone: u.profile?.timezone ?? null,
    breakdown: {
      tasks: u._count.tasks,
      notes: u._count.notes,
      events: u._count.events,
      links: u._count.links,
    },
    liveSessions: u.sessions.filter((s) => s.expiresAt > now).length,
  };
}

export type AuditRow = {
  id: string;
  actorEmail: string;
  actorLevel: string;
  action: string;
  target: string | null;
  reason: string;
  createdAt: Date;
};

/**
 * The audit trail.
 *
 * Read through the restricted connection like everything else, which
 * also means the portal cannot edit its own history even by accident —
 * that role has no UPDATE or DELETE anywhere, and the table refuses both
 * regardless of who asks.
 */
export async function auditTrail(
  filter?: { actor?: string; action?: string },
  take = 200,
): Promise<AuditRow[]> {
  const where: Record<string, unknown> = {};
  if (filter?.actor?.trim()) {
    where.actorEmail = { contains: filter.actor.trim(), mode: "insensitive" };
  }
  if (filter?.action?.trim()) {
    where.action = { startsWith: filter.action.trim() };
  }

  return adminDb.auditLog.findMany({
    where,
    select: {
      id: true, actorEmail: true, actorLevel: true,
      action: true, target: true, reason: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** The distinct action names present, for the filter. */
export async function auditActions(): Promise<string[]> {
  const rows = await adminDb.auditLog.findMany({
    select: { action: true },
    distinct: ["action"],
    orderBy: { action: "asc" },
  });
  return rows.map((r) => r.action);
}
