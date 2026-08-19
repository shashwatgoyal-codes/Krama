"use client";

import { useTransition, useOptimistic } from "react";
import { toggleTask } from "@/app/app/actions";

export type TaskItem = {
  id: string;
  title: string;
  points: number;
  done: boolean;
  recurring: boolean;
};

/**
 * Ticking is optimistic — the row flips immediately and the server
 * reconciles. Waiting on a round trip to acknowledge a checkbox is the
 * difference between an app that feels alive and one that feels like
 * paperwork.
 */
export default function TaskRow({
  task,
  showPoints,
}: {
  task: TaskItem;
  showPoints: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useOptimistic(task.done);

  function toggle() {
    startTransition(async () => {
      setDone(!done);
      const data = new FormData();
      data.set("id", task.id);
      await toggleTask(data);
    });
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      disabled={pending}
      onClick={toggle}
      className={
        "flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border px-[11px] py-[9px] text-left transition-colors disabled:opacity-70 " +
        (done ? "border-ok bg-ok-soft" : "border-ln bg-surf hover:border-acc")
      }
    >
      <span
        className={
          "grid size-[17px] flex-none place-items-center rounded-[5px] border-[1.5px] transition-colors " +
          (done ? "border-ok bg-ok" : "border-ln2")
        }
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--on-acc)"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`size-2.5 transition-opacity ${done ? "opacity-100" : "opacity-0"}`}
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>

      <span
        className={
          "min-w-0 flex-1 truncate text-[13px] " +
          (done ? "text-mut line-through" : "text-ink")
        }
      >
        {task.title}
      </span>

      {task.recurring && (
        <span className="rounded border border-ln px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wide text-fai">
          repeats
        </span>
      )}

      {showPoints && (
        <span
          className={
            "tabular whitespace-nowrap font-mono text-[11.5px] font-semibold " +
            (done ? "text-ok" : "text-acc")
          }
        >
          +{task.points}
        </span>
      )}
    </button>
  );
}
