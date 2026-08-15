import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { getSettings } from "@/lib/repositories/profile";
import { listBlocksBetween, scheduledTaskIds } from "@/lib/repositories/events";
import { listOpenTasks } from "@/lib/repositories/tasks";
import { dayKeyFor, shiftDayKey } from "@/lib/day";
import { weekDays, describeWeek } from "@/lib/week";
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
import WaitingItem from "@/components/plan/WaitingItem";

export const metadata: Metadata = {
  title: "Calendar · Krama",
  robots: { index: false, follow: false },
};

/** The window the grid draws. Early enough for a morning routine,
 *  late enough for an evening study block. */
const START_HOUR = 7;
const END_HOUR = 23;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const settings = await getSettings(user.id);

  const todayKey = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(params.w ?? "")
    ? (params.w as string)
    : todayKey;

  const days = weekDays(anchor);
  const from = zonedTimeToInstant(days[0], 0, 0, settings.timezone);
  const to = zonedTimeToInstant(shiftDayKey(days[6], 1), 0, 0, settings.timezone);

  const [blocks, open, scheduledToday] = await Promise.all([
    listBlocksBetween(user.id, from, to),
    listOpenTasks(user.id),
    scheduledTaskIds(user.id, todayKey, settings.timezone, settings.dayEndsAtHour),
  ]);

  const columns: WeekColumn[] = days.map((dayKey) => {
    const at = new Date(`${dayKey}T00:00:00.000Z`);
    return {
      dayKey,
      weekday: new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        timeZone: "UTC",
      })
        .format(at)
        .toUpperCase(),
      dayNumber: String(at.getUTCDate()),
      isToday: dayKey === todayKey,
    };
  });

  const view: WeekBlock[] = blocks.flatMap((b) => {
    // Which column a block belongs to is decided by the day whose window
    // contains it — not by its UTC date, which drifts across midnight.
    const dayIndex = days.findIndex((d) => {
      const { start, end } = dayWindow(d, settings.timezone, 0);
      return b.startsAt >= start && b.startsAt < end;
    });
    if (dayIndex === -1) return [];

    const clock = formatClock(b.startsAt, settings.timezone);
    const hour = Number(clock.slice(0, 2));
    const minute = Number(clock.slice(3, 5));
    const offsetMinutes = (hour - START_HOUR) * 60 + minute;
    if (offsetMinutes < 0) return [];

    const durationMinutes = minutesBetween(b.startsAt, b.endsAt);
    return [
      {
        id: b.id,
        title: b.title,
        dayIndex,
        offsetMinutes,
        durationMinutes,
        clock,
        duration: formatDuration(durationMinutes),
        done: b.taskDone,
      },
    ];
  });

  const waiting = open
    .filter((t) => !scheduledToday.has(t.id))
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-ln bg-surf px-4 py-2.5">
        <Link
          href={`/app/calendar?w=${shiftDayKey(days[0], -7)}`}
          aria-label="Previous week"
          className="rounded-[7px] border border-ln2 px-2 py-1 text-[12.5px] font-semibold text-ink2 hover:border-acc hover:text-acc"
        >
          ‹
        </Link>
        <span className="text-[13.5px] font-semibold">{describeWeek(days)}</span>
        <Link
          href={`/app/calendar?w=${shiftDayKey(days[0], 7)}`}
          aria-label="Next week"
          className="rounded-[7px] border border-ln2 px-2 py-1 text-[12.5px] font-semibold text-ink2 hover:border-acc hover:text-acc"
        >
          ›
        </Link>

        {anchor !== todayKey && (
          <Link
            href="/app/calendar"
            className="rounded-[7px] border border-ln2 px-2.5 py-1 text-[12px] font-semibold text-mut hover:border-acc hover:text-acc"
          >
            This week
          </Link>
        )}

        <span className="label-xs ml-auto tabular">
          {totalCommitted(todayBlocks)} scheduled today
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[1.9fr_1fr]">
        <div className="min-w-0 overflow-x-auto border-r border-ln bg-surf">
          <WeekGrid
            columns={columns}
            blocks={view}
            startHour={START_HOUR}
            endHour={END_HOUR}
          />
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
            Pressing <span className="font-semibold text-mut">Plan</span> puts a
            task on today. Dragging onto another day isn&rsquo;t wired up yet.
          </p>
        </aside>
      </div>
    </div>
  );
}
