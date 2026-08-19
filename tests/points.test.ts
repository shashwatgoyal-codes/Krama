import { describe, it, expect } from "vitest";
import {
  POINTS,
  MAX_POINTS,
  MIN_POINTS,
  streakMultiplier,
  softCapFactor,
  computeAward,
  pointsForLevel,
  levelFromPoints,
  levelProgress,
  computePace,
} from "@/lib/points";

describe("the points table", () => {
  it("keeps the spread narrow — 6x, not 50x", () => {
    // The whole anti-gaming argument rests on this ratio. If it ever
    // widens, people start optimising for the score.
    expect(MAX_POINTS / MIN_POINTS).toBeLessThanOrEqual(6);
  });

  it("never pays more for sending than for doing", () => {
    expect(POINTS.standardTask).toBeLessThanOrEqual(POINTS.deepBlock);
    expect(POINTS.quickTask).toBeLessThan(POINTS.standardTask);
  });
});

describe("streakMultiplier", () => {
  it("starts at 1 and never drops below it", () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(-5)).toBe(1);
  });

  it("grows 2% a day", () => {
    expect(streakMultiplier(10)).toBeCloseTo(1.2, 5);
  });

  it("caps at 1.6 so a long streak can't dwarf the work", () => {
    expect(streakMultiplier(30)).toBeCloseTo(1.6, 5);
    expect(streakMultiplier(365)).toBeCloseTo(1.6, 5);
  });
});

describe("softCapFactor", () => {
  const cap = 150;

  it("pays in full below the cap", () => {
    expect(softCapFactor(0, cap)).toBe(1);
    expect(softCapFactor(149, cap)).toBe(1);
  });

  it("halves at the cap and quarters at double", () => {
    expect(softCapFactor(150, cap)).toBe(0.5);
    expect(softCapFactor(299, cap)).toBe(0.5);
    expect(softCapFactor(300, cap)).toBe(0.25);
    expect(softCapFactor(10_000, cap)).toBe(0.25);
  });
});

describe("computeAward", () => {
  const base = {
    basePoints: POINTS.standardTask,
    streakDays: 0,
    pointsToday: 0,
    dailyCap: 150,
    backdated: false,
  };

  it("pays the base amount with no streak and no cap", () => {
    expect(computeAward(base).points).toBe(25);
  });

  it("applies the streak multiplier", () => {
    // 25 * 1.36 = 34
    expect(computeAward({ ...base, streakDays: 18 }).points).toBe(34);
  });

  it("halves a backdated entry", () => {
    expect(computeAward({ ...base, backdated: true }).points).toBe(13);
  });

  it("stacks the cap and the streak", () => {
    // 25 * 1.2 * 0.5 = 15
    const a = computeAward({ ...base, streakDays: 10, pointsToday: 200 });
    expect(a.points).toBe(15);
  });

  it("never awards zero — effort always counts for something", () => {
    const a = computeAward({
      ...base,
      basePoints: 1,
      pointsToday: 100_000,
      backdated: true,
    });
    expect(a.points).toBeGreaterThanOrEqual(1);
  });

  it("reports the multiplier it used", () => {
    const a = computeAward({ ...base, streakDays: 30 });
    expect(a.multiplier).toBeCloseTo(1.6, 3);
  });
});

describe("levels", () => {
  it("starts everyone at level 1 with nothing to show", () => {
    expect(levelFromPoints(0)).toBe(1);
    expect(pointsForLevel(1)).toBe(0);
  });

  it("reaches level 2 inside the first day or two", () => {
    // A couple of real tasks should do it — week one has to pay.
    expect(pointsForLevel(2)).toBeLessThanOrEqual(250);
  });

  it("climbs monotonically", () => {
    for (let l = 1; l < 40; l++) {
      expect(pointsForLevel(l + 1)).toBeGreaterThan(pointsForLevel(l));
    }
  });

  it("agrees with itself across the curve", () => {
    for (const level of [2, 5, 12, 25]) {
      const at = pointsForLevel(level);
      expect(levelFromPoints(at)).toBe(level);
      expect(levelFromPoints(at - 1)).toBe(level - 1);
    }
  });

  it("reports progress through the current level", () => {
    const floor = pointsForLevel(5);
    const ceiling = pointsForLevel(6);
    const half = floor + Math.floor((ceiling - floor) / 2);
    const p = levelProgress(half);
    expect(p.level).toBe(5);
    expect(p.fraction).toBeGreaterThan(0.4);
    expect(p.fraction).toBeLessThan(0.6);
  });
});

describe("computePace", () => {
  const target = 60;

  it("is zero with no history", () => {
    expect(computePace([], target)).toBe(0);
    expect(computePace([0, 0, 0], target)).toBe(0);
  });

  it("sits near 100 when every day hits the target", () => {
    expect(computePace([60, 60, 60, 60, 60, 60, 60], target)).toBe(100);
  });

  it("clamps above the target rather than running away", () => {
    expect(computePace([600, 600, 600], target)).toBe(100);
  });

  it("dips on a missed day instead of resetting", () => {
    // The whole point: one bad day is a dip, never a wipeout.
    const steady = computePace([60, 60, 60, 60, 60], target);
    const missed = computePace([0, 60, 60, 60, 60], target);
    expect(missed).toBeLessThan(steady);
    expect(missed).toBeGreaterThan(30);
  });

  it("recovers the moment you start again", () => {
    const afterGap = computePace([0, 0, 0, 60, 60], target);
    const restarted = computePace([60, 0, 0, 0, 60], target);
    expect(restarted).toBeGreaterThan(afterGap);
  });

  it("weights recent days more heavily", () => {
    const recentWork = computePace([60, 0, 0, 0, 0], target);
    const oldWork = computePace([0, 0, 0, 0, 60], target);
    expect(recentWork).toBeGreaterThan(oldWork);
  });

  it("ignores anything older than the window", () => {
    const withinWindow = computePace([0, 0, 0, 0, 0, 0, 0], target);
    const withAncientHistory = computePace(
      [0, 0, 0, 0, 0, 0, 0, 999, 999],
      target,
    );
    expect(withAncientHistory).toBe(withinWindow);
  });
});
