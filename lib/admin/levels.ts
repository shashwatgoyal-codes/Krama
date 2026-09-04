/**
 * The three tiers.
 *
 *   standard  < admin < superadmin
 *
 * `standard` is everyone with a Krama account and no admin access — the
 * overwhelming majority, and deliberately not a row in any table. Making
 * it an absence rather than a record means a new account is powerless by
 * default rather than by remembering to write the right value, and there
 * is no row to corrupt into something more.
 *
 * `superadmin` is likewise not a row. It is whoever matches
 * SUPER_ADMIN_EMAIL in the environment, so reaching the top needs deploy
 * access rather than a SQL UPDATE. A role table that can mint its own
 * root is not a boundary.
 *
 * That leaves exactly one grantable level, `admin`, which is the only
 * value the database enum holds. A read-only tier between standard and
 * admin would be useful for someone who answers questions without the
 * power to change anything; adding it later is ALTER TYPE plus a rule,
 * so nothing here forecloses it.
 *
 * Kept pure, and away from anything holding a session or a connection,
 * because this is the actual security boundary — the rules a mistake in
 * would matter most, and the ones easiest to test properly when nothing
 * else has to be running.
 */

export const LEVELS = ["standard", "admin", "superadmin"] as const;
export type Level = (typeof LEVELS)[number];

/** The only level that exists as a row. */
export const GRANTABLE = ["admin"] as const;
export type GrantableLevel = (typeof GRANTABLE)[number];

const RANK: Record<Level, number> = { standard: 0, admin: 1, superadmin: 2 };

export function rank(level: Level): number {
  return RANK[level];
}

export function outranks(actor: Level, other: Level): boolean {
  return RANK[actor] > RANK[other];
}

/** May this person open the portal at all? */
export function canOpenPortal(level: Level): boolean {
  return rank(level) >= RANK.admin;
}

/**
 * Whether this level can act on accounts at all.
 *
 * Necessary but not sufficient — see canActOn, which also asks who is
 * being acted on. Use this only for "should the actions panel exist",
 * never to decide a specific action.
 */
export function canActOnAccounts(level: Level): boolean {
  return rank(level) >= RANK.admin;
}

/**
 * Whether this actor may act on *this* account.
 *
 * An admin manages standard accounts and nothing else. Without the
 * second half of that rule, two admins could suspend each other, and an
 * admin could suspend the superadmin — locking the one person who can
 * undo it out of the portal that undoes it.
 *
 * A superadmin may act on anyone below them, which is everyone. Not on
 * themselves: an account that can suspend itself is a way to lose the
 * only key.
 */
export function canActOn(actor: Level, target: Level): boolean {
  if (!canActOnAccounts(actor)) return false;
  if (actor === "superadmin") return target !== "superadmin";
  return target === "standard";
}

/** Grant or revoke admin access, and change portal configuration. */
export function canManageAdmins(level: Level): boolean {
  return level === "superadmin";
}

/**
 * You may only grant strictly below yourself, and never the top.
 *
 * Two consequences, both intended. An admin cannot create another admin,
 * so the population of people who can act on accounts only ever grows by
 * the superadmin's decision. And nobody can grant superadmin at all,
 * because it does not live here to be granted.
 */
export function canGrant(actor: Level, target: Level): boolean {
  if (target === "superadmin") return false;
  if (target === "standard") return false; // that is a revocation, not a grant
  return outranks(actor, target) && canManageAdmins(actor);
}

/** Which levels an actor may offer when inviting. */
export function grantableBy(actor: Level): Level[] {
  return LEVELS.filter((l) => canGrant(actor, l));
}

/** Taking access away. Revoking your own is refused — see the comment. */
export function canRevoke(actor: Level, target: Level): boolean {
  if (!canManageAdmins(actor)) return false;
  // Nobody can revoke a superadmin, including themselves: the only way
  // out of that seat is changing the environment variable, which is the
  // same door it was entered by.
  return target === "admin";
}

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

export function isGrantable(value: unknown): value is GrantableLevel {
  return typeof value === "string" && (GRANTABLE as readonly string[]).includes(value);
}

export const LEVEL_LABEL: Record<Level, string> = {
  standard: "Standard",
  admin: "Admin",
  superadmin: "Super admin",
};

export const LEVEL_BLURB: Record<Level, string> = {
  standard: "An ordinary account. No access to the admin portal.",
  admin: "Can open the portal and act on accounts. Cannot grant access.",
  superadmin: "Everything, including granting access. Set by environment, not here.",
};

/** For the badge in the users table — standard is unstyled on purpose. */
export const LEVEL_STYLE: Record<Level, string> = {
  standard: "text-mut",
  admin: "border-acc bg-acc-soft text-acc",
  superadmin: "border-warn bg-warn-soft text-warn",
};
