import { describe, it, expect } from "vitest";
import {
  LEVELS,
  GRANTABLE,
  rank,
  outranks,
  canOpenPortal,
  canActOnAccounts,
  canActOn,
  canManageAdmins,
  canGrant,
  canRevoke,
  grantableBy,
  isLevel,
  isGrantable,
  LEVEL_LABEL,
  LEVEL_BLURB,
  LEVEL_STYLE,
  type Level,
} from "@/lib/admin/levels";

/**
 * standard < admin < superadmin.
 *
 * Stated exhaustively rather than by example: there are nine ordered
 * pairs, so every one can be written down, and a privilege rule that is
 * probably right is the wrong kind of probably.
 */

const PAIRS: [Level, Level][] = LEVELS.flatMap((a) =>
  LEVELS.map((b) => [a, b] as [Level, Level]),
);

describe("the ladder", () => {
  it("has exactly three rungs, in order", () => {
    expect(LEVELS).toEqual(["standard", "admin", "superadmin"]);
  });

  it("ranks them strictly", () => {
    expect(rank("superadmin")).toBeGreaterThan(rank("admin"));
    expect(rank("admin")).toBeGreaterThan(rank("standard"));
  });

  it("gives standard a rank of zero — the absence of power, not a little of it", () => {
    expect(rank("standard")).toBe(0);
  });

  it("never says a level outranks itself", () => {
    for (const l of LEVELS) expect(outranks(l, l)).toBe(false);
  });

  it("is antisymmetric", () => {
    for (const [a, b] of PAIRS) expect(outranks(a, b) && outranks(b, a)).toBe(false);
  });

  it("stores only the middle rung", () => {
    // standard is the absence of a row; superadmin is an environment
    // variable. Neither can be written into the table.
    expect(GRANTABLE).toEqual(["admin"]);
    expect(isGrantable("admin")).toBe(true);
    expect(isGrantable("superadmin")).toBe(false);
    expect(isGrantable("standard")).toBe(false);
  });
});

describe("who may open the portal", () => {
  it("keeps standard out entirely", () => {
    expect(canOpenPortal("standard")).toBe(false);
    expect(canActOnAccounts("standard")).toBe(false);
    expect(canManageAdmins("standard")).toBe(false);
  });

  it("lets admin in, and act", () => {
    expect(canOpenPortal("admin")).toBe(true);
    expect(canActOnAccounts("admin")).toBe(true);
  });

  it("gives superadmin everything", () => {
    expect(canOpenPortal("superadmin")).toBe(true);
    expect(canActOnAccounts("superadmin")).toBe(true);
    expect(canManageAdmins("superadmin")).toBe(true);
  });

  it("is monotonic — nothing a lower rung may do is denied to a higher one", () => {
    for (const [lower, higher] of [
      ["standard", "admin"],
      ["admin", "superadmin"],
    ] as [Level, Level][]) {
      for (const can of [canOpenPortal, canActOnAccounts, canManageAdmins]) {
        if (can(lower)) expect(can(higher)).toBe(true);
      }
    }
  });
});

describe("who may act on whom", () => {
  it("lets an admin manage standard accounts only", () => {
    expect(canActOn("admin", "standard")).toBe(true);
    expect(canActOn("admin", "admin")).toBe(false);
    expect(canActOn("admin", "superadmin")).toBe(false);
  });

  it("stops two admins acting on each other", () => {
    // Without this they could suspend each other, and the portal's
    // membership becomes a race rather than a decision.
    expect(canActOn("admin", "admin")).toBe(false);
  });

  it("stops an admin touching the superadmin", () => {
    // The worst version of getting this wrong: locking the one person
    // who can undo it out of the portal that undoes it.
    expect(canActOn("admin", "superadmin")).toBe(false);
  });

  it("lets the superadmin manage anyone below them", () => {
    expect(canActOn("superadmin", "standard")).toBe(true);
    expect(canActOn("superadmin", "admin")).toBe(true);
  });

  it("stops a superadmin acting on a superadmin, including themselves", () => {
    // An account that can suspend itself is a way to lose the only key.
    expect(canActOn("superadmin", "superadmin")).toBe(false);
  });

  it("gives a standard account no reach at all", () => {
    for (const target of LEVELS) expect(canActOn("standard", target)).toBe(false);
  });

  it("never lets anyone act on someone at or above their own level", () => {
    for (const [actor, target] of PAIRS) {
      if (canActOn(actor, target)) expect(rank(target)).toBeLessThan(rank(actor));
    }
  });

  it("agrees with canActOnAccounts about who can act at all", () => {
    for (const actor of LEVELS) {
      const anyTarget = LEVELS.some((t) => canActOn(actor, t));
      expect(anyTarget).toBe(canActOnAccounts(actor));
    }
  });
});

describe("granting", () => {
  it("reserves granting to the superadmin", () => {
    expect(canGrant("admin", "admin")).toBe(false);
    expect(canGrant("standard", "admin")).toBe(false);
    expect(canGrant("superadmin", "admin")).toBe(true);
  });

  it("lets nobody grant superadmin — it does not live here to be granted", () => {
    for (const actor of LEVELS) expect(canGrant(actor, "superadmin")).toBe(false);
  });

  it("treats standard as a revocation rather than something to grant", () => {
    for (const actor of LEVELS) expect(canGrant(actor, "standard")).toBe(false);
  });

  it("never grants at or above the granter's own level", () => {
    for (const [actor, target] of PAIRS) {
      if (canGrant(actor, target)) expect(rank(target)).toBeLessThan(rank(actor));
    }
  });

  it("offers exactly what it permits", () => {
    for (const actor of LEVELS) {
      for (const target of LEVELS) {
        expect(grantableBy(actor).includes(target)).toBe(canGrant(actor, target));
      }
    }
    expect(grantableBy("superadmin")).toEqual(["admin"]);
    expect(grantableBy("admin")).toEqual([]);
    expect(grantableBy("standard")).toEqual([]);
  });
});

describe("revoking", () => {
  it("is the superadmin's alone", () => {
    expect(canRevoke("superadmin", "admin")).toBe(true);
    expect(canRevoke("admin", "admin")).toBe(false);
    expect(canRevoke("standard", "admin")).toBe(false);
  });

  it("cannot remove a superadmin, including by a superadmin", () => {
    // The only way out of that seat is the environment variable it was
    // entered by. Otherwise the last one out could lock everyone out.
    for (const actor of LEVELS) expect(canRevoke(actor, "superadmin")).toBe(false);
  });

  it("is a no-op against someone who has nothing", () => {
    for (const actor of LEVELS) expect(canRevoke(actor, "standard")).toBe(false);
  });
});

describe("isLevel", () => {
  for (const l of LEVELS) it(`accepts ${l}`, () => expect(isLevel(l)).toBe(true));
  for (const bad of ["", "owner", "support", "SUPERADMIN", "root", null, 2, undefined, {}]) {
    it(`rejects ${JSON.stringify(bad)}`, () => expect(isLevel(bad)).toBe(false));
  }
});

describe("labels", () => {
  it("names, describes and styles every level", () => {
    for (const l of LEVELS) {
      expect(LEVEL_LABEL[l].length).toBeGreaterThan(0);
      expect(LEVEL_BLURB[l].length).toBeGreaterThan(0);
      expect(LEVEL_STYLE[l].length).toBeGreaterThan(0);
    }
  });

  it("says out loud that superadmin is not granted here", () => {
    expect(LEVEL_BLURB.superadmin).toMatch(/environment/i);
  });

  it("says out loud that standard has no portal access", () => {
    expect(LEVEL_BLURB.standard).toMatch(/no access/i);
  });
});
