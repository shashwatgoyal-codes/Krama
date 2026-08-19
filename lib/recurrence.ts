import { dayKeyToDate, weekdayOf } from "./day";
import type { Recurrence } from "@prisma/client";

/**
 * Deliberately small: daily, weekdays, weekly on a day, monthly on a
 * date. Not RFC-5545. Every rule here is one someone can describe in a
 * sentence, which is the point — routines you have to configure are
 * routines you stop using.
 */

export function describeRecurrence(
  recurrence: Recurrence,
  value: number | null,
  days: number[] = [],
): string {
  switch (recurrence) {
    case "daily":
      return "Every day";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return describeWeekly(days, value);
    case "monthly":
      return `Monthly on the ${ordinal(value ?? 1)}`;
    default:
      return "Once";
  }
}

/**
 * How a multi-day weekly rule reads.
 *
 * Six days is easier to understand as the one day it leaves out than as
 * a list of six — "every day except Sunday" is how someone would say it
 * out loud, and "Mon, Tue, Wed, Thu, Fri, Sat" is a thing you have to
 * decode.
 */
function describeWeekly(days: number[], value: number | null): string {
  if (days.length === 0) return `Every ${dayName(value ?? 1)}`;

  const set = [...new Set(days.map((d) => ((d % 7) + 7) % 7))].sort();
  if (set.length === 7) return "Every day";
  if (set.length === 1) return `Every ${dayName(set[0]!)}`;

  if (set.length === 6) {
    const missing = [0, 1, 2, 3, 4, 5, 6].find((d) => !set.includes(d))!;
    return `Every day except ${dayName(missing)}`;
  }

  // Mon–Fri has its own name, since it is the common case.
  if (set.length === 5 && set.join() === "1,2,3,4,5") return "Weekdays";
  if (set.length === 2 && set.join() === "0,6") return "Weekends";

  return set.map((d) => SHORT[d]).join(", ");
}

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function dayName(dow: number): string {
  return DAYS[((dow % 7) + 7) % 7];
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

/** Does this rule land on the given day? */
export function occursOn(
  dayKey: string,
  recurrence: Recurrence,
  value: number | null,
  /** The last day the routine runs, or null for open-ended. */
  until: string | null = null,
  /** Weekdays for a weekly rule, 0 = Sunday. Empty falls back to value. */
  days: number[] = [],
): boolean {
  // Checked before the rule, not after: a routine that has ended does
  // not fire on a day that would otherwise match, and every caller gets
  // that for free rather than having to remember it.
  if (until && dayKey > until) return false;

  const dow = weekdayOf(dayKey);
  const dom = dayKeyToDate(dayKey).getUTCDate();

  switch (recurrence) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekly":
      // The array is the rule when it has anything in it; the single
      // value is what rows written before multi-day existed still use.
      if (days.length > 0) return days.includes(dow);
      return dow === (value ?? 1);
    case "monthly":
      return dom === clampToMonth(dayKey, value ?? 1);
    default:
      return false;
  }
}

/**
 * "Monthly on the 31st" is the rule that breaks naive implementations —
 * February has no 31st, so the task silently never appears. It lands on
 * the last day of the month instead.
 */
export function clampToMonth(dayKey: string, dayOfMonth: number): number {
  const d = dayKeyToDate(dayKey);
  const lastDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  return Math.min(dayOfMonth, lastDay);
}

/** The next day this rule fires, strictly after `afterDayKey`. */
export function nextOccurrence(
  afterDayKey: string,
  recurrence: Recurrence,
  value: number | null,
  until: string | null = null,
  days: number[] = [],
): string | null {
  if (recurrence === "none") return null;
  // Nothing comes after the end, so there is no point walking the year.
  if (until && afterDayKey >= until) return null;

  const cursor = dayKeyToDate(afterDayKey);
  // A month of lookahead covers every rule we support.
  for (let i = 0; i < 366; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const key = cursor.toISOString().slice(0, 10);
    if (until && key > until) return null;
    if (occursOn(key, recurrence, value, until, days)) return key;
  }
  return null;
}

/**
 * Reads the picker's "1,2,3" into weekdays.
 *
 * Anything unrecognisable is dropped rather than rejected: a malformed
 * day list should cost you that day, not the whole save. Duplicates
 * collapse and the result is sorted, so two posts of the same set are
 * the same set.
 */
export function parseWeekdays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const days = new Set<number>();
  for (const piece of raw.split(",")) {
    const text = piece.trim();
    // Number("") is 0, which is a valid weekday — so a trailing comma
    // would silently add Sunday to the routine. The empty piece has to
    // be dropped before it is ever converted.
    if (text === "") continue;
    const n = Number(text);
    if (Number.isInteger(n) && n >= 0 && n <= 6) days.add(n);
  }
  return [...days].sort((a, b) => a - b);
}
