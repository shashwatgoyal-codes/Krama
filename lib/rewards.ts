/**
 * Spending what you have earned.
 *
 * Two numbers, deliberately, and keeping them apart is the whole design:
 *
 *   earned   — every point you have ever been awarded. Drives the level
 *              and never goes down.
 *   balance  — earned minus what you have spent. This is what a reward
 *              costs against.
 *
 * If spending drew down the same number the level reads from, claiming a
 * reward would demote you — you would be punished for the thing the
 * points existed to encourage, and the rational move would be to never
 * spend them. A currency you are penalised for using is not a currency.
 *
 * Pure functions only; this is imported by client components.
 */

export type RewardView = {
  id: string;
  name: string;
  cost: number;
  notes: string | null;
  /** Whether the current balance covers it. */
  affordable: boolean;
  /** How many points short, or 0 when it is affordable. */
  shortBy: number;
};

/** The longest a reward's name may be. */
export const REWARD_NAME_MAX = 60;
/** Nobody needs a reward costing more than a year of good days. */
export const REWARD_COST_MAX = 100_000;
export const REWARD_COST_MIN = 1;

export function balanceOf(earned: number, spent: number): number {
  // Never negative, even if the two ever disagree: a balance below zero
  // is a bug, and showing "-40 points" would report it as a fact about
  // the user rather than about the code.
  return Math.max(0, earned - spent);
}

export function canAfford(balance: number, cost: number): boolean {
  return cost > 0 && balance >= cost;
}

export function shortfall(balance: number, cost: number): number {
  return Math.max(0, cost - balance);
}

export function describeReward(
  reward: { id: string; name: string; cost: number; notes: string | null },
  balance: number,
): RewardView {
  return {
    ...reward,
    affordable: canAfford(balance, reward.cost),
    shortBy: shortfall(balance, reward.cost),
  };
}

/**
 * How close the nearest reward is, for the progress line.
 *
 * The cheapest thing you cannot yet afford is the useful one to show:
 * the cheapest overall is often already claimable, and the dearest is
 * too far away to feel like progress.
 */
export function nextGoal(
  rewards: { cost: number; name: string }[],
  balance: number,
): { name: string; cost: number; shortBy: number } | null {
  const reachable = rewards
    .filter((r) => r.cost > balance)
    .sort((a, b) => a.cost - b.cost);
  const target = reachable[0];
  if (!target) return null;
  return {
    name: target.name,
    cost: target.cost,
    shortBy: shortfall(balance, target.cost),
  };
}

/** A rough sense of how many days away something is, at your recent rate. */
export function daysAway(shortBy: number, pointsPerDay: number): number | null {
  if (shortBy <= 0) return 0;
  if (pointsPerDay <= 0) return null;
  return Math.ceil(shortBy / pointsPerDay);
}

export function isValidRewardName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= REWARD_NAME_MAX;
}

export function isValidCost(cost: number): boolean {
  return (
    Number.isInteger(cost) && cost >= REWARD_COST_MIN && cost <= REWARD_COST_MAX
  );
}
