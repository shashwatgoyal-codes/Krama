import { db } from "@/lib/db";
import { dayKeyToDate, shiftDayKey } from "@/lib/day";
import { materialiseRecurring } from "./recurring";

/**
 * The day-boundary work: rolling unfinished tasks forward, and catching
 * up routines that were missed.
 *
 * Run on load rather than by a scheduled job, for the same reason the
 * recurring materialiser is: it needs no background infrastructure, and
 * both operations are idempotent, so opening three tabs does the work
 * once. The cost is that nothing happens on a day you never open the
 * app — which is correct anyway. Rolling work forward on a day the user
 * never saw would just pile it up unseen.
 */

/** How far back to look. Beyond a week, "catching up" is archaeology. */
const MAX_CATCHUP_DAYS = 7;

export type MaintenanceResult = {
  /** Routine days that passed unfinished and were closed as missed. */
  routinesMissed: number;
  rolledForward: number;
  routinesCaughtUp: number;
};

export async function runDayMaintenance(
  userId: string,
  todayKey: string,
  settings: { rolloverUnfinished: boolean; catchUpRoutines: boolean },
): Promise<MaintenanceResult> {
  let rolledForward = 0;
  let routinesCaughtUp = 0;

  if (settings.rolloverUnfinished) {
    // Anything still open and filed for an earlier day moves to today.
    // updateMany rather than a read-then-write: two tabs racing here
    // would otherwise both try to move the same rows.
    const { count } = await db.task.updateMany({
      where: {
        userId,
        status: "open",
        createdForDate: { lt: dayKeyToDate(todayKey) },
        // A routine instance is tied to the day it was for; moving it
        // would double up against the one today generates on its own.
        recurrenceParentId: null,
        recurrence: "none",
      },
      data: { createdForDate: dayKeyToDate(todayKey) },
    });
    rolledForward = count;
  }

  // A routine day you missed is missed, not owing.
  //
  // Rollover deliberately leaves routine instances where they are, but
  // nothing then closed them, so every day you skipped left an open row
  // dated in the past — one per day, forever, all with the same title.
  // That is what made a daily routine look like a dozen identical tasks.
  //
  // Dropped rather than deleted: it happened, you did not do it, and the
  // history is worth keeping even though the work is not.
  const { count: missed } = await db.task.updateMany({
    where: {
      userId,
      status: "open",
      createdForDate: { lt: dayKeyToDate(todayKey) },
      recurrenceParentId: { not: null },
    },
    data: { status: "dropped" },
  });
  const routinesMissed = missed;

  if (settings.catchUpRoutines) {
    // Walk the missed days oldest-first so the instances land in the
    // order they were actually due.
    for (let back = MAX_CATCHUP_DAYS; back >= 1; back--) {
      routinesCaughtUp += await materialiseRecurring(
        userId,
        shiftDayKey(todayKey, -back),
      );
    }
  }

  return { rolledForward, routinesCaughtUp, routinesMissed };
}

/**
 * Whether a reminder is due right now.
 *
 * Reminders are shown in the app rather than pushed, because there is no
 * scheduler and no notification channel — and a setting that quietly
 * does nothing is worse than one that does something modest. The nudge
 * appears when you next open Krama after the time you chose.
 */
export function reminderDue(
  reminder: string | null,
  nowHHMM: string,
): boolean {
  if (!reminder) return false;
  return nowHHMM >= reminder;
}
