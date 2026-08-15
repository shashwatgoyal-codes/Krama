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
): string {
  switch (recurrence) {
    case "daily":
      return "Every day";
    case "weekdays":
      return "Weekdays";
    case "weekly":
      return `Every ${dayName(value ?? 1)}`;
    case "monthly":
      return `Monthly on the ${ordinal(value ?? 1)}`;
    default:
      return "Once";
  }
}

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
): boolean {
  const dow = weekdayOf(dayKey);
  const dom = dayKeyToDate(dayKey).getUTCDate();

  switch (recurrence) {
    case "daily":
      return true;
    case "weekdays":
      return dow >= 1 && dow <= 5;
    case "weekly":
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
): string | null {
  if (recurrence === "none") return null;

  const cursor = dayKeyToDate(afterDayKey);
  // A month of lookahead covers every rule we support.
  for (let i = 0; i < 366; i++) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const key = cursor.toISOString().slice(0, 10);
    if (occursOn(key, recurrence, value)) return key;
  }
  return null;
}
