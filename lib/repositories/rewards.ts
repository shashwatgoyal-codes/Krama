import { db } from "@/lib/db";
import { balanceOf, canAfford } from "@/lib/rewards";

/** Every function takes userId first and filters on it. No exceptions. */

export type RewardRow = {
  id: string;
  name: string;
  cost: number;
  notes: string | null;
};

export type RedemptionRow = {
  id: string;
  name: string;
  cost: number;
  redeemedAt: Date;
};

export async function listRewards(userId: string): Promise<RewardRow[]> {
  return db.reward.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, name: true, cost: true, notes: true },
    orderBy: [{ cost: "asc" }, { name: "asc" }],
  });
}

/**
 * Earned, spent and what is left.
 *
 * Earned is summed from the ledger rather than read from the cached
 * total on the profile, because the ledger is the record and the cache
 * is a convenience. A balance that disagrees with the history is worse
 * than a slow one.
 */
export async function pointsState(userId: string): Promise<{
  earned: number;
  spent: number;
  balance: number;
}> {
  const [ledger, redeemed] = await Promise.all([
    db.pointEntry.aggregate({ where: { userId }, _sum: { points: true } }),
    db.redemption.aggregate({ where: { userId }, _sum: { cost: true } }),
  ]);

  const earned = Math.max(0, ledger._sum.points ?? 0);
  const spent = Math.max(0, redeemed._sum.cost ?? 0);
  return { earned, spent, balance: balanceOf(earned, spent) };
}

export async function listRedemptions(
  userId: string,
  limit = 20,
): Promise<RedemptionRow[]> {
  return db.redemption.findMany({
    where: { userId },
    select: { id: true, name: true, cost: true, redeemedAt: true },
    orderBy: { redeemedAt: "desc" },
    take: limit,
  });
}

export async function createReward(
  userId: string,
  data: { name: string; cost: number; notes?: string | null },
): Promise<RewardRow> {
  return db.reward.create({
    data: {
      userId,
      name: data.name,
      cost: data.cost,
      notes: data.notes ?? null,
    },
    select: { id: true, name: true, cost: true, notes: true },
  });
}

/**
 * Archived rather than deleted, because redemptions point at it.
 *
 * Removing the row would take the history with it, and "you claimed
 * something, we no longer know what" is a worse record than none.
 */
export async function archiveReward(
  userId: string,
  id: string,
): Promise<boolean> {
  const { count } = await db.reward.updateMany({
    where: { id, userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  return count > 0;
}

export type RedeemResult =
  | { ok: true; balance: number }
  | { ok: false; reason: "missing" | "tooExpensive" };

/**
 * Claims a reward, if it can be afforded.
 *
 * The balance is read inside the same call that writes the redemption
 * rather than trusted from the page, so a stale screen or a double
 * click cannot spend points twice. The name and cost are copied onto
 * the redemption so repricing the reward later never rewrites what was
 * paid at the time.
 */
export async function redeemReward(
  userId: string,
  rewardId: string,
): Promise<RedeemResult> {
  const reward = await db.reward.findFirst({
    where: { id: rewardId, userId, archivedAt: null },
    select: { id: true, name: true, cost: true },
  });
  if (!reward) return { ok: false, reason: "missing" };

  const { balance } = await pointsState(userId);
  if (!canAfford(balance, reward.cost)) {
    return { ok: false, reason: "tooExpensive" };
  }

  await db.redemption.create({
    data: {
      userId,
      rewardId: reward.id,
      name: reward.name,
      cost: reward.cost,
    },
  });

  return { ok: true, balance: balance - reward.cost };
}
