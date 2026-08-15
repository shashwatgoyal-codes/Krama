import { shiftDayKey, weekdayOf } from "./day";

/**
 * The week a day belongs to, Monday first.
 *
 * Seven columns rather than the five in the design. That is a deliberate
 * departure: a five-column week silently hides anything scheduled on a
 * Saturday or Sunday, and a calendar that doesn't show you a block you
 * created is worse than one that looks slightly busier.
 */
export function weekDays(dayKey: string): string[] {
  // getUTCDay is 0=Sunday; shift so Monday is the start.
  const offset = (weekdayOf(dayKey) + 6) % 7;
  const monday = shiftDayKey(dayKey, -offset);
  return Array.from({ length: 7 }, (_, i) => shiftDayKey(monday, i));
}

export function startOfWeek(dayKey: string): string {
  return weekDays(dayKey)[0];
}

/** "11 – 17 August", or "29 June – 5 July" when it straddles two months. */
export function describeWeek(days: string[]): string {
  const first = new Date(`${days[0]}T00:00:00.000Z`);
  const last = new Date(`${days[days.length - 1]}T00:00:00.000Z`);

  const month = (d: Date) =>
    new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(d);
  const day = (d: Date) => d.getUTCDate();

  return month(first) === month(last)
    ? `${day(first)} – ${day(last)} ${month(last)}`
    : `${day(first)} ${month(first)} – ${day(last)} ${month(last)}`;
}
