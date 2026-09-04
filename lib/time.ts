/**
 * Turning wall-clock time in someone's zone into instants, and back.
 *
 * Events are stored as absolute instants, which is the only thing that
 * survives a person changing time zone. Everything a user sees is that
 * instant rendered in their zone — so all the awkwardness lives here,
 * once, rather than being sprinkled through components.
 */

/**
 * Block lengths offered when scheduling.
 *
 * A closed list rather than a free number: an arbitrary minute count
 * invites 7-minute blocks that make the grid unreadable, and every value
 * here is one a person would actually choose.
 *
 * It lives here rather than in lib/validation.ts because the scheduling
 * form is a client component, and validation.ts reaches the password
 * rules, which reach argon2 — a native module that cannot be bundled for
 * the browser. Neither tsc nor eslint catches that; the build does.
 */
/**
 * Half-hour steps across a plausible day, labelled in the reader's clock.
 *
 * Built per render rather than once at module load, because the labels
 * depend on a setting. As a constant it was always 24-hour, so someone on
 * a 12-hour clock picked "13:30" from this list and then saw "01:30 pm"
 * on the calendar for the very same block.
 */
export function blockTimes(format: TimeFormat = "24") {
  return Array.from({ length: 36 }, (_, i) => {
    const minutes = 6 * 60 + i * 30;
    return {
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
      label: clockLabel(minutes, format),
    };
  });
}

export const BLOCK_MINUTES = [15, 30, 45, 60, 90, 120, 180, 240] as const;

/** How far the zone is from UTC at a given instant, in milliseconds. */
export function zoneOffsetMs(at: Date, timeZone: string): number {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const p: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(at)) p[type] = value;

  const asIfUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );

  return asIfUtc - at.getTime();
}

/**
 * The instant at which a given wall-clock time occurs in a zone.
 *
 * Done in two passes because the offset depends on the answer: guessing
 * with UTC then correcting lands on the wrong side of a DST boundary
 * roughly twice a year, and the second pass fixes it.
 */
export function zonedTimeToInstant(
  dayKey: string,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  const naive = Date.UTC(y, m - 1, d, hour, minute);

  const first = new Date(naive - zoneOffsetMs(new Date(naive), timeZone));
  const second = new Date(naive - zoneOffsetMs(first, timeZone));
  return second;
}

/**
 * The window an app-day covers, as instants.
 *
 * A day that ends at 04:00 runs from 04:00 on its own date to 04:00 the
 * next — so a block at 01:00 belongs to the night before, matching how
 * the scoring already counts it.
 */
export function dayWindow(
  dayKey: string,
  timeZone: string,
  dayEndsAtHour: number,
): { start: Date; end: Date } {
  const start = zonedTimeToInstant(dayKey, dayEndsAtHour, 0, timeZone);
  const [y, m, d] = dayKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return { start, end: zonedTimeToInstant(next, dayEndsAtHour, 0, timeZone) };
}

/**
 * "10:00" in the user's zone.
 *
 * The 24-hour form is the default because it is what the grid is drawn
 * against and what hourIn() parses. Passing "12" is for display only.
 */
export function formatClock(
  at: Date,
  timeZone: string,
  format: "12" | "24" = "24",
): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: format === "12",
  }).format(at);
}

export type TimeFormat = "12" | "24";

/**
 * A clock label from minutes past midnight, in the reader's format.
 *
 * The counterpart to formatClock for the many places that hold a time as
 * a number rather than a Date: the hour gutter, a routine's start, the
 * options in a time dropdown. Those were all writing "13:30" by hand, so
 * someone who had asked for a 12-hour clock got one on their scheduled
 * blocks and a 24-hour one everywhere else — the same time, printed two
 * ways, on one screen.
 *
 * Built through Intl on a fixed UTC date so it agrees, character for
 * character, with what formatClock produces for the same moment.
 */
export function clockLabel(minutes: number, format: TimeFormat = "24"): string {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const at = new Date(Date.UTC(2026, 0, 1, Math.floor(safe / 60), safe % 60));
  return formatClock(at, "UTC", format);
}

/** "08:00 – 09:30", or "08:00 am – 09:30 am". */
export function clockSpan(
  startMinute: number,
  minutes: number,
  format: TimeFormat = "24",
): string {
  return `${clockLabel(startMinute, format)} – ${clockLabel(
    startMinute + minutes,
    format,
  )}`;
}

/** Wall-clock hour in the zone, for positioning a block on a grid. */
export function hourIn(at: Date, timeZone: string): number {
  return Number(formatClock(at, timeZone).slice(0, 2));
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

/** "30m", "1h", "2h 15m" — the design's shorthand. */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** The "4h 15m committed" figure in the plan's header. */
export function totalCommitted(
  blocks: { startsAt: Date; endsAt: Date }[],
): string {
  const total = blocks.reduce(
    (sum, b) => sum + minutesBetween(b.startsAt, b.endsAt),
    0,
  );
  return formatDuration(total);
}

/**
 * Where to put a block someone just dragged in.
 *
 * Rounds up to the next half hour and skips past anything already
 * booked, so dropping a task twice never stacks two blocks on the same
 * slot. Falls back to the start of the working day when that day is
 * already behind us.
 */
export function nextFreeSlot(
  existing: { startsAt: Date; endsAt: Date }[],
  options: {
    now: Date;
    dayKey: string;
    timeZone: string;
    durationMinutes: number;
    dayStartHour?: number;
    dayEndHour?: number;
  },
): { start: Date; end: Date } {
  const { now, dayKey, timeZone, durationMinutes } = options;
  const dayStartHour = options.dayStartHour ?? 9;
  const dayEndHour = options.dayEndHour ?? 22;

  const openFrom = zonedTimeToInstant(dayKey, dayStartHour, 0, timeZone);
  const closeAt = zonedTimeToInstant(dayKey, dayEndHour, 0, timeZone);

  // Round now up to the next half hour so blocks land on tidy times.
  const HALF = 30 * 60_000;
  const rounded = new Date(Math.ceil(now.getTime() / HALF) * HALF);

  let cursor = new Date(Math.max(rounded.getTime(), openFrom.getTime()));

  const booked = [...existing].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime(),
  );

  for (const block of booked) {
    const end = new Date(cursor.getTime() + durationMinutes * 60_000);
    // No overlap with this one — the slot is good.
    if (end <= block.startsAt) break;
    if (block.endsAt > cursor) cursor = block.endsAt;
  }

  // Past the end of the day, put it at the end rather than refusing —
  // a block someone asked for should always appear somewhere.
  if (cursor.getTime() + durationMinutes * 60_000 > closeAt.getTime()) {
    cursor = new Date(
      Math.max(
        closeAt.getTime() - durationMinutes * 60_000,
        openFrom.getTime(),
      ),
    );
  }

  return {
    start: cursor,
    end: new Date(cursor.getTime() + durationMinutes * 60_000),
  };
}
