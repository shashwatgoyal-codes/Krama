import TaskRow, { type TaskItem } from "./TaskRow";
import AddTask from "./AddTask";
import type { TodayStats } from "@/lib/repositories/profile";

export default function Today({
  name,
  day,
  today,
  unscheduled,
  stats,
  showScoring,
}: {
  name: string;
  day: string;
  today: TaskItem[];
  unscheduled: TaskItem[];
  stats: TodayStats;
  showScoring: boolean;
}) {
  const doneCount = today.filter((t) => t.done).length;
  const firstName = name.split(" ")[0];
  const nothingAtAll = today.length === 0 && unscheduled.length === 0;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.45fr_1fr]">
      {/* ---------------- the plan ---------------- */}
      <section className="min-w-0 border-r border-ln bg-surf px-5 py-[18px]">
        <div className="mb-4 flex items-baseline justify-between gap-2.5">
          <span className="font-display text-base font-semibold tracking-[-0.02em]">
            Today
          </span>
          <span className="label-xs tabular">
            {today.length > 0
              ? `${doneCount} of ${today.length} done`
              : day}
          </span>
        </div>

        {nothingAtAll ? (
          /* First run. Someone arriving here has none of the context the
             app assumes, so say what it's for before asking for input. */
          <div className="rounded-xl border border-dashed border-ln2 px-6 py-8 text-center">
            <div className="font-display text-[15px] font-semibold">
              Good to see you, {firstName}.
            </div>
            <p className="mx-auto mt-2 max-w-[46ch] text-[12.5px] leading-relaxed text-mut">
              Krama keeps score of what you actually do — not what other people
              decide. Add the first thing you want to get done today, however
              small. Three of them clears the day.
            </p>
            <div className="mx-auto mt-5 max-w-[340px]">
              <AddTask autoFocus />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              {today.length === 0 ? (
                <p className="rounded-[9px] border border-dashed border-ln2 px-4 py-5 text-center text-[12.5px] text-mut">
                  Nothing on today yet. Add something, or pull one across from
                  the right.
                </p>
              ) : (
                today.map((t) => (
                  <TaskRow key={t.id} task={t} showPoints={showScoring} />
                ))
              )}
            </div>

            <div className="mt-3">
              <AddTask />
            </div>
          </>
        )}

        {showScoring && !nothingAtAll && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-ln pt-3.5">
            <span className="label-xs">Pace</span>
            <div className="h-[3px] w-[110px] overflow-hidden rounded-sm bg-ln">
              <div
                className="h-full rounded-sm bg-acc transition-[width] duration-500"
                style={{ width: `${stats.pace}%` }}
              />
            </div>
            <span className="tabular text-[13px] font-semibold">
              {stats.pace}
            </span>

            <span className="label-xs ml-auto tabular">
              {stats.floorCleared
                ? "floor cleared"
                : `${stats.actionsToday} of ${stats.dailyFloor} today`}
            </span>
            {stats.streakDays > 0 && (
              <span className="label-xs tabular">
                {stats.streakDays}-day streak
              </span>
            )}
          </div>
        )}
      </section>

      {/* ---------------- unscheduled ---------------- */}
      <aside className="min-w-0 bg-surf2 p-[18px]">
        <div className="mb-4 flex items-baseline justify-between gap-2.5">
          <span className="font-display text-[13.5px] font-semibold tracking-[-0.02em]">
            Waiting
          </span>
          <span className="label-xs tabular">{unscheduled.length}</span>
        </div>

        {unscheduled.length === 0 ? (
          <p className="rounded-[9px] border border-dashed border-ln2 px-4 py-5 text-center text-[12.5px] leading-relaxed text-mut">
            Anything you add that isn&rsquo;t for today waits here.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {unscheduled.map((t) => (
              <TaskRow key={t.id} task={t} showPoints={showScoring} />
            ))}
          </div>
        )}

        {showScoring && (
          <div className="mt-5 border-t border-ln pt-3.5">
            <div className="flex items-baseline justify-between">
              <span className="label-xs">Level {stats.level}</span>
              <span className="label-xs tabular">
                {stats.into} / {stats.needed}
              </span>
            </div>
            <div className="mt-2 h-[3px] overflow-hidden rounded-sm bg-ln">
              <div
                className="h-full rounded-sm bg-acc"
                style={{
                  width: `${stats.needed ? (stats.into / stats.needed) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
