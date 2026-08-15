"use client";

import { useState } from "react";
import { formatDuration } from "@/lib/format";

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
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
    const task = tasks.find((t) => t.id === id);
    if (task) {
      // Optimistic only for now — the server recomputes on save.
      setPace((p) => Math.max(0, Math.min(100, p + (task.done ? -3 : 3))));
    }
  }

  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className="two">
      <section className="pl">
        <div className="ph">
          <span className="t">The plan</span>
          <span className="lab">{formatDuration(committedMinutes)} committed</span>
        </div>

        {plan.map((b) => (
          <div className="blk" key={b.id}>
            <div className="tcol">
              <div className="s">{b.time}</div>
              <div className="d">{formatDuration(b.minutes)}</div>
            </div>
            <div
              className={
                "cd" + (b.state === "done" ? " done" : b.state === "idle" ? " idle" : "")
              }
            >
              <div className="ti">{b.title}</div>
              <div className="mt">{b.meta}</div>
            </div>
          </div>
        ))}

        <div className="drop">
          <span className="lab">Drag a task here to schedule it</span>
        </div>

        <div className="pacebar">
          <span className="lab">Pace</span>
          <div className="meter" style={{ width: 110 }}>
            <i style={{ width: `${pace}%` }} />
          </div>
          <span className="num" style={{ fontSize: 13, fontWeight: 650 }}>
            {pace}
          </span>
          <span className="lab" style={{ marginLeft: "auto" }}>
            {streakDays}-day streak
          </span>
        </div>
      </section>

      <aside className="pr">
        <div className="ph">
          <span className="t sm">Unscheduled</span>
          <span className="lab num">
            {doneCount ? `${doneCount} done · ` : ""}
            {tasks.length}
          </span>
        </div>

        {tasks.length === 0 ? (
          <div className="empty">
            <div className="et">Nothing waiting</div>
            <div className="ed">
              Anything you capture lands here until you give it a time.
            </div>
            <button className="btn" type="button">
              Add a task
            </button>
          </div>
        ) : (
          <div className="tasks">
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                className={"task" + (t.done ? " done" : "")}
                onClick={() => toggle(t.id)}
                role="checkbox"
                aria-checked={t.done}
              >
                <span className="tick">
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--onAcc)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span className="tt">{t.title}</span>
                <span className="pts">+{t.points}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: 18 }}>
          <span className="lab">{day}</span>
        </div>
      </aside>
    </div>
  );
}
