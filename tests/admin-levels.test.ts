import { describe, it, expect } from "vitest";
import {
  LEVELS,
  rank,
  outranks,
  canInvite,
  invitableBy,
  canViewUsers,
  canActOnAccounts,
  canManageAdmins,
  isLevel,
  LEVEL_LABEL,
  LEVEL_BLURB,
  type Level,
} from "@/lib/admin/levels";

/**
 * The rules that decide who can do what.
 *
 * Worth testing exhaustively rather than by example: there are only nine
 * ordered pairs of levels, so every one can be stated outright, and a
 * privilege rule that is "probably right" is the wrong kind of probably.
 */

const PAIRS: [Level, Level][] = LEVELS.flatMap((a) =>
  LEVELS.map((b) => [a, b] as [Level, Level]),
);

describe("the ladder", () => {
  it("has exactly three rungs", () => {
    expect(LEVELS).toEqual(["support", "admin", "owner"]);
  });

  it("ranks them strictly", () => {
    expect(rank("owner")).toBeGreaterThan(rank("admin"));
    expect(rank("admin")).toBeGreaterThan(rank("support"));
  });

  it("never says a level outranks itself", () => {
    for (const l of LEVELS) expect(outranks(l, l)).toBe(false);
  });

  it("is antisymmetric — both directions cannot be true", () => {
    for (const [a, b] of PAIRS) {
      expect(outranks(a, b) && outranks(b, a)).toBe(false);
    }
  });

  it("is transitive", () => {
    expect(outranks("owner", "admin")).toBe(true);
    expect(outranks("admin", "support")).toBe(true);
    expect(outranks("owner", "support")).toBe(true);
  });
});

describe("who may invite whom", () => {
  it("nobody can invite an owner — that comes from the environment", () => {
    // The whole point of anchoring the owner outside the database: if it
    // could be granted in here, reaching the top would be a row.
    for (const actor of LEVELS) expect(canInvite(actor, "owner")).toBe(false);
  });

  it("nobody can invite their own level", () => {
    for (const l of LEVELS) expect(canInvite(l, l)).toBe(false);
  });

  it("an admin cannot create another admin", () => {
    // So the set of people who can act on accounts only grows by the
    // owner's decision, never sideways.
    expect(canInvite("admin", "admin")).toBe(false);
    expect(canInvite("admin", "support")).toBe(true);
  });

  it("support can invite nobody at all", () => {
    for (const target of LEVELS) expect(canInvite("support", target)).toBe(false);
    expect(invitableBy("support")).toEqual([]);
  });

  it("the owner can invite both lower levels", () => {
    expect(invitableBy("owner")).toEqual(["support", "admin"]);
  });

  it("offers exactly what it permits", () => {
    for (const actor of LEVELS) {
      for (const target of LEVELS) {
        expect(invitableBy(actor).includes(target)).toBe(canInvite(actor, target));
      }
    }
  });

  it("no invitation ever escalates or matches the inviter", () => {
    for (const [actor, target] of PAIRS) {
      if (canInvite(actor, target)) expect(rank(target)).toBeLessThan(rank(actor));
    }
  });
});

describe("what each level may do", () => {
  it("lets every level read the portal", () => {
    for (const l of LEVELS) expect(canViewUsers(l)).toBe(true);
  });

  it("keeps support read-only", () => {
    expect(canActOnAccounts("support")).toBe(false);
    expect(canManageAdmins("support")).toBe(false);
  });

  it("lets admin act but not grant", () => {
    expect(canActOnAccounts("admin")).toBe(true);
    expect(canManageAdmins("admin")).toBe(false);
  });

  it("reserves granting to the owner", () => {
    expect(canManageAdmins("owner")).toBe(true);
    for (const l of LEVELS) {
      if (l !== "owner") expect(canManageAdmins(l)).toBe(false);
    }
  });

  it("gives no permission to a level that lacks the one below it", () => {
    // Monotonic: anything support may do, admin and owner may do too.
    for (const [lower, higher] of [["support", "admin"], ["admin", "owner"]] as [Level, Level][]) {
      for (const can of [canViewUsers, canActOnAccounts, canManageAdmins]) {
        if (can(lower)) expect(can(higher)).toBe(true);
      }
    }
  });
});

describe("isLevel", () => {
  for (const l of LEVELS) {
    it(`accepts ${l}`, () => expect(isLevel(l)).toBe(true));
  }
  for (const bad of ["", "OWNER", "root", "superadmin", "Admin", null, 3, undefined, {}]) {
    it(`rejects ${JSON.stringify(bad)}`, () => expect(isLevel(bad)).toBe(false));
  }
});

describe("labels", () => {
  it("names and describes every level", () => {
    for (const l of LEVELS) {
      expect(LEVEL_LABEL[l].length).toBeGreaterThan(0);
      expect(LEVEL_BLURB[l].length).toBeGreaterThan(0);
    }
  });

  it("says out loud that owner is not granted here", () => {
    expect(LEVEL_BLURB.owner).toMatch(/environment/i);
  });
});
