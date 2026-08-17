import Link from "next/link";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/repositories/profile";
import {
  listTasks,
  countTasks,
  getTaskPanel,
  type TaskFilter,
} from "@/lib/repositories/tasks";
import { dayKeyFor } from "@/lib/day";
import { describeRecurrence } from "@/lib/recurrence";
import { listTags } from "@/lib/repositories/tags";
import { formatClock, minutesBetween } from "@/lib/time";
import AddTask from "@/components/AddTask";
import TaskDetail, { type TaskPanelView } from "@/components/tasks/TaskDetail";

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
  searchParams: Promise<{ filter?: string; id?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const filter = (FILTERS.find((f) => f.key === params.filter)?.key ??
    "all") as TaskFilter;

  const settings = await getSettings(user.id);
  const todayKey = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);

  const [tasks, counts, areas, allTags] = await Promise.all([
    listTasks(user.id, filter, todayKey),
    countTasks(user.id, todayKey),
    db.area.findMany({
      where: { userId: user.id },
      orderBy: { order: "asc" },
      select: { id: true, name: true },
    }),
    listTags(user.id),
  ]);

  const showPoints = settings.scoringVisibility !== "hidden";

  // The detail pane follows ?id=, falling back to the first task so the
  // pane is never an empty rectangle on a page that has content.
  const selectedId =
    params.id && tasks.some((t) => t.id === params.id)
      ? params.id
      : (tasks[0]?.id ?? null);

  const panel = selectedId ? await getTaskPanel(user.id, selectedId) : null;

  const view: TaskPanelView | null = panel && {
    id: panel.id,
    title: panel.title,
    notes: panel.notes ?? "",
    done: panel.status === "done",
    points: panel.points,
    areaId: panel.areaId,
    dueOn: panel.dueOn ? panel.dueOn.toISOString().slice(0, 10) : "",
    recurrence: panel.recurrence,
    recurrenceValue: panel.recurrenceValue,
    recurrenceUntil: panel.recurrenceUntil
      ? panel.recurrenceUntil.toISOString().slice(0, 10)
      : null,
    block: panel.block && {
      id: panel.block.id,
      dayKey: dayKeyFor(panel.block.startsAt, settings.timezone, 0),
      hour: Number(formatClock(panel.block.startsAt, settings.timezone).slice(0, 2)),
      minute: Number(formatClock(panel.block.startsAt, settings.timezone).slice(3, 5)),
      durationMinutes: minutesBetween(panel.block.startsAt, panel.block.endsAt),
      label: `${formatClock(panel.block.startsAt, settings.timezone)} – ${formatClock(
        panel.block.endsAt,
        settings.timezone,
      )}`,
    },
    fromNote: panel.fromNote,
    tags: panel.tags,
    todayKey,
  };

  // Grouped by area, in the order the areas were set up, with anything
  // unfiled last rather than first.
  const groups = [
    ...areas.map((a) => ({
      name: a.name,
      items: tasks.filter((t) => t.areaId === a.id),
    })),
    { name: "Unfiled", items: tasks.filter((t) => !t.areaId) },
  ].filter((g) => g.items.length > 0);

  const href = (id: string) =>
    filter === "all" ? `/app/tasks?id=${id}` : `/app/tasks?filter=${filter}&id=${id}`;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.45fr_1fr]">
      <section className="min-w-0 border-r border-ln bg-surf px-[18px] py-4">
        <nav className="mb-3 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const active = f.key === filter;
            return (
              <Link
                key={f.key}
                href={f.key === "all" ? "/app/tasks" : `/app/tasks?filter=${f.key}`}
                aria-current={active ? "page" : undefined}
                className={
                  "rounded-md border px-2.5 py-1 text-[11.5px] font-semibold transition-colors " +
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

        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ln2 px-5 py-8 text-center text-[12.5px] leading-relaxed text-mut">
            {EMPTY[filter]}
          </p>
        ) : (
          groups.map((group) => {
            const done = group.items.filter((t) => t.status === "done").length;
            return (
              <div key={group.name}>
                <div className="flex items-baseline justify-between border-b border-ln py-2.5">
                  <span className="label-xs">{group.name}</span>
                  <span className="label-xs tabular">
                    {done} / {group.items.length}
                  </span>
                </div>

                {group.items.map((t) => {
                  const selected = t.id === selectedId;
                  return (
                    <Link
                      key={t.id}
                      href={href(t.id)}
                      aria-current={selected ? "true" : undefined}
                      className={
                        "flex items-center gap-[11px] border-b border-ln py-2.5 transition-colors " +
                        (selected
                          ? "-mx-[18px] bg-acc-soft px-[18px]"
                          : "hover:bg-surf2")
                      }
                    >
                      <span
                        className={
                          "grid size-[17px] flex-none place-items-center rounded-[5px] border-[1.5px] " +
                          (t.status === "done"
                            ? "border-ok bg-ok"
                            : "border-ln2")
                        }
                      >
                        {t.status === "done" && (
                          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="var(--paper)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        )}
                      </span>

                      <span
                        className={
                          "min-w-0 flex-1 truncate text-[13.5px] " +
                          (t.status === "done" ? "text-fai line-through" : "")
                        }
                      >
                        {t.title}
                      </span>

                      {t.recurrence !== "none" && (
                        <span className="label-xs flex-none">
                          {describeRecurrence(t.recurrence, t.recurrenceValue)}
                        </span>
                      )}
                      {showPoints && (
                        <span className="tabular flex-none text-[11px] text-fai">
                          {t.points}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })
        )}

        <div className="mt-4">
          <AddTask today={todayKey} />
        </div>
      </section>

      <aside className="min-w-0 bg-surf2 p-4">
        {view ? (
          <TaskDetail
              key={view.id}
              task={view}
              areas={areas}
              allTags={allTags}
            />
        ) : (
          <p className="rounded-lg border border-dashed border-ln2 px-3 py-5 text-center text-[11.5px] leading-relaxed text-mut">
            Pick a task to see its detail — due date, when it&rsquo;s
            scheduled, and whether it repeats.
          </p>
        )}
      </aside>
    </div>
  );
}
