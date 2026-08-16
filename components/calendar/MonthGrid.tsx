import Link from "next/link";

/**
 * A month at a glance. Not a place to schedule anything — the cells are
 * too small to place a time honestly — so each day links through to its
 * own day view, where you can.
 */

export type MonthCell = {
  dayKey: string;
  dayNumber: string;
  inMonth: boolean;
  isToday: boolean;
  blocks: { id: string; title: string; clock: string; done: boolean }[];
};

const NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** Rotated so the header matches whichever day the user starts on. */
function weekdayHeader(startsOn: number): string[] {
  return Array.from({ length: 7 }, (_, i) => NAMES[(startsOn + i) % 7]);
}

export default function MonthGrid({
  cells,
  startsOn = 1,
}: {
  cells: MonthCell[];
  startsOn?: number;
}) {
  const WEEKDAYS = weekdayHeader(startsOn);
  return (
    <div className="min-w-[680px]">
      <div className="grid grid-cols-7 border-b border-ln">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="border-r border-ln py-1.5 text-center font-mono text-[9.5px] tracking-[0.1em] text-fai"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => (
          <Link
            key={cell.dayKey}
            href={`/app/calendar?view=day&w=${cell.dayKey}`}
            className={
              "min-h-[96px] border-b border-r border-ln p-1.5 transition-colors hover:bg-surf2 " +
              (cell.inMonth ? "" : "opacity-40")
            }
          >
            <div
              className={
                "mb-1 text-right font-mono text-[10.5px] " +
                (cell.isToday
                  ? "font-bold text-acc"
                  : cell.inMonth
                    ? "text-ink2"
                    : "text-fai")
              }
            >
              {cell.dayNumber}
            </div>

            {cell.blocks.slice(0, 3).map((b) => (
              <div
                key={b.id}
                className={
                  "mb-0.5 truncate rounded-[3px] border-l-2 px-1 py-0.5 text-[10px] " +
                  (b.done
                    ? "border-l-ok bg-ok-soft text-mut"
                    : "border-l-acc bg-acc-soft text-ink")
                }
              >
                <span className="font-mono opacity-70">{b.clock}</span>{" "}
                {b.title}
              </div>
            ))}

            {cell.blocks.length > 3 && (
              <div className="px-1 text-[10px] text-fai">
                +{cell.blocks.length - 3} more
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
