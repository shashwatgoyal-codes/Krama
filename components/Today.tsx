"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/format";
import Button from "./ui/Button";

type Block = {
  id: string;
  time: string;
  minutes: number;
  title: string;
  meta: string;
  state: "done" | "now" | "idle";
};

type Task = { id: string; title: string; points: number; done: boolean };

type Props = {
  day: string;
  plan: Block[];
  unscheduled: Task[];
  pace: number;
  streakDays: number;
  committedMinutes: number;
};

const BLOCK_STYLE: Record<Block["state"], string> = {
  done: "border-l-ok bg-ok-soft",
  now: "border-l-acc bg-acc-soft",
  idle: "border-l-ln2 bg-surf2",
};

export default function Today({
  day,
  plan,
  unscheduled,
  pace: initialPace,
  streakDays,
  committedMinutes,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(unscheduled);
  const [pace, setPace] = useState(initialPace);

  function toggle(id: string) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
    // Optimistic only — the server recomputes from the ledger on save.
    setPace((p) => Math.max(0, Math.min(100, p + (task.done ? -3 : 3))));
  }

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.45fr_1fr]">
      {/* ---------------- the plan ---------------- */}
      <section className="min-w-0 border-r border-ln bg-surf px-5 py-[18px]">
        <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
          <span className="font-display text-base font-semibold tracking-[-0.02em]">
            The plan
          </span>
          <span className="label-xs">
            {formatDuration(committedMinutes)} committed
          </span>
        </div>

        {plan.map((b) => (
          <div className="flex gap-[11px] py-2" key={b.id}>
            <div className="w-[54px] flex-none text-right">
              <div className="tabular font-mono text-[11px] font-semibold text-ink2">
                {b.time}
              </div>
              <div className="mt-px font-mono text-[9.5px] text-fai">
                {formatDuration(b.minutes)}
              </div>
            </div>
            <div
              className={`flex-1 rounded-r-[9px] border-l-2 px-[11px] py-2 ${BLOCK_STYLE[b.state]}`}
            >
              <div className="text-[13px] font-semibold">{b.title}</div>
              <div className="mt-0.5 text-[11px] text-mut">{b.meta}</div>
            </div>
          </div>
        ))}

        <div className="mt-2 rounded-[9px] border border-dashed border-ln2 p-3 text-center">
          <span className="label-xs">Drag a task here to schedule it</span>
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-ln pt-3">
          <span className="label-xs">Pace</span>
          <div className="h-[3px] w-[110px] overflow-hidden rounded-sm bg-ln">
            <div
              className="h-full rounded-sm bg-acc transition-[width] duration-500"
              style={{ width: `${pace}%` }}
            />
          </div>
          <span className="tabular text-[13px] font-semibold">{pace}</span>
          <span className="label-xs ml-auto">{streakDays}-day streak</span>
        </div>
      </section>

      {/* ---------------- unscheduled ---------------- */}
      <aside className="min-w-0 bg-surf2 p-[18px]">
        <div className="mb-3.5 flex items-baseline justify-between gap-2.5">
          <span className="font-display text-[13.5px] font-semibold tracking-[-0.02em]">
            Unscheduled
          </span>
          <span className="label-xs tabular">
            {doneCount ? `${doneCount} done · ` : ""}
            {tasks.length}
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-ln2 px-[22px] py-[26px] text-center">
            <div className="text-[13.5px] font-semibold text-ink">
              Nothing waiting
            </div>
            <p className="mx-auto mt-1 max-w-[44ch] text-[12.5px] text-mut">
              Anything you capture lands here until you give it a time.
            </p>
            <Button className="mt-3.5">Add a task</Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                role="checkbox"
                aria-checked={t.done}
                onClick={() => toggle(t.id)}
                className={
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-[9px] border px-[11px] py-[9px] text-left transition-colors " +
                  (t.done
                    ? "border-ok bg-ok-soft"
                    : "border-ln bg-surf hover:border-acc")
                }
              >
                <span
                  className={
                    "grid size-[17px] flex-none place-items-center rounded-[5px] border-[1.5px] transition-colors " +
                    (t.done ? "border-ok bg-ok" : "border-ln2")
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--on-acc)"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`size-2.5 transition-opacity ${t.done ? "opacity-100" : "opacity-0"}`}
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span
                  className={
                    "min-w-0 flex-1 text-[13px] " +
                    (t.done ? "text-mut line-through" : "text-ink")
                  }
                >
                  {t.title}
                </span>
                <span
                  className={
                    "tabular whitespace-nowrap font-mono text-[11.5px] font-semibold " +
                    (t.done ? "text-ok" : "text-acc")
                  }
                >
                  +{t.points}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-[18px]">
          <span className="label-xs">{day}</span>
        </div>
      </aside>
    </div>
  );
}
