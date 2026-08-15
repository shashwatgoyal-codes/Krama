import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import { listTasks, countTasks, type TaskFilter } from "@/lib/repositories/tasks";
import { dayKeyFor } from "@/lib/day";
import { describeRecurrence } from "@/lib/recurrence";
import TaskRow from "@/components/TaskRow";
import AddTask from "@/components/AddTask";

export const metadata: Metadata = {
  title: "Tasks · Krama",
  robots: { index: false, follow: false },
};

const FILTERS: { key: TaskFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "upcoming", label: "Upcoming" },
  { key: "recurring", label: "Routines" },
  { key: "done", label: "Done" },
];

const EMPTY: Record<TaskFilter, string> = {
  all: "Nothing here yet. Add the first thing you want to get done.",
  today: "Nothing filed for today.",
  upcoming: "Nothing scheduled ahead.",
  recurring:
    "No routines yet. Set one up and it will appear on its own — that's the point of them.",
  done: "Nothing finished yet. It'll collect here.",
};

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const filter = (FILTERS.find((f) => f.key === params.filter)?.key ??
    "all") as TaskFilter;

  const settings = await getSettings(user.id);
  const todayKey = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);

  const [tasks, counts] = await Promise.all([
    listTasks(user.id, filter, todayKey),
    countTasks(user.id, todayKey),
  ]);

  const showPoints = settings.scoringVisibility !== "hidden";

  return (
    <div className="mx-auto w-full max-w-[860px] px-5 py-6">
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <h1 className="font-display text-xl font-semibold tracking-[-0.025em]">
          Tasks
        </h1>
        <span className="label-xs tabular">{counts.all} total</span>
      </div>

      <nav className="mb-5 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "/app/tasks" : `/app/tasks?filter=${f.key}`}
              className={
                "rounded-md border px-2.5 py-1.5 text-[12px] font-semibold transition-colors " +
                (active
                  ? "border-acc bg-acc text-on-acc"
                  : "border-ln2 text-mut hover:border-acc hover:text-acc")
              }
            >
              {f.label}
              <span className="tabular ml-1.5 opacity-60">{counts[f.key]}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mb-5">
        <AddTask />
      </div>

      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ln2 px-5 py-8 text-center text-[12.5px] leading-relaxed text-mut">
          {EMPTY[filter]}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tasks.map((t) => (
            <div key={t.id}>
              <TaskRow
                task={{
                  id: t.id,
                  title: t.title,
                  points: t.points,
                  done: t.status === "done",
                  // On the Routines filter these are templates, and the
                  // chip would be noise — the rule is spelled out below.
                  recurring: filter !== "recurring" && !!t.recurrenceParentId,
                }}
                showPoints={showPoints}
              />
              {filter === "recurring" && (
                <p className="mt-1 pl-[38px] text-[11.5px] text-fai">
                  {describeRecurrence(t.recurrence, t.recurrenceValue)}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
