import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import {
  listBlocksBetween,
  scheduledTaskIdsBetween,
} from "@/lib/repositories/events";
import { listOpenTasks } from "@/lib/repositories/tasks";
import { listRoutineTemplates } from "@/lib/repositories/recurring";
import { projectRoutines, minuteLabel } from "@/lib/projection";
import { dayKeyFor, shiftDayKey } from "@/lib/day";
import {
  weekDays,
  describeWeek,
  monthGridDays,
  isInMonth,
  describeMonth,
  shiftMonth,
} from "@/lib/week";
import {
  dayWindow,
  formatClock,
  formatDuration,
  minutesBetween,
  totalCommitted,
  zonedTimeToInstant,
} from "@/lib/time";
import WeekGrid, {
  type WeekBlock,
  type WeekColumn,
} from "@/components/calendar/WeekGrid";
import MonthGrid, { type MonthCell } from "@/components/calendar/MonthGrid";
import WaitingItem from "@/components/plan/WaitingItem";

export const metadata: Metadata = {
  title: "Calendar · Krama",
  robots: { index: false, follow: false },
};

/** Early enough for a morning routine, late enough for an evening block. */
const START_HOUR = 7;
const END_HOUR = 23;

type View = "day" | "week" | "month";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; w?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await getSettings(user.id);

  const view: View = (["day", "week", "month"] as const).includes(
    params.view as View,
  )
    ? (params.view as View)
    : "week";

  const todayKey = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.w ?? "")
    ? (params.w as string)
    : todayKey;

  const days =
    view === "day"
      ? [anchor]
      : view === "week"
        ? weekDays(anchor, settings.weekStartsOn)
        : monthGridDays(anchor, settings.weekStartsOn);

  const from = zonedTimeToInstant(days[0], 0, 0, settings.timezone);
  const to = zonedTimeToInstant(
    shiftDayKey(days[days.length - 1], 1),
    0,
    0,
    settings.timezone,
  );

  const [blocks, open, scheduledHere, routines] = await Promise.all([
    listBlocksBetween(user.id, from, to),
    listOpenTasks(user.id),
    // Scoped to what's on screen. Anything visible in the grid must not
    // also be sitting in the "unscheduled" list next to it.
    scheduledTaskIdsBetween(user.id, from, to),
    listRoutineTemplates(user.id),
  ]);

  /** Which of `days` a block sits on, by calendar date in the user's zone. */
  function columnOf(startsAt: Date): number {
    return days.findIndex((d) => {
      const { start, end } = dayWindow(d, settings.timezone, 0);
      return startsAt >= start && startsAt < end;
    });
  }

  const columns: WeekColumn[] = days.map((dayKey) => {
    const at = new Date(`${dayKey}T00:00:00.000Z`);
    return {
      dayKey,
      weekday: new Intl.DateTimeFormat("en-GB", {
        weekday: view === "day" ? "long" : "short",
        timeZone: "UTC",
      })
        .format(at)
        .toUpperCase(),
      dayNumber: String(at.getUTCDate()),
      isToday: dayKey === todayKey,
    };
  });

  const gridBlocks: WeekBlock[] = blocks.flatMap((b) => {
    const dayIndex = columnOf(b.startsAt);
    if (dayIndex === -1) return [];

    const clock = formatClock(b.startsAt, settings.timezone);
    const shown = formatClock(b.startsAt, settings.timezone, settings.timeFormat as "12" | "24");
    const offsetMinutes =
      (Number(clock.slice(0, 2)) - START_HOUR) * 60 + Number(clock.slice(3, 5));
    if (offsetMinutes < 0) return [];

    const durationMinutes = minutesBetween(b.startsAt, b.endsAt);
    return [
      {
        id: b.id,
        title: b.title,
        dayIndex,
        offsetMinutes,
        durationMinutes,
        clock: shown,
        duration: formatDuration(durationMinutes),
        done: b.taskDone,
      },
    ];
  });

  /**
   * Routines drawn where they fall, without rows behind them.
   *
   * A day that already holds a real block for the same routine is left
   * alone, so a scheduled occurrence is never shown twice — once as
   * itself and once as a ghost of itself.
   */
  const occupied = new Set<string>();
  for (const b of blocks) {
    if (!b.taskId) continue;
    const index = columnOf(b.startsAt);
    if (index >= 0) occupied.add(`${b.taskId}:${days[index]}`);
  }

  const projected = projectRoutines(routines, days, occupied);

  // Routines that fall before the grid starts are pinned to the first
  // row rather than dropped. A block at 01:04 used to vanish silently,
  // which reads as "the calendar is broken" — showing it at the top,
  // labelled with its real time, at least tells the truth.
  const allDayBlocks: WeekBlock[] = [];

  for (const p of projected) {
    const dayIndex = days.indexOf(p.dayKey);
    if (dayIndex === -1) continue;

    const entry: WeekBlock = {
      id: p.key,
      title: p.title,
      dayIndex,
      offsetMinutes: Math.max(0, p.startMinute - START_HOUR * 60),
      durationMinutes: p.minutes,
      clock: minuteLabel(p.startMinute),
      duration: formatDuration(p.minutes),
      done: false,
      projected: true,
    };

    // A routine with no hour of its own goes in the all-day band rather
    // than at a time nobody chose.
    if (p.allDay) allDayBlocks.push(entry);
    else gridBlocks.push(entry);
  }

  const monthCells: MonthCell[] = days.map((dayKey, index) => ({
    dayKey,
    dayNumber: String(new Date(`${dayKey}T00:00:00.000Z`).getUTCDate()),
    inMonth: isInMonth(dayKey, anchor),
    isToday: dayKey === todayKey,
    // Real blocks and projected routines together. The month view read
    // only the stored ones, so a routine that showed all week in the week
    // view was absent from the month — the same calendar disagreeing with
    // itself depending on which button you pressed.
    blocks: [
      ...blocks
        .filter((b) => columnOf(b.startsAt) === index)
        .map((b) => ({
          id: b.id,
          title: b.title,
          clock: formatClock(
            b.startsAt,
            settings.timezone,
            settings.timeFormat as "12" | "24",
          ),
          done: b.taskDone,
        })),
      ...projected
        .filter((p) => p.dayKey === dayKey)
        .map((p) => ({
          id: p.key,
          title: p.title,
          clock: p.allDay ? "" : minuteLabel(p.startMinute),
          done: false,
        })),
    ],
  }));

  const waiting = open
    .filter((t) => !scheduledHere.has(t.id))
    .map((t) => ({
      id: t.id,
      title: t.title,
      points: t.points,
      done: false,
      recurring: t.recurrence !== "none",
    }));

  const todayBlocks = blocks.filter((b) => {
    const { start, end } = dayWindow(
      todayKey,
      settings.timezone,
      settings.dayEndsAtHour,
    );
    return b.startsAt >= start && b.startsAt < end;
  });

  // Stepping back and forward means something different in each view.
  const step = (delta: number) =>
    view === "month"
      ? shiftMonth(anchor, delta)
      : shiftDayKey(anchor, delta * (view === "day" ? 1 : 7));

  const heading =
    view === "day"
      ? new Intl.DateTimeFormat("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        }).format(new Date(`${anchor}T00:00:00.000Z`))
      : view === "week"
        ? describeWeek(days)
        : describeMonth(anchor);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-ln bg-surf px-4 py-2.5">
        <Link
          href={`/app/calendar?view=${view}&w=${step(-1)}`}
          aria-label="Previous"
          className="rounded-[7px] border border-ln2 px-2 py-1 text-[12.5px] font-semibold text-ink2 hover:border-acc hover:text-acc"
        >
          ‹
        </Link>
        <span className="text-[13.5px] font-semibold">{heading}</span>
        <Link
          href={`/app/calendar?view=${view}&w=${step(1)}`}
          aria-label="Next"
          className="rounded-[7px] border border-ln2 px-2 py-1 text-[12.5px] font-semibold text-ink2 hover:border-acc hover:text-acc"
        >
          ›
        </Link>

        <div className="ml-2 inline-flex overflow-hidden rounded-[7px] border border-ln2">
          {(["day", "week", "month"] as const).map((option) => (
            <Link
              key={option}
              href={`/app/calendar?view=${option}&w=${anchor}`}
              aria-current={option === view ? "page" : undefined}
              className={
                "px-2.5 py-[5px] text-[11.5px] font-semibold capitalize " +
                (option === view
                  ? "bg-acc text-on-acc"
                  : "text-mut hover:text-acc")
              }
            >
              {option}
            </Link>
          ))}
        </div>

        {anchor !== todayKey && (
          <Link
            href={`/app/calendar?view=${view}`}
            className="rounded-[7px] border border-ln2 px-2.5 py-1 text-[12px] font-semibold text-mut hover:border-acc hover:text-acc"
          >
            Today
          </Link>
        )}

        <span className="label-xs ml-auto tabular">
          {totalCommitted(todayBlocks)} scheduled today
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.9fr_1fr]">
        <div className="min-w-0 overflow-x-auto border-r border-ln bg-surf">
          {view === "month" ? (
            <MonthGrid cells={monthCells} startsOn={settings.weekStartsOn} />
          ) : (
            <WeekGrid
              columns={columns}
              blocks={gridBlocks}
              allDay={allDayBlocks}
              startHour={START_HOUR}
              endHour={END_HOUR}
            />
          )}
        </div>

        <aside className="min-w-0 bg-surf2 p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2.5">
            <span className="font-display text-[13px] font-semibold tracking-[-0.02em]">
              Unscheduled
            </span>
            <span className="label-xs tabular">{waiting.length}</span>
          </div>

          {waiting.length === 0 ? (
            <p className="rounded-lg border border-dashed border-ln2 px-3 py-4 text-center text-[11.5px] leading-relaxed text-mut">
              Nothing waiting.
            </p>
          ) : (
            waiting.map((t) => (
              <WaitingItem
                key={t.id}
                task={t}
                showPoints={settings.scoringVisibility !== "hidden"}
              />
            ))
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-fai">
            {view === "month"
              ? "Pick a day to place something on it — a month cell has no room to show a time honestly."
              : "Drag a task onto any slot to schedule it, or drag a block to move it."}
          </p>
        </aside>
      </div>
    </div>
  );
}
