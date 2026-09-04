import { db } from "@/lib/db";
import { RETENTION, cutoff, finishedCutoff } from "@/lib/retention";
import { purgeStaleCodes } from "./verification";

/**
 * The sweep.
 *
 * Runs beside the day-boundary work, for the same reasons: no scheduler
 * exists, the work is idempotent, and doing it on a day nobody opens the
 * app would achieve nothing anyway.
 *
 * Everything here is either an absence or something already spent. The
 * one exception is finished tasks, and those go only when the person has
 * chosen a limit — the default keeps them forever.
 *
 * Points are safe from all of it: point_ledger holds no foreign key to
 * tasks, so a swept task takes its plan and leaves its history. That is
 * exactly why the ledger was built separate and append-only, and it is
 * what makes any of this safe to delete at all.
 */

export type Swept = {
  droppedRoutines: number;
  expiredSessions: number;
  staleCodes: number;
  oldAttempts: number;
  finishedTasks: number;
};

export async function sweep(
  userId: string,
  keepFinishedDays: number,
  now: Date = new Date(),
): Promise<Swept> {
  // A routine day you skipped, long enough ago that noticing the pattern
  // is no longer possible. One row per routine per missed day otherwise,
  // forever, all saying the same nothing.
  const dropped = await db.task.deleteMany({
    where: {
      userId,
      recurrenceParentId: { not: null },
      status: "dropped",
      createdForDate: { lt: cutoff(RETENTION.droppedRoutineDays, now) },
    },
  });

  // An expired session is a row that cannot authenticate anything. They
  // were only ever deleted when someone happened to present one, so a
  // device signed into once and never opened again left its row forever.
  const sessions = await db.session.deleteMany({
    where: {
      userId,
      expiresAt: { lt: cutoff(RETENTION.expiredSessionDays, now) },
    },
  });

  // Not scoped to one user: rate-limit rows are keyed by address and by
  // email, and a window that has passed cannot affect any decision.
  const attempts = await db.authAttempt.deleteMany({
    where: { firstAt: { lt: cutoff(RETENTION.authAttemptDays, now) } },
  });

  // This existed and was never called from anywhere, so spent codes
  // accumulated indefinitely. It is called now.
  const codes = await purgeStaleCodes();

  let finishedTasks = 0;
  const finished = finishedCutoff(keepFinishedDays, now);
  if (finished) {
    const gone = await db.task.deleteMany({
      where: {
        userId,
        status: "done",
        completedAt: { lt: finished },
        // A template is a rule, not a day. Removing one because it was
        // once ticked off would silently end the routine.
        recurrence: "none",
      },
    });
    finishedTasks = gone.count;
  }

  return {
    droppedRoutines: dropped.count,
    expiredSessions: sessions.count,
    staleCodes: codes,
    oldAttempts: attempts.count,
    finishedTasks,
  };
}

/** What a sweep would remove right now, for the settings screen. */
export async function sweepPreview(
  userId: string,
  keepFinishedDays: number,
  now: Date = new Date(),
): Promise<{ droppedRoutines: number; finishedTasks: number }> {
  const finished = finishedCutoff(keepFinishedDays, now);
  const [droppedRoutines, finishedTasks] = await Promise.all([
    db.task.count({
      where: {
        userId,
        recurrenceParentId: { not: null },
        status: "dropped",
        createdForDate: { lt: cutoff(RETENTION.droppedRoutineDays, now) },
      },
    }),
    finished
      ? db.task.count({
          where: {
            userId,
            status: "done",
            completedAt: { lt: finished },
            recurrence: "none",
          },
        })
      : Promise.resolve(0),
  ]);
  return { droppedRoutines, finishedTasks };
}
