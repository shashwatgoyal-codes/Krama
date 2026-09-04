"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { KEEP_OPTIONS, NEVER_REMOVED, RETENTION } from "@/lib/retention";
import { saveRetention } from "@/app/app/profile/retention-actions";

/**
 * What Krama removes on its own, and what it never touches.
 *
 * Written out rather than left implicit because "does this app delete my
 * things?" is a fair question with a real answer, and an answer nobody
 * can find is the same as no answer.
 */
export default function RetentionPanel({
  keepFinishedDays,
  wouldRemove,
}: {
  keepFinishedDays: number;
  wouldRemove: { droppedRoutines: number; finishedTasks: number };
}) {
  const toast = useToast();
  const [keep, setKeep] = useState(keepFinishedDays);
  const [pending, startTransition] = useTransition();

  function save(next: number) {
    const previous = keep;
    setKeep(next);
    startTransition(async () => {
      const data = new FormData();
      data.set("keepFinishedDays", String(next));
      const result = await saveRetention(data);
      if (result.ok) toast.success("Saved.");
      else {
        setKeep(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[12px] font-semibold text-ink">
          Tidied up on its own
        </p>
        <p className="mt-1 max-w-[58ch] text-[11.5px] leading-relaxed text-mut">
          Krama clears out rows that only record an absence, once a day, the
          next time you open it. A routine day you skipped is kept for{" "}
          {RETENTION.droppedRoutineDays} days so you can notice a pattern, then
          removed. Expired sign-ins and used one-time codes go too. None of this
          costs you anything you could look at.
        </p>
        {wouldRemove.droppedRoutines > 0 && (
          <p className="mt-1.5 text-[11px] text-fai">
            {wouldRemove.droppedRoutines} skipped routine{" "}
            {wouldRemove.droppedRoutines === 1 ? "day is" : "days are"} old
            enough to go on the next sweep.
          </p>
        )}
      </div>

      <div>
        <p className="text-[12px] font-semibold text-ink">
          Keep finished tasks
        </p>
        <p className="mt-1 max-w-[58ch] text-[11.5px] leading-relaxed text-mut">
          Your points are not affected by this. They live in a separate ledger
          that records what you did rather than pointing at the task, so
          removing an old task removes the plan and keeps the history.
        </p>

        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {KEEP_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={pending}
              onClick={() => save(o.value)}
              aria-pressed={keep === o.value}
              className={
                "cursor-pointer rounded-full border px-3 py-[5px] text-[11.5px] font-medium transition-colors disabled:opacity-50 " +
                (keep === o.value
                  ? "border-ink bg-ink text-paper"
                  : "border-ln2 text-mut hover:border-ink2 hover:text-ink")
              }
            >
              {o.label}
            </button>
          ))}
        </div>

        {keep > 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-warn">
            {wouldRemove.finishedTasks > 0
              ? `${wouldRemove.finishedTasks} finished ${
                  wouldRemove.finishedTasks === 1 ? "task is" : "tasks are"
                } older than this and will be removed on the next sweep.`
              : "Nothing you have finished is older than this yet."}
          </p>
        )}
      </div>

      <div>
        <p className="text-[12px] font-semibold text-ink">Never removed</p>
        <ul className="mt-1.5 flex flex-col gap-1">
          {NEVER_REMOVED.map((line) => (
            <li
              key={line}
              className="max-w-[58ch] text-[11.5px] leading-relaxed text-mut"
            >
              — {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
