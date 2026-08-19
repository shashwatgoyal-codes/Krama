import { shiftDayKey, weekdayOf } from "./day";

/**
 * The week a day belongs to, Monday first.
 *
 * Seven columns rather than the five in the design. That is a deliberate
 * departure: a five-column week silently hides anything scheduled on a
 * Saturday or Sunday, and a calendar that doesn't show you a block you
 * created is worse than one that looks slightly busier.
 */
export function weekDays(dayKey: string, startsOn: number = 1): string[] {
  // getUTCDay is 0=Sunday. Rotate so the user's chosen day leads.
  const offset = (weekdayOf(dayKey) - startsOn + 7) % 7;
  const first = shiftDayKey(dayKey, -offset);
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(first, i));
}

export function startOfWeek(dayKey: string, startsOn: number = 1): string {
  return weekDays(dayKey, startsOn)[0];
}

/**
 * The grid a month is drawn on: whole weeks, Monday first, padded at
 * both ends so every row has seven days. Always six rows, so the grid
 * doesn't change height as you page through the year.
 */
export function monthGridDays(dayKey: string, startsOn: number = 1): string[] {
  const first = `${dayKey.slice(0, 7)}-01`;
  const start = startOfWeek(first, startsOn);
  return Array.from({ length: 42 }, (_, i) => shiftDayKey(start, i));
}

export function isInMonth(dayKey: string, monthOf: string): boolean {
  return dayKey.slice(0, 7) === monthOf.slice(0, 7);
}

export function describeMonth(dayKey: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${dayKey.slice(0, 7)}-01T00:00:00.000Z`));
}

/** The first of the month `delta` months away. */
export function shiftMonth(dayKey: string, delta: number): string {
  const [y, m] = dayKey.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1 + delta, 1));
  return at.toISOString().slice(0, 10);
}

/** "11 – 17 August", or "29 June – 5 July" when it straddles two months. */
export function describeWeek(days: string[]): string {
  // An empty list should read as "no week", not crash the page. Intl
  // throws RangeError on an invalid date, and this is called during
  // render — so the cost of the caller passing nothing is a blank
  // screen rather than a blank heading.
  if (days.length === 0) return "";

  const first = new Date(`${days[0]}T00:00:00.000Z`);
  const last = new Date(`${days[days.length - 1]}T00:00:00.000Z`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime())) return "";

  const month = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(d);
  const day = (d: Date) => d.getUTCDate();

  return month(first) === month(last)
    ? `${day(first)} – ${day(last)} ${month(last)}`
    : `${day(first)} ${month(first)} – ${day(last)} ${month(last)}`;
}
