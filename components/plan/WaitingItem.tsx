"use client";

import { useTransition } from "react";
import { toggleTask, scheduleTask } from "@/app/app/actions";
import type { TaskItem } from "@/components/TaskRow";

/**
 * A task on the right-hand list, waiting to be given a time.
 *
 * Draggable onto the plan, and also schedulable with a button — drag is
 * a lovely gesture and completely unavailable to anyone using a keyboard,
 * so it can't be the only way to do this.
 */
export default function WaitingItem({
  task,
  showPoints,
}: {
  task: TaskItem & { chip?: string };
  showPoints: boolean;
}) {
  const [pending, startTransition] = useTransition();

  function run(action: (data: FormData) => Promise<unknown>) {
    const data = new FormData();
    data.set("id", task.id);
    startTransition(() => void action(data));
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/krama-task", task.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={
        "group mb-1.5 flex cursor-grab items-center gap-2.5 rounded-[7px] border border-ln bg-surf px-2.5 py-2 " +
        "transition-colors hover:border-ln2 active:cursor-grabbing " +
        (pending ? "opacity-50" : "")
      }
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => run(toggleTask)}
        aria-label={`Complete ${task.title}`}
        className="grid size-[17px] flex-none cursor-pointer place-items-center rounded-[5px] border-[1.5px] border-ln2 hover:border-ok"
      />

      <span className="min-w-0 flex-1 truncate text-[12.5px]">{task.title}</span>

      {task.chip && <span className="label-xs flex-none">{task.chip}</span>}
      {showPoints && (
        <span className="tabular flex-none text-[11px] text-fai">
          {task.points}
        </span>
      )}

      <button
        type="button"
        disabled={pending}
        onClick={() => run(scheduleTask)}
        title="Put it on the plan"
        aria-label={`Schedule ${task.title}`}
        className="flex-none cursor-pointer rounded-md border border-ln2 px-1.5 py-0.5 text-[10px] font-semibold text-mut opacity-0 transition-opacity hover:border-acc hover:text-acc group-hover:opacity-100 focus:opacity-100"
      >
        Plan
      </button>
    </div>
  );
}
