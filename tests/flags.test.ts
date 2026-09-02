import { describe, it, expect } from "vitest";
import { bucketFor, isOn, isOnGlobally, clampRollout, type Flag } from "@/lib/flags";

/**
 * Who a partly-rolled-out feature is on for.
 *
 * The property that matters is stability. A flag that recomputed per
 * request would flicker a feature in and out under one person, which is
 * worse than either state — so most of this is about the same inputs
 * always giving the same answer.
 */

const flag = (over: Partial<Flag> = {}): Flag => ({
  key: "focus_timer", enabled: true, rollout: 100, ...over,
});

const users = Array.from({ length: 400 }, (_, i) => `user_${i}`);

describe("bucketFor", () => {
  it("stays in range", () => {
    for (const u of users) {
      const b = bucketFor("k", u);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  it("is stable for the same key and user", () => {
    for (const u of users.slice(0, 50)) {
      expect(bucketFor("k", u)).toBe(bucketFor("k", u));
    }
  });

  it("differs by key, so one person is not always in the first 10%", () => {
    // Otherwise every small rollout tests the same handful of people.
    const a = users.map((u) => bucketFor("flag_a", u));
    const b = users.map((u) => bucketFor("flag_b", u));
    expect(a).not.toEqual(b);
  });

  it("spreads people roughly evenly", () => {
    const tenths = new Array(10).fill(0);
    for (const u of users) tenths[Math.floor(bucketFor("k", u) / 10)]++;
    // 400 users over 10 bins: expect ~40 each. Loose bounds, because
    // this is checking there is no gross bias, not testing SHA-256.
    for (const n of tenths) {
      expect(n).toBeGreaterThan(15);
      expect(n).toBeLessThan(75);
    }
  });
});

describe("isOn", () => {
  it("is off for a flag that does not exist", () => {
    // A typo in a key turns something off rather than on for everyone.
    expect(isOn(null, "u")).toBe(false);
    expect(isOn(undefined, "u")).toBe(false);
  });

  it("is off when disabled, whatever the rollout says", () => {
    expect(isOn(flag({ enabled: false, rollout: 100 }), "u")).toBe(false);
  });

  it("is on for everybody at 100", () => {
    for (const u of users) expect(isOn(flag({ rollout: 100 }), u)).toBe(true);
  });

  it("is off for everybody at 0", () => {
    for (const u of users) expect(isOn(flag({ rollout: 0 }), u)).toBe(false);
  });

  it("gives roughly the share it promises", () => {
    const on = users.filter((u) => isOn(flag({ rollout: 25 }), u)).length;
    const share = (on / users.length) * 100;
    expect(share).toBeGreaterThan(15);
    expect(share).toBeLessThan(35);
  });

  it("never takes the feature away as the rollout grows", () => {
    // The property that makes a gradual rollout usable: nobody loses a
    // feature because somebody else was let in.
    for (const u of users.slice(0, 60)) {
      let wasOn = false;
      for (let pct = 0; pct <= 100; pct += 5) {
        const on = isOn(flag({ rollout: pct }), u);
        if (wasOn) expect(on).toBe(true);
        wasOn = wasOn || on;
      }
    }
  });

  it("is stable across repeated calls", () => {
    const f = flag({ rollout: 40 });
    for (const u of users.slice(0, 40)) {
      const first = isOn(f, u);
      for (let i = 0; i < 5; i++) expect(isOn(f, u)).toBe(first);
    }
  });
});

describe("isOnGlobally", () => {
  it("needs a full rollout, because there is no user to bucket", () => {
    expect(isOnGlobally(flag({ rollout: 100 }))).toBe(true);
    expect(isOnGlobally(flag({ rollout: 99 }))).toBe(false);
    expect(isOnGlobally(flag({ enabled: false }))).toBe(false);
    expect(isOnGlobally(null)).toBe(false);
  });
});

describe("clampRollout", () => {
  const cases: [number, number][] = [
    [-50, 0], [0, 0], [37, 37], [37.4, 37], [37.6, 38], [100, 100], [1000, 100],
  ];
  for (const [input, expected] of cases) {
    it(`${input} becomes ${expected}`, () => expect(clampRollout(input)).toBe(expected));
  }
  it("treats nonsense as off rather than on", () => {
    expect(clampRollout(NaN)).toBe(0);
    expect(clampRollout(Infinity)).toBe(0);
  });
});
