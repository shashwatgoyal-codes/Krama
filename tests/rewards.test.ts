import { describe, it, expect } from "vitest";
import {
  balanceOf,
  canAfford,
  shortfall,
  describeReward,
  nextGoal,
  daysAway,
  isValidRewardName,
  isValidCost,
  REWARD_NAME_MAX,
  REWARD_COST_MAX,
  REWARD_COST_MIN,
} from "@/lib/rewards";
import { levelFromPoints } from "@/lib/points";

/**
 * Spending what you earned.
 *
 * The rule that matters most is the one about what spending does NOT
 * touch: the level reads from lifetime points, so claiming a reward can
 * never demote you. If it could, you would be punished for the thing
 * the points existed to encourage, and never spending them would be the
 * rational move — which makes the whole feature pointless.
 */

describe("balanceOf", () => {
  const cases: [number, number, number][] = [
    [0, 0, 0],
    [100, 0, 100],
    [100, 40, 60],
    [100, 100, 0],
    [1, 0, 1],
    [5000, 1234, 3766],
  ];

  for (const [earned, spent, expected] of cases) {
    it(`earned ${earned}, spent ${spent} → ${expected}`, () => {
      expect(balanceOf(earned, spent)).toBe(expected);
    });
  }

  it("never goes negative, even if the two disagree", () => {
    // A balance below zero is a bug in the writing, and showing it would
    // report that bug as a fact about the user.
    expect(balanceOf(50, 100)).toBe(0);
    expect(balanceOf(0, 999)).toBe(0);
  });

  it("holds across a long run of earning and spending", () => {
    let earned = 0;
    let spent = 0;
    for (let i = 1; i <= 200; i++) {
      earned += i;
      if (i % 7 === 0) spent += 10;
      expect(balanceOf(earned, spent)).toBe(Math.max(0, earned - spent));
    }
  });
});

describe("spending never changes the level", () => {
  it("keeps the level after any amount is spent", () => {
    for (const earned of [0, 100, 500, 2000, 10_000]) {
      const before = levelFromPoints(earned);
      for (const spent of [0, 1, earned / 2, earned]) {
        // The level reads lifetime points, not the balance.
        expect(levelFromPoints(earned)).toBe(before);
        expect(balanceOf(earned, spent)).toBeLessThanOrEqual(earned);
      }
    }
  });

  it("a balance of zero still leaves the level standing", () => {
    const earned = 5000;
    expect(balanceOf(earned, earned)).toBe(0);
    expect(levelFromPoints(earned)).toBeGreaterThan(1);
  });
});

describe("canAfford", () => {
  it("allows exactly enough", () => {
    expect(canAfford(100, 100)).toBe(true);
  });

  it("refuses one short", () => {
    expect(canAfford(99, 100)).toBe(false);
  });

  it("refuses a free reward, since that is not a reward", () => {
    expect(canAfford(100, 0)).toBe(false);
    expect(canAfford(100, -5)).toBe(false);
  });

  it("refuses everything on an empty balance except nothing", () => {
    for (const cost of [1, 10, 100]) {
      expect(canAfford(0, cost)).toBe(false);
    }
  });
});

describe("shortfall", () => {
  const cases: [number, number, number][] = [
    [0, 100, 100],
    [40, 100, 60],
    [99, 100, 1],
    [100, 100, 0],
    [200, 100, 0],
  ];

  for (const [balance, cost, expected] of cases) {
    it(`balance ${balance} against ${cost} → ${expected}`, () => {
      expect(shortfall(balance, cost)).toBe(expected);
    });
  }

  it("is zero whenever the reward is affordable", () => {
    for (let balance = 0; balance <= 300; balance += 13) {
      const cost = 150;
      if (canAfford(balance, cost)) expect(shortfall(balance, cost)).toBe(0);
    }
  });
});

describe("describeReward", () => {
  const reward = { id: "r1", name: "Film", cost: 200, notes: null };

  it("marks it affordable at exactly the cost", () => {
    expect(describeReward(reward, 200).affordable).toBe(true);
    expect(describeReward(reward, 200).shortBy).toBe(0);
  });

  it("reports how far off when it is not", () => {
    const view = describeReward(reward, 120);
    expect(view.affordable).toBe(false);
    expect(view.shortBy).toBe(80);
  });

  it("keeps the reward's own fields", () => {
    expect(describeReward(reward, 0)).toMatchObject({
      id: "r1",
      name: "Film",
      cost: 200,
    });
  });
});

describe("nextGoal", () => {
  const rewards = [
    { name: "Coffee", cost: 50 },
    { name: "Film", cost: 200 },
    { name: "Day off", cost: 1000 },
  ];

  it("picks the cheapest thing not yet affordable", () => {
    expect(nextGoal(rewards, 0)?.name).toBe("Coffee");
    expect(nextGoal(rewards, 60)?.name).toBe("Film");
    expect(nextGoal(rewards, 500)?.name).toBe("Day off");
  });

  it("returns nothing once everything is affordable", () => {
    expect(nextGoal(rewards, 5000)).toBe(null);
  });

  it("returns nothing when there are no rewards", () => {
    expect(nextGoal([], 100)).toBe(null);
  });

  it("reports the gap to the goal it picked", () => {
    expect(nextGoal(rewards, 150)?.shortBy).toBe(50);
  });

  it("treats a reward you can exactly afford as already reached", () => {
    expect(nextGoal([{ name: "Film", cost: 200 }], 200)).toBe(null);
  });
});

describe("daysAway", () => {
  it("is zero when there is nothing left to earn", () => {
    expect(daysAway(0, 60)).toBe(0);
    expect(daysAway(-10, 60)).toBe(0);
  });

  it("rounds up, because a part day does not get you there", () => {
    expect(daysAway(61, 60)).toBe(2);
    expect(daysAway(120, 60)).toBe(2);
    expect(daysAway(1, 60)).toBe(1);
  });

  it("declines to guess when nothing is being earned", () => {
    expect(daysAway(100, 0)).toBe(null);
    expect(daysAway(100, -5)).toBe(null);
  });
});

describe("reward validation", () => {
  it("accepts a sensible name", () => {
    for (const name of ["Film", "A day off", "x".repeat(REWARD_NAME_MAX)]) {
      expect(isValidRewardName(name)).toBe(true);
    }
  });

  it("refuses a blank or over-long name", () => {
    for (const name of ["", " ", "\t", "x".repeat(REWARD_NAME_MAX + 1)]) {
      expect(isValidRewardName(name)).toBe(false);
    }
  });

  it("accepts whole costs in range", () => {
    for (const cost of [REWARD_COST_MIN, 50, 200, REWARD_COST_MAX]) {
      expect(isValidCost(cost)).toBe(true);
    }
  });

  it("refuses zero, negative, fractional and absurd costs", () => {
    for (const cost of [0, -1, 1.5, REWARD_COST_MAX + 1, NaN, Infinity]) {
      expect(isValidCost(cost)).toBe(false);
    }
  });
});
