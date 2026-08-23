import { describe, it, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import {
  createReward,
  listRewards,
  pointsState,
  redeemReward,
  archiveReward,
  listRedemptions,
} from "@/lib/repositories/rewards";
import { levelFromPoints } from "@/lib/points";
import { makeUser, cleanup, dayDate, DAY, type TestUser } from "./harness";

/**
 * Spending points, against the real ledger.
 *
 * The rule worth protecting is that claiming a reward never touches the
 * number the level is read from. If it ever does, spending demotes you,
 * and the rational move becomes never spending — which makes the whole
 * feature pointless. That is a property of two tables agreeing, so it
 * cannot be checked without them.
 */

let user: TestUser | null = null;
afterEach(async () => {
  await cleanup(user);
  user = null;
});

async function earn(userId: string, points: number) {
  await db.pointEntry.create({
    data: {
      userId,
      sourceType: "task",
      points,
      countedFor: dayDate(DAY.monday),
    },
  });
}

describe("the balance", () => {
  it("starts at nothing", async () => {
    user = await makeUser("rw-zero");
    expect(await pointsState(user.id)).toEqual({
      earned: 0,
      spent: 0,
      balance: 0,
    });
  });

  it("counts what the ledger holds", async () => {
    user = await makeUser("rw-earn");
    await earn(user.id, 30);
    await earn(user.id, 20);
    const state = await pointsState(user.id);
    expect(state.earned).toBe(50);
    expect(state.balance).toBe(50);
  });

  it("falls when something is claimed, and earned does not", async () => {
    user = await makeUser("rw-spend");
    await earn(user.id, 250);
    const reward = await createReward(user.id, { name: "Film", cost: 100 });
    await redeemReward(user.id, reward.id);

    const state = await pointsState(user.id);
    expect(state.earned).toBe(250);
    expect(state.spent).toBe(100);
    expect(state.balance).toBe(150);
  });

  it("never lets spending change the level", async () => {
    user = await makeUser("rw-level");
    await earn(user.id, 2000);
    const before = levelFromPoints((await pointsState(user.id)).earned);

    const reward = await createReward(user.id, { name: "Day off", cost: 2000 });
    await redeemReward(user.id, reward.id);

    const state = await pointsState(user.id);
    expect(state.balance).toBe(0);
    expect(levelFromPoints(state.earned)).toBe(before);
  });

  it("sees only this account's ledger", async () => {
    user = await makeUser("rw-mine");
    const other = await makeUser("rw-theirs");
    try {
      await earn(other.id, 500);
      expect((await pointsState(user.id)).earned).toBe(0);
    } finally {
      await cleanup(other);
    }
  });
});

describe("claiming", () => {
  it("refuses what cannot be afforded", async () => {
    user = await makeUser("rw-poor");
    await earn(user.id, 10);
    const reward = await createReward(user.id, { name: "Big", cost: 500 });

    const result = await redeemReward(user.id, reward.id);
    expect(result).toEqual({ ok: false, reason: "tooExpensive" });
    expect((await pointsState(user.id)).spent).toBe(0);
  });

  it("allows exactly enough", async () => {
    user = await makeUser("rw-exact");
    await earn(user.id, 100);
    const reward = await createReward(user.id, { name: "Exact", cost: 100 });
    const result = await redeemReward(user.id, reward.id);
    expect(result.ok).toBe(true);
    expect((await pointsState(user.id)).balance).toBe(0);
  });

  it("cannot be claimed twice on one balance", async () => {
    // A stale page or a double click must not spend the same points
    // twice, which is why affordability is read inside the write.
    user = await makeUser("rw-double");
    await earn(user.id, 100);
    const reward = await createReward(user.id, { name: "Once", cost: 100 });

    expect((await redeemReward(user.id, reward.id)).ok).toBe(true);
    expect((await redeemReward(user.id, reward.id)).ok).toBe(false);
    expect((await pointsState(user.id)).spent).toBe(100);
  });

  it("refuses another account's reward, and says only that it is missing", async () => {
    user = await makeUser("rw-owner");
    const other = await makeUser("rw-intruder");
    try {
      await earn(other.id, 1000);
      const reward = await createReward(user.id, { name: "Mine", cost: 10 });
      const result = await redeemReward(other.id, reward.id);
      // "missing" rather than "tooExpensive": the other account should
      // not learn that the reward exists at all.
      expect(result).toEqual({ ok: false, reason: "missing" });
    } finally {
      await cleanup(other);
    }
  });

  it("copies the name and cost, so repricing does not rewrite history", async () => {
    user = await makeUser("rw-history");
    await earn(user.id, 200);
    const reward = await createReward(user.id, { name: "Coffee", cost: 50 });
    await redeemReward(user.id, reward.id);

    await db.reward.update({
      where: { id: reward.id },
      data: { name: "Expensive coffee", cost: 500 },
    });

    const history = await listRedemptions(user.id);
    expect(history[0]!.name).toBe("Coffee");
    expect(history[0]!.cost).toBe(50);
  });
});

describe("removing a reward", () => {
  it("archives rather than deletes, so the history survives", async () => {
    user = await makeUser("rw-archive");
    await earn(user.id, 200);
    const reward = await createReward(user.id, { name: "Gone", cost: 50 });
    await redeemReward(user.id, reward.id);
    await archiveReward(user.id, reward.id);

    expect(await listRewards(user.id)).toEqual([]);
    expect(await listRedemptions(user.id)).toHaveLength(1);
    // Spent still counts, so the balance does not silently rise.
    expect((await pointsState(user.id)).spent).toBe(50);
  });

  it("refuses to archive another account's reward", async () => {
    user = await makeUser("rw-arch-owner");
    const other = await makeUser("rw-arch-other");
    try {
      const reward = await createReward(user.id, { name: "Mine", cost: 10 });
      expect(await archiveReward(other.id, reward.id)).toBe(false);
      expect(await listRewards(user.id)).toHaveLength(1);
    } finally {
      await cleanup(other);
    }
  });

  it("cannot be archived twice", async () => {
    user = await makeUser("rw-arch-twice");
    const reward = await createReward(user.id, { name: "Once", cost: 10 });
    expect(await archiveReward(user.id, reward.id)).toBe(true);
    expect(await archiveReward(user.id, reward.id)).toBe(false);
  });
});
