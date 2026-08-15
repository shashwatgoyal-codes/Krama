/**
 * Which day something counts toward.
 *
 * A planner that rolls over at midnight punishes people for finishing at
 * 01:00 — the work belongs to the day they were still awake for. Every
 * user sets an hour (default 04:00); anything before it counts as the
 * previous day.
 */

/** Local wall-clock parts of an instant, in a given IANA timezone. */
function partsIn(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p: Record<string, string> = {};
  for (const { type, value } of fmt.formatToParts(date)) p[type] = value;
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    // Intl gives "24" for midnight in some locales; normalise it.
    hour: Number(p.hour) % 24,
  };
}

/**
 * The calendar day an instant belongs to, as YYYY-MM-DD.
 * Finishing at 01:30 with dayEndsAtHour=4 returns the previous date.
 */
export function dayKeyFor(
  at: Date,
  timeZone: string,
  dayEndsAtHour: number,
): string {
  const { year, month, day, hour } = partsIn(at, timeZone);
  const d = new Date(Date.UTC(year, month - 1, day));
  if (hour < dayEndsAtHour) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Midnight UTC of a YYYY-MM-DD key — how day columns are stored. */
export function dayKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Whole days between two day keys. Negative when `a` is earlier. */
export function daysBetween(a: string, b: string): number {
  const ms = dayKeyToDate(b).getTime() - dayKeyToDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** 0 = Sunday, matching Profile.restDays. */
export function weekdayOf(key: string): number {
  return dayKeyToDate(key).getUTCDay();
}

/**
 * Logging something for an earlier day still works — but pays half, so
 * a month of work can't be entered on the 31st and counted in full.
 */
export const BACKDATE_MULTIPLIER = 0.5;

export function isBackdated(countedFor: string, today: string): boolean {
  return daysBetween(countedFor, today) > 0;
}
