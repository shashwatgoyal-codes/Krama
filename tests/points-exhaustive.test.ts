import { describe, it, expect } from "vitest";
import {
  streakMultiplier,
  softCapFactor,
  computeAward,
  pointsForLevel,
  levelFromPoints,
  levelProgress,
  computePace,
  POINTS,
  MAX_POINTS,
  MIN_POINTS,
} from "@/lib/points";

/**
 * The scoring engine, swept rather than spot-checked.
 *
 * This is the part of the app that is meant to be trustworthy: the
 * ledger is append-only precisely so the numbers can be reconstructed
 * and believed. A rounding error here is not cosmetic — it is the score
 * being quietly wrong for months, which is exactly what happened when
 * the streak multiplier read a column nothing ever wrote.
 *
 * So these sweep whole ranges and assert the properties that must hold
 * everywhere (monotonic, bounded, never negative) rather than checking
 * a handful of favourable inputs.
 */

describe("streakMultiplier", () => {
  it("never rewards less than a single day would", () => {
    for (let days = 0; days <= 500; days++) {
      expect(streakMultiplier(days)).toBeGreaterThanOrEqual(1);
    }
  });

  it("never runs away, however long the streak", () => {
    for (let days = 0; days <= 5000; days += 7) {
      expect(streakMultiplier(days)).toBeLessThanOrEqual(2);
    }
  });

  it("never decreases as the streak grows", () => {
    let previous = 0;
    for (let days = 0; days <= 400; days++) {
      const now = streakMultiplier(days);
      expect(now).toBeGreaterThanOrEqual(previous);
      previous = now;
    }
  });

  it("treats a negative streak as no streak", () => {
    for (const days of [-1, -10, -100]) {
      expect(streakMultiplier(days)).toBe(streakMultiplier(0));
    }
  });

  it("plateaus, so a long streak stops being worth chasing", () => {
    expect(streakMultiplier(1000)).toBe(streakMultiplier(5000));
  });
});

describe("softCapFactor", () => {
  const caps = [20, 50, 100, 150, 200, 500];

  for (const cap of caps) {
    it(`pays in full below a cap of ${cap}`, () => {
      expect(softCapFactor(0, cap)).toBe(1);
      expect(softCapFactor(cap - 1, cap)).toBe(1);
    });
  }

  for (const cap of caps) {
    it(`never pays more than full at a cap of ${cap}`, () => {
      for (let today = 0; today <= cap * 3; today += Math.ceil(cap / 10)) {
        expect(softCapFactor(today, cap)).toBeLessThanOrEqual(1);
      }
    });
  }

  for (const cap of caps) {
    it(`never pays nothing at a cap of ${cap}, because nothing is blocked`, () => {
      for (let today = 0; today <= cap * 5; today += Math.ceil(cap / 4)) {
        expect(softCapFactor(today, cap)).toBeGreaterThan(0);
      }
    });
  }

  for (const cap of caps) {
    it(`never increases as the day fills up, at a cap of ${cap}`, () => {
      let previous = 1;
      for (let today = 0; today <= cap * 3; today += Math.ceil(cap / 12)) {
        const now = softCapFactor(today, cap);
        expect(now).toBeLessThanOrEqual(previous);
        previous = now;
      }
    });
  }
});

describe("computeAward", () => {
  const basePoints = [MIN_POINTS, 12, 15, 20, 25, MAX_POINTS];

  for (const points of basePoints) {
    it(`awards a whole number of points for a base of ${points}`, () => {
      const award = computeAward({
        basePoints: points,
        streakDays: 10,
        pointsToday: 0,
        dailyCap: 150,
        backdated: false,
      });
      expect(Number.isInteger(award.points)).toBe(true);
    });
  }

  for (const points of basePoints) {
    it(`never awards nothing for a base of ${points}`, () => {
      for (const streak of [0, 1, 30]) {
        for (const today of [0, 200, 1000]) {
          const award = computeAward({
            basePoints: points,
            streakDays: streak,
            pointsToday: today,
            dailyCap: 150,
            backdated: true,
          });
          expect(award.points).toBeGreaterThan(0);
        }
      }
    });
  }

  it("pays a backdated entry less than the same entry today", () => {
    for (const points of basePoints) {
      const now = computeAward({
        basePoints: points,
        streakDays: 5,
        pointsToday: 0,
        dailyCap: 150,
        backdated: false,
      });
      const late = computeAward({
        basePoints: points,
        streakDays: 5,
        pointsToday: 0,
        dailyCap: 150,
        backdated: true,
      });
      expect(late.points).toBeLessThan(now.points);
    }
  });

  it("pays more with a streak than without one", () => {
    for (const points of basePoints) {
      const cold = computeAward({
        basePoints: points,
        streakDays: 0,
        pointsToday: 0,
        dailyCap: 150,
        backdated: false,
      });
      const warm = computeAward({
        basePoints: points,
        streakDays: 60,
        pointsToday: 0,
        dailyCap: 150,
        backdated: false,
      });
      expect(warm.points).toBeGreaterThanOrEqual(cold.points);
    }
  });

  it("pays less once the day is past its cap", () => {
    for (const points of basePoints) {
      const early = computeAward({
        basePoints: points,
        streakDays: 0,
        pointsToday: 0,
        dailyCap: 150,
        backdated: false,
      });
      const late = computeAward({
        basePoints: points,
        streakDays: 0,
        pointsToday: 400,
        dailyCap: 150,
        backdated: false,
      });
      expect(late.points).toBeLessThanOrEqual(early.points);
    }
  });

  it("never awards a fraction, at any combination", () => {
    for (const points of basePoints) {
      for (const streak of [0, 3, 18, 99, 365]) {
        for (const today of [0, 75, 150, 300]) {
          for (const backdated of [true, false]) {
            const award = computeAward({
              basePoints: points,
              streakDays: streak,
              pointsToday: today,
              dailyCap: 150,
              backdated,
            });
            expect(Number.isInteger(award.points)).toBe(true);
            expect(award.points).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

describe("pointsForLevel and levelFromPoints", () => {
  it("agree with each other for the first 60 levels", () => {
    for (let level = 1; level <= 60; level++) {
      const needed = pointsForLevel(level);
      expect(levelFromPoints(needed)).toBeGreaterThanOrEqual(level);
    }
  });

  it("needs more for each successive level", () => {
    for (let level = 1; level < 80; level++) {
      expect(pointsForLevel(level + 1)).toBeGreaterThan(pointsForLevel(level));
    }
  });

  it("never drops a level as points rise", () => {
    let previous = 0;
    for (let points = 0; points <= 20_000; points += 37) {
      const level = levelFromPoints(points);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  it("starts everyone at level one", () => {
    expect(levelFromPoints(0)).toBe(1);
  });

  it("treats a negative total as the start rather than erroring", () => {
    for (const points of [-1, -100, -99_999]) {
      expect(levelFromPoints(points)).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("levelProgress", () => {
  it("reports a coherent position at every total up to 30k", () => {
    for (let points = 0; points <= 30_000; points += 53) {
      const p = levelProgress(points);
      expect(p.level).toBeGreaterThanOrEqual(1);
      expect(p.into).toBeGreaterThanOrEqual(0);
      expect(p.needed).toBeGreaterThan(0);
      expect(p.into).toBeLessThanOrEqual(p.needed);
    }
  });

  it("is never further than the level requires", () => {
    for (let points = 0; points <= 10_000; points += 11) {
      const p = levelProgress(points);
      expect(p.into / p.needed).toBeLessThanOrEqual(1);
    }
  });
});

describe("computePace", () => {
  it("is zero for a week of nothing", () => {
    expect(computePace([0, 0, 0, 0, 0, 0, 0], 60)).toBe(0);
  });

  it("is never negative, whatever the input", () => {
    const inputs = [
      [0],
      [1],
      [100],
      [0, 0, 0],
      [60, 60, 60, 60, 60, 60, 60],
      [1000, 0, 0, 0, 0, 0, 0],
      [],
    ];
    for (const days of inputs) {
      for (const target of [1, 20, 60, 200]) {
        expect(computePace(days, target)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("never exceeds one hundred", () => {
    for (const value of [60, 100, 500, 5000]) {
      const week = Array.from({ length: 7 }, () => value);
      expect(computePace(week, 60)).toBeLessThanOrEqual(100);
    }
  });

  it("rises with more work at the same target", () => {
    const light = computePace([10, 10, 10, 10, 10, 10, 10], 60);
    const heavy = computePace([60, 60, 60, 60, 60, 60, 60], 60);
    expect(heavy).toBeGreaterThan(light);
  });

  it("falls as the target rises for the same work", () => {
    const week = [30, 30, 30, 30, 30, 30, 30];
    expect(computePace(week, 120)).toBeLessThan(computePace(week, 30));
  });

  it("weights recent days more heavily than old ones", () => {
    // Same total, different placement: today's work should count more.
    const recent = computePace([100, 0, 0, 0, 0, 0, 0], 60);
    const stale = computePace([0, 0, 0, 0, 0, 0, 100], 60);
    expect(recent).toBeGreaterThan(stale);
  });

  it("handles a target of zero without dividing by it", () => {
    expect(Number.isFinite(computePace([10, 10], 0))).toBe(true);
  });
});

describe("the points table itself", () => {
  it("keeps the spread narrow, which is the whole design rule", () => {
    expect(MAX_POINTS / MIN_POINTS).toBeLessThanOrEqual(6);
  });

  it("has a top worth more than its bottom", () => {
    expect(MAX_POINTS).toBeGreaterThan(MIN_POINTS);
  });

  it("is all whole numbers", () => {
    for (const value of Object.values(POINTS)) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it("is all positive", () => {
    for (const value of Object.values(POINTS)) {
      expect(value).toBeGreaterThan(0);
    }
  });
});
