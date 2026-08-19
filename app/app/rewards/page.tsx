import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import {
  listRewards,
  listRedemptions,
  pointsState,
} from "@/lib/repositories/rewards";
import { getSettings } from "@/lib/repositories/profile";
import { describeReward, nextGoal, daysAway } from "@/lib/rewards";
import RewardList from "@/components/rewards/RewardList";

export const metadata: Metadata = {
  title: "Rewards · Krama",
  robots: { index: false, follow: false },
};

export default async function RewardsPage() {
  const user = await requireUser();
  const [settings, state, rewards, history] = await Promise.all([
    getSettings(user.id),
    pointsState(user.id),
    listRewards(user.id),
    listRedemptions(user.id),
  ]);

  // Nothing to spend on a page that hides the score anyway.
  if (settings.scoringVisibility === "hidden") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-8">
        <h1 className="font-display text-[17px] font-semibold">Rewards</h1>
        <p className="mt-2 max-w-[52ch] text-[12.5px] leading-relaxed text-mut">
          Scoring is switched off, so there is no balance to spend. Turn it
          back on under Profile → Scoring if you want rewards back.
        </p>
      </div>
    );
  }

  const views = rewards.map((r) => describeReward(r, state.balance));
  const goal = nextGoal(rewards, state.balance);
  const perDay = Math.max(1, settings.dailyTargetPoints);
  const away = goal ? daysAway(goal.shortBy, perDay) : null;

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6">
      <h1 className="font-display text-[17px] font-semibold tracking-[-0.015em]">
        Rewards
      </h1>
      <p className="mt-1 text-[12px] text-mut">
        What the points are for.
      </p>

      {/* the balance */}
      <div className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-ln bg-ln">
        <div className="bg-surf px-4 py-4">
          <p className="label-xs">To spend</p>
          <p className="tabular mt-1 font-display text-[26px] font-semibold leading-none text-acc">
            {state.balance}
          </p>
        </div>
        <div className="bg-surf px-4 py-4">
          <p className="label-xs">Earned in total</p>
          <p className="tabular mt-1 font-display text-[26px] font-semibold leading-none text-ink">
            {state.earned}
          </p>
        </div>
        <div className="bg-surf px-4 py-4">
          <p className="label-xs">Claimed so far</p>
          <p className="tabular mt-1 font-display text-[26px] font-semibold leading-none text-mut">
            {state.spent}
          </p>
        </div>
      </div>

      {goal && (
        <div className="mt-3 rounded-lg border border-ln bg-surf2 px-3.5 py-3">
          <p className="text-[12.5px] text-ink">
            <span className="font-semibold">{goal.name}</span> is{" "}
            <span className="tabular font-semibold">{goal.shortBy}</span> points
            away
            {away !== null && away > 0 && (
              <>
                {" "}
                — about {away} {away === 1 ? "day" : "days"} at your usual pace
              </>
            )}
            .
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ln">
            <div
              className="h-full rounded-full bg-acc"
              style={{
                width: `${Math.min(100, Math.round((state.balance / goal.cost) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-6">
        <RewardList rewards={views} />
      </div>

      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="font-display text-[13.5px] font-semibold">
            Already claimed
          </h2>
          <ul className="mt-2 divide-y divide-ln border-y border-ln">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-baseline justify-between gap-3 py-2.5"
              >
                <span className="min-w-0 truncate text-[12.5px] text-ink">
                  {entry.name}
                </span>
                <span className="tabular flex-none text-[11.5px] text-mut">
                  {entry.cost} ·{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    day: "numeric",
                    month: "short",
                    timeZone: settings.timezone,
                  }).format(entry.redeemedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
