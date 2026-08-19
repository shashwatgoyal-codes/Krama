"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { addReward, removeReward, claimReward } from "@/app/app/rewards/actions";
import type { RewardView } from "@/lib/rewards";

/**
 * The rewards themselves.
 *
 * A reward you cannot afford is shown anyway, with how far off it is.
 * Hiding it would remove the only reason the number on the Today page
 * means anything — you are meant to be able to see what you are working
 * toward, not just what you could cash in this second.
 */
export default function RewardList({ rewards }: { rewards: RewardView[] }) {
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(
    action: (data: FormData) => Promise<{ ok: boolean; error?: string }>,
    data: FormData,
    onOk?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (result.ok) onOk?.();
      else setError(result.error ?? "That didn't work.");
    });
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[13.5px] font-semibold">
          What you can claim
        </h2>
        {!adding && (
          <Button type="button" size="sm" onClick={() => setAdding(true)}>
            New reward
          </Button>
        )}
      </div>

      {adding && (
        <form
          action={(data) => run(addReward, data, () => setAdding(false))}
          className="mt-3 rounded-lg border border-ln bg-surf2 p-3"
        >
          <div className="flex flex-wrap gap-2">
            <input
              name="name"
              required
              autoFocus
              maxLength={60}
              placeholder="A film, a day off, that thing you keep not buying"
              aria-label="Reward name"
              className="min-w-0 flex-1 rounded-md border border-ln2 bg-surf px-2 py-1.5 text-[12.5px] text-ink placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft"
            />
            <input
              type="number"
              name="cost"
              required
              min={1}
              defaultValue={200}
              aria-label="Cost in points"
              className="tabular w-[92px] rounded-md border border-ln2 bg-surf px-2 py-1.5 text-[12.5px] text-ink focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft"
            />
          </div>
          <div className="mt-2 flex gap-2">
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Adding…" : "Add it"}
            </Button>
            <Button type="button" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {rewards.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-ln2 px-5 py-8 text-center text-[12.5px] leading-relaxed text-mut">
          Nothing to claim yet. Name something you actually want and price
          it — the points only mean something once they buy you something.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ln border-y border-ln">
          {rewards.map((reward) => (
            <li
              key={reward.id}
              className="flex flex-wrap items-center gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">
                  {reward.name}
                </p>
                <p className="mt-0.5 text-[11.5px] text-mut">
                  <span className="tabular font-semibold">{reward.cost}</span>{" "}
                  points
                  {!reward.affordable && (
                    <>
                      {" · "}
                      <span className="tabular">{reward.shortBy}</span> to go
                    </>
                  )}
                </p>
              </div>

              <div className="flex flex-none items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={reward.affordable ? "primary" : undefined}
                  disabled={pending || !reward.affordable}
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", reward.id);
                    run(claimReward, data);
                  }}
                >
                  {reward.affordable ? "Claim it" : "Not yet"}
                </Button>
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Remove ${reward.name}`}
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", reward.id);
                    run(removeReward, data);
                  }}
                  className="cursor-pointer rounded-md border border-ln2 px-2 py-1 text-[11px] text-mut transition-colors hover:border-bad hover:text-bad disabled:cursor-not-allowed"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
        >
          {error}
        </p>
      )}

      <p className="mt-3 text-[11px] text-fai">
        Claiming spends your balance. It never changes your level — the
        level is what you have done, and that does not un-happen because
        you took something for it.
      </p>
    </div>
  );
}
