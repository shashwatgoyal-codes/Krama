import Link from "next/link";

/**
 * The week as a grid. Times down the side, days across the top, blocks
 * positioned inside their day column.
 *
 * Every value here is pre-resolved on the server — the grid does no date
 * maths of its own, because a component that computes hours from an
 * instant will disagree with the server about the zone.
 */

export type WeekBlock = {
  id: string;
  title: string;
  /** 0-based column, Monday = 0. */
  dayIndex: number;
  /** Offset from the top of the grid, in minutes. */
  offsetMinutes: number;
  durationMinutes: number;
  clock: string;
  duration: string;
  done: boolean;
};

export type WeekColumn = {
  dayKey: string;
  weekday: string;
  dayNumber: string;
  isToday: boolean;
};

const ROW_HEIGHT = 44;

export default function WeekGrid({
  columns,
  blocks,
  startHour,
  endHour,
}: {
  columns: WeekColumn[];
  blocks: WeekBlock[];
  startHour: number;
  endHour: number;
}) {
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i,
  );

  return (
    <div className="min-w-[720px]">
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

      {/* body */}
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `48px repeat(${columns.length}, 1fr)` }}
      >
        {/* time gutter */}
        <div className="border-r border-ln">
          {hours.map((h) => (
            <div
              key={h}
              className="border-b border-ln px-1.5 pt-0.5 text-right font-mono text-[9.5px] text-fai"
              style={{ height: ROW_HEIGHT }}
            >
              {String(h).padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {columns.map((col, index) => (
          <div key={col.dayKey} className="relative border-r border-ln">
            {hours.map((h) => (
              <div
                key={h}
                className="border-b border-ln"
                style={{ height: ROW_HEIGHT }}
              />
            ))}

            {blocks
              .filter((b) => b.dayIndex === index)
              .map((b) => (
                <Link
                  key={b.id}
                  href="/app"
                  title={`${b.clock} · ${b.duration} · ${b.title}`}
                  className={
                    "absolute left-[3px] right-[3px] overflow-hidden rounded-[5px] border-l-2 px-[7px] py-[5px] text-[11px] leading-[1.3] " +
                    (b.done
                      ? "border-l-ok bg-ok-soft"
                      : "border-l-acc bg-acc-soft")
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
                  <div className="truncate font-semibold text-ink">{b.title}</div>
                  <div className="font-mono text-[9px] text-mut opacity-80">
                    {b.duration}
                  </div>
                </Link>
              ))}
          </div>
        ))}
      </div>
    </div>
  );
}
