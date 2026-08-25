/**
 * Who may do what in the admin portal.
 *
 * Pure, and separated from everything that touches a session or a
 * database, because this is the actual security boundary — the rules a
 * mistake in would matter most, and the ones easiest to test properly
 * when nothing else has to be running.
 *
 * Three levels and no more. Extra rungs invented before anyone needs
 * them are rungs nobody understands the rules for.
 */

export const LEVELS = ["support", "admin", "owner"] as const;
export type Level = (typeof LEVELS)[number];

/** Higher outranks lower. Only used for comparisons, never stored. */
const RANK: Record<Level, number> = { support: 1, admin: 2, owner: 3 };

export function rank(level: Level): number {
  return RANK[level];
}

export function outranks(actor: Level, other: Level): boolean {
  return RANK[actor] > RANK[other];
}

/**
 * You may only invite someone strictly below you.
 *
 * Two consequences, both intended. An admin cannot create another admin,
 * so the population of people who can act on accounts only ever grows by
 * the owner's decision. And nobody can invite an owner at all — that one
 * comes from SUPER_ADMIN_EMAIL in the environment, so reaching the top
 * needs deploy access rather than a row.
 */
export function canInvite(actor: Level, target: Level): boolean {
  if (target === "owner") return false;
  return outranks(actor, target);
}

/** Which levels an actor is allowed to offer in the invite form. */
export function invitableBy(actor: Level): Level[] {
  return LEVELS.filter((l) => canInvite(actor, l));
}

/** Read the portal at all. */
export function canViewUsers(level: Level): boolean {
  return rank(level) >= RANK.support;
}

/**
 * Act on an account — suspend, force a reset, change a plan.
 * Support is deliberately read-only: most of what an admin is asked to
 * do is answer a question, and that needs no write access at all.
 */
export function canActOnAccounts(level: Level): boolean {
  return rank(level) >= RANK.admin;
}

/** Grant or revoke admin access, and change portal configuration. */
export function canManageAdmins(level: Level): boolean {
  return level === "owner";
}

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

export const LEVEL_LABEL: Record<Level, string> = {
  support: "Support",
  admin: "Admin",
  owner: "Owner",
};

export const LEVEL_BLURB: Record<Level, string> = {
  support: "Read-only. Can see accounts and usage, cannot change anything.",
  admin: "Can act on accounts. Cannot grant admin access.",
  owner: "Everything, including granting access. Set by environment, not here.",
};
