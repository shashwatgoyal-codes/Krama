"use client";

import { useState, useTransition } from "react";
import { scheduleTask, unscheduleBlock } from "@/app/app/actions";
import { toggleTask } from "@/app/app/actions";

/**
 * The plan: what today actually looks like, with real times.
 *
 * Everything time-zone-shaped is resolved on the server and arrives here
 * as strings. A component that formats instants itself renders one thing
 * on the server and another in the browser the moment the two disagree
 * about the zone.
 */

export type PlanBlockView = {
  id: string;
  title: string;
  /** "10:00" */
  clock: string;
  /** "30m", "2h" */
  duration: string;
  /** "Office · recurring, weekdays · done" */
  meta: string;
  tone: "done" | "next" | "later";
  taskId: string | null;
};

const TONE: Record<PlanBlockView["tone"], string> = {
  // Finished — settled, not shouting.
  done: "border-l-ok bg-ok-soft",
  // The one to do next. Only ever one block wears this.
  next: "border-l-acc bg-acc-soft",
  // Still ahead, but not yet. Quiet.
  later: "border-l-ln2 bg-surf2",
};

export default function Plan({ blocks }: { blocks: PlanBlockView[] }) {
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function drop(event: React.DragEvent) {
    event.preventDefault();
    setOver(false);
    const taskId = event.dataTransfer.getData("text/krama-task");
    if (!taskId) return;

    setError(null);
    const data = new FormData();
    data.set("id", taskId);
    startTransition(async () => {
      const result = await scheduleTask(data);
      if (!result.ok) setError(result.error);
    });
  }

  function complete(taskId: string) {
    const data = new FormData();
    data.set("id", taskId);
    startTransition(() => void toggleTask(data));
  }

  function remove(id: string) {
    const data = new FormData();
    data.set("id", id);
    startTransition(() => void unscheduleBlock(data));
  }

  return (
    <div>
      {blocks.map((block) => (
        <div key={block.id} className="group flex gap-[11px] py-2">
          <div className="w-[54px] flex-none pt-0.5 text-right">
            <div className="font-mono text-[11px] font-semibold text-ink2">
              {block.clock}
            </div>
            <div className="mt-px font-mono text-[9.5px] text-fai">
              {block.duration}
            </div>
          </div>

          <div
            className={`flex min-w-0 flex-1 items-start gap-2 rounded-r-[7px] border-l-2 px-[11px] py-2 ${TONE[block.tone]}`}
          >
            <div className="min-w-0 flex-1">
              <div
                className={
                  "text-[13px] font-semibold " +
                  (block.tone === "done" ? "text-mut line-through" : "text-ink")
                }
              >
                {block.title}
              </div>
              <div className="mt-0.5 text-[11px] text-mut">{block.meta}</div>
            </div>

            {/* Only on hover: the plan is for reading first, editing second. */}
            <div className="flex flex-none gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {block.taskId && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => complete(block.taskId!)}
                  aria-label={
                    block.tone === "done"
                      ? `Mark ${block.title} as not done`
                      : `Complete ${block.title}`
                  }
                  title={block.tone === "done" ? "Not done after all" : "Complete"}
                  className="grid size-[22px] cursor-pointer place-items-center rounded-md border border-ln2 bg-surf text-ink2 hover:border-ok hover:text-ok"
                >
                  <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() => remove(block.id)}
                aria-label={`Take ${block.title} off the plan`}
                title="Take off the plan"
                className="grid size-[22px] cursor-pointer place-items-center rounded-md border border-ln2 bg-surf text-ink2 hover:border-bad hover:text-bad"
              >
                <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
        className={
          "mt-2 rounded-lg border border-dashed px-3 py-3 text-center transition-colors " +
          (over ? "border-acc bg-acc-soft" : "border-ln2")
        }
      >
        <span className="label-xs">
          {pending
            ? "Scheduling…"
            : over
              ? "Drop to schedule it"
              : "Drag a task here to schedule it"}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-[11.5px] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
