import { weekdayOf, shiftDayKey } from "./day";

/**
 * How long you've kept showing up.
 *
 * Computed from the ledger every time it's read, never accumulated in a
 * counter. That matters more than it sounds: a stored counter only
 * learns you missed a day when something else happens to update it, so
 * the number stays proudly wrong for exactly as long as you stay away —
 * which is precisely when it's least welcome. Deriving it means the
 * answer is always current and there is no job to run.
 *
 * The rules, in the order they apply to each day walking backwards:
 *
 *   cleared the floor  → counts, even on a rest day. Working on your day
 *                        off should never be worth less than not working.
 *   rest day           → skipped. Neither counts nor breaks.
 *   today, not cleared → skipped. The day isn't over; a streak shouldn't
 *                        evaporate at 9am.
 *   anything else      → the streak ended here.
 *
 * There is deliberately no "you broke your streak" state. A streak that
 * ends simply becomes a shorter number.
 */

export type StreakInput = {
  /** Today's day key, already resolved through the day-end rule. */
  today: string;
  /** Day key → number of things finished that day. */
  actionsByDay: Record<string, number>;
  dailyFloor: number;
  /** 0 = Sunday. */
  restDays: number[];
  maxLookback?: number;
};

export type StreakResult = {
  days: number;
  clearedToday: boolean;
  /** A live streak, a day that counts, and the floor not yet met. */
  atRisk: boolean;
};

/** Two years is far past the point where a bigger number means anything. */
const MAX_LOOKBACK = 730;

export function computeStreak({
  today,
  actionsByDay,
  dailyFloor,
  restDays,
  maxLookback = MAX_LOOKBACK,
}: StreakInput): StreakResult {
  // A floor of zero would make every day in history "cleared", including
  // days that never existed, and the walk would run to the lookback
  // limit reporting a two-year streak.
  const floor = Math.max(1, Math.floor(dailyFloor));
  const rest = new Set(restDays);

  const actionsOn = (key: string) => Math.max(0, actionsByDay[key] ?? 0);
  const clearedOn = (key: string) => actionsOn(key) >= floor;

  const clearedToday = clearedOn(today);
  let days = 0;

  for (let back = 0; back <= maxLookback; back++) {
    const key = shiftDayKey(today, -back);

    if (clearedOn(key)) {
      days++;
      continue;
    }
    if (rest.has(weekdayOf(key))) continue;
    if (back === 0) continue;
    break;
  }

  return {
    days,
    clearedToday,
    atRisk: days > 0 && !clearedToday && !rest.has(weekdayOf(today)),
  };
}
