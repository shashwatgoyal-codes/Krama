"use client";
import { clockLabel, type TimeFormat } from "@/lib/time";

import { useEffect, useRef, useState, useTransition } from "react";
import { scheduleTaskAt, moveBlockToHour } from "@/app/app/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * The week (or a single day) as a grid. Times down the side, days
 * across the top, blocks positioned inside their column.
 *
 * Every value here is pre-resolved on the server — a component that
 * computes hours from an instant will disagree with the server about
 * the zone the moment the two differ.
 */

export type WeekBlock = {
  id: string;
  title: string;
  /** 0-based column. */
  dayIndex: number;
  /** Offset from the top of the grid, in minutes. */
  offsetMinutes: number;
  durationMinutes: number;
  clock: string;
  duration: string;
  done: boolean;
  /** Drawn from a routine rather than a stored block. */
  projected?: boolean;
  /**
   * A routine's real row for the day, never put in the diary. It knows
   * whether it was done, which a projection cannot, but has no block
   * behind it to move.
   */
  unscheduled?: boolean;
};

export type WeekColumn = {
  dayKey: string;
  weekday: string;
  dayNumber: string;
  isToday: boolean;
};

const ROW_HEIGHT = 44;

/** Where the grid sits when it opens. Early enough for a 07:00 start. */
const OPEN_AT_HOUR = 7;

export default function WeekGrid({
  columns,
  blocks,
  allDay = [],
  startHour,
  endHour,
  timeFormat = "24",
}: {
  columns: WeekColumn[];
  blocks: WeekBlock[];
  /** Routines with no time of their own, shown above the hours. */
  allDay?: WeekBlock[];
  startHour: number;
  endHour: number;
  /** The reader's clock. The gutter used to be 24-hour whatever they chose. */
  timeFormat?: TimeFormat;
}) {
  const [target, setTarget] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const scroller = useRef<HTMLDivElement>(null);

  // Open near the working day rather than at midnight. A 24-hour grid
  // that starts at 00:00 shows six empty hours and hides the ones people
  // actually use; every calendar scrolls past them on load.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = Math.max(0, (OPEN_AT_HOUR - startHour) * ROW_HEIGHT);
  }, [startHour]);

  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i,
  );

  function drop(event: React.DragEvent, dayKey: string, hour: number) {
    event.preventDefault();
    setTarget(null);
    setError(null);

    const taskId = event.dataTransfer.getData("text/krama-task");
    const blockId = event.dataTransfer.getData("text/krama-block");
    if (!taskId && !blockId) return;

    const data = new FormData();
    data.set("id", taskId || blockId);
    data.set("dayKey", dayKey);
    data.set("hour", String(hour));

    startTransition(async () => {
      const result = taskId
        ? await scheduleTaskAt(data)
        : await moveBlockToHour(data);
      if (!result.ok) setError(result.error);
      else toast.success(taskId ? "Scheduled." : "Moved.");
    });
  }

  return (
    <div className={columns.length > 1 ? "min-w-[720px]" : ""}>
      {/* header */}
      <div
        className="grid border-b border-ln"
        style={{ gridTemplateColumns: `48px repeat(${columns.length}, 1fr)` }}
      >
        <div className="border-r border-ln" />
        {columns.map((col) => (
          <div
            key={col.dayKey}
            className="border-r border-ln px-1.5 py-2 text-center"
          >
            <div className="font-mono text-[9.5px] tracking-[0.1em] text-fai">
              {col.weekday}
            </div>
            <div
              className={
                "mt-px font-display text-[15px] font-semibold " +
                (col.isToday ? "text-acc" : "")
              }
            >
              {col.dayNumber}
            </div>
          </div>
        ))}
      </div>

      {/* All-day band. A routine with no time still happens on the day,
          so it belongs on the calendar — just not at an hour it never
          claimed. Empty rows are not drawn at all, so the grid keeps its
          height when nothing is untimed. */}
      {allDay.length > 0 && (
        <div
          className="grid border-b border-ln bg-surf2"
          style={{ gridTemplateColumns: `48px repeat(${columns.length}, 1fr)` }}
        >
          <div className="border-r border-ln px-1.5 py-1 text-right font-mono text-[9px] tracking-[0.08em] text-fai">
            ALL DAY
          </div>
          {columns.map((col, index) => (
            <div
              key={col.dayKey}
              className="min-h-[24px] border-r border-ln px-1 py-1"
            >
              {allDay
                .filter((b) => b.dayIndex === index)
                .map((b) => (
                  <div
                    key={b.id}
                    title={`${b.title} — no time set`}
                    className="mb-0.5 truncate rounded-[4px] border border-dashed border-ln2 border-l-2 border-l-acc px-[6px] py-[2px] text-[10.5px] text-ink"
                  >
                    {b.title}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {/* body — the whole day, scrolled rather than truncated */}
      <div ref={scroller} className="max-h-[62vh] overflow-y-auto">
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `48px repeat(${columns.length}, 1fr)` }}
        >
          <div className="border-r border-ln">
            {hours.map((h) => (
              <div
                key={h}
                className="border-b border-ln px-1.5 pt-0.5 text-right font-mono text-[9.5px] text-fai"
                style={{ height: ROW_HEIGHT }}
              >
                {clockLabel(h * 60, timeFormat)}
              </div>
            ))}
          </div>

          {columns.map((col, index) => (
            <div key={col.dayKey} className="relative border-r border-ln">
              {hours.map((h) => {
                const slot = `${col.dayKey}:${h}`;
                return (
                  <div
                    key={h}
                    data-slot={slot}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setTarget(slot);
                    }}
                    onDragLeave={() =>
                      setTarget((t) => (t === slot ? null : t))
                    }
                    onDrop={(e) => drop(e, col.dayKey, h)}
                    className={
                      "border-b border-ln transition-colors " +
                      (target === slot ? "bg-acc-soft" : "")
                    }
                    style={{ height: ROW_HEIGHT }}
                  />
                );
              })}

              {blocks
                .filter((b) => b.dayIndex === index)
                .map((b) => (
                  <div
                    key={b.id}
                    draggable={!b.projected && !b.unscheduled}
                    data-block-id={b.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/krama-block", b.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    title={`${b.clock} · ${b.duration} · ${b.title}`}
                    className={
                      "absolute left-[3px] right-[3px] overflow-hidden rounded-[5px] " +
                      "border-l-2 px-[7px] py-[5px] text-[11px] leading-[1.3] " +
                      // A projected routine is drawn as an outline: it is a
                      // standing commitment, not something put in the diary
                      // yet. It has no row to drag, so it must not offer the
                      // grab cursor either.
                      (b.projected
                        ? "cursor-default border border-dashed border-ln2 border-l-acc "
                        : b.unscheduled
                          ? "cursor-default "
                          : "cursor-grab active:cursor-grabbing ") +
                      (b.projected
                        ? ""
                        : b.done
                          ? "border-l-ok bg-ok-soft"
                          : "border-l-acc bg-acc-soft") +
                      (pending ? " opacity-60" : "")
                    }
                    style={{
                      top: (b.offsetMinutes / 60) * ROW_HEIGHT + 2,
                      // Never shorter than a readable strip, however brief.
                      height: Math.max(
                        22,
                        (b.durationMinutes / 60) * ROW_HEIGHT - 4,
                      ),
                    }}
                  >
                    <div className="truncate font-semibold text-ink">
                      {b.title}
                    </div>
                    <div className="font-mono text-[9px] text-mut opacity-80">
                      {b.duration}
                    </div>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="px-3 py-2 text-[11.5px] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
