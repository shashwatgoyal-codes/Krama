import { db } from "@/lib/db";
import { dayKeyFor, dayKeyToDate, shiftDayKey } from "@/lib/day";
import { computePace, levelProgress } from "@/lib/points";
import { computeStreak, type StreakResult } from "@/lib/streak";

export type ProfileSettings = {
  timezone: string;
  dayEndsAtHour: number;
  dailyFloor: number;
  dailyCap: number;
  scoringVisibility: string;
  restDays: number[];
  totalPoints: number;
};

/**
 * Settings every action needs before it can decide which day it's on.
 *
 * Deliberately does not return streakDays. That column is a cache for
 * the award function to read under its lock; anything user-facing asks
 * getStreak() instead, which derives the answer from the ledger.
 */
export async function getSettings(userId: string): Promise<ProfileSettings> {
  const p = await db.profile.findUnique({
    where: { userId },
    select: {
      timezone: true,
      dayEndsAtHour: true,
      dailyFloor: true,
      dailyCap: true,
      scoringVisibility: true,
      restDays: true,
      totalPoints: true,
    },
  });
  if (!p) throw new Error("Profile missing for this account.");
  return p;
}

/**
 * Things finished per day, as day key → count.
 *
 * Reversals are subtracted rather than ignored. Unticking a task appends
 * a negative ledger row, so counting rows alone would let undoing work
 * push you *over* the daily floor — the opposite of what happened.
 */
export async function actionsByDay(
  userId: string,
  since: Date,
): Promise<Record<string, number>> {
  const rows = await db.$queryRaw<{ day: string; actions: bigint }[]>`
    SELECT to_char("countedFor", 'YYYY-MM-DD') AS day,
           COUNT(*) FILTER (WHERE "points" > 0)
         - COUNT(*) FILTER (WHERE "points" < 0) AS actions
      FROM "point_ledger"
     WHERE "userId" = ${userId}
       AND "countedFor" >= ${since}
     GROUP BY 1
  `;

  const out: Record<string, number> = {};
  for (const r of rows) out[r.day] = Number(r.actions);
  return out;
}

/** How far back a streak is worth reconstructing. */
const STREAK_WINDOW_DAYS = 400;

/** The streak as the ledger currently implies it. Never read from a column. */
export async function getStreak(
  userId: string,
  settings: {
    timezone: string;
    dayEndsAtHour: number;
    dailyFloor: number;
    restDays: number[];
  },
): Promise<StreakResult> {
  const today = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);
  const since = dayKeyToDate(shiftDayKey(today, -STREAK_WINDOW_DAYS));

  return computeStreak({
    today,
    actionsByDay: await actionsByDay(userId, since),
    dailyFloor: settings.dailyFloor,
    restDays: settings.restDays,
    maxLookback: STREAK_WINDOW_DAYS,
  });
}

export type ProfileOverview = {
  name: string;
  email: string;
  memberSince: Date;
  timezone: string;
  dayEndsAtHour: number;
  dailyFloor: number;
  dailyCap: number;
  scoringVisibility: string;
  restDays: number[];
  weekStartsOn: number;
  timeFormat: string;
  passwordChangedAt: Date | null;
  totalPoints: number;
  streakDays: number;
  level: number;
  into: number;
  needed: number;
  tasksDone: number;
  notesKept: number;
  otherSessions: number;
};

/** Everything the profile page shows, in one pass. */
export async function getProfileOverview(
  userId: string,
): Promise<ProfileOverview> {
  const [user, tasksDone, notesKept, sessions] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        createdAt: true,
        profile: {
          select: {
            timezone: true,
            dayEndsAtHour: true,
            dailyFloor: true,
            dailyCap: true,
            scoringVisibility: true,
            restDays: true,
            weekStartsOn: true,
            timeFormat: true,
            passwordChangedAt: true,
            totalPoints: true,
          },
        },
      },
    }),
    db.task.count({ where: { userId, status: "done" } }),
    db.note.count({ where: { userId, archivedAt: null } }),
    db.session.count({ where: { userId } }),
  ]);

  if (!user?.profile) throw new Error("Profile missing for this account.");

  const progress = levelProgress(user.profile.totalPoints);
  // Derived, not read from the column — see getStreak.
  const streak = await getStreak(userId, user.profile);

  return {
    name: user.name,
    email: user.email,
    memberSince: user.createdAt,
    ...user.profile,
    streakDays: streak.days,
    level: progress.level,
    into: progress.into,
    needed: progress.needed,
    tasksDone,
    notesKept,
    // "Other" as in other than the one reading this page.
    otherSessions: Math.max(0, sessions - 1),
  };
}

/** Only ever touches the row belonging to the session's user. */
export async function updateProfileSettings(
  userId: string,
  patch: {
    timezone?: string;
    dayEndsAtHour?: number;
    dailyFloor?: number;
    dailyCap?: number;
    scoringVisibility?: string;
    restDays?: number[];
    weekStartsOn?: number;
    timeFormat?: string;
    passwordChangedAt?: Date;
  },
): Promise<void> {
  await db.profile.update({ where: { userId }, data: patch });
}

export async function updateName(userId: string, name: string): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { name } });
}

export async function updatePasswordHash(
  userId: string,
  passwordHash: string,
): Promise<void> {
  await db.user.update({ where: { id: userId }, data: { passwordHash } });
}

export async function getPasswordHash(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return user?.passwordHash ?? null;
}

/**
 * Deleting the user cascades to everything they own — including the
 * ledger, which a trigger otherwise protects from DELETE. The flag that
 * opens that door is transaction-local, so it must be set in the same
 * transaction as the delete and can never leak onto a pooled connection
 * afterwards. The array form of $transaction is used deliberately: it is
 * one round trip, which the Neon pooler handles where an interactive
 * transaction would not.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await db.$transaction([
    db.$executeRaw`SELECT set_config('krama.allow_ledger_delete', 'on', true)`,
    db.$executeRaw`DELETE FROM users WHERE id = ${userId}`,
  ]);
}

export type TodayStats = {
  pace: number;
  level: number;
  into: number;
  needed: number;
  streakDays: number;
  streakAtRisk: boolean;
  pointsToday: number;
  actionsToday: number;
  dailyFloor: number;
  floorCleared: boolean;
};

/**
 * Pace and streak are both computed from the ledger rather than stored,
 * so neither can drift from the record.
 */
export async function getTodayStats(userId: string): Promise<TodayStats> {
  const settings = await getSettings(userId);
  const today = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);

  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(shiftDayKey(today, -i));

  const [pointRows, actions] = await Promise.all([
    db.pointEntry.groupBy({
      by: ["countedFor"],
      where: { userId, countedFor: { gte: dayKeyToDate(days[6]) } },
      _sum: { points: true },
    }),
    actionsByDay(userId, dayKeyToDate(shiftDayKey(today, -STREAK_WINDOW_DAYS))),
  ]);

  const pointsByDay = new Map(
    pointRows.map((r) => [
      r.countedFor.toISOString().slice(0, 10),
      r._sum.points ?? 0,
    ]),
  );

  const streak = computeStreak({
    today,
    actionsByDay: actions,
    dailyFloor: settings.dailyFloor,
    restDays: settings.restDays,
    maxLookback: STREAK_WINDOW_DAYS,
  });

  // Most recent day first, which is what computePace expects.
  const dailyPoints = days.map((d) => pointsByDay.get(d) ?? 0);

  // A day's worth of work, used as the yardstick for pace.
  const dailyTarget = settings.dailyFloor * 20;
  const progress = levelProgress(settings.totalPoints);

  return {
    pace: computePace(dailyPoints, dailyTarget),
    level: progress.level,
    into: progress.into,
    needed: progress.needed,
    streakDays: streak.days,
    streakAtRisk: streak.atRisk,
    pointsToday: pointsByDay.get(today) ?? 0,
    actionsToday: Math.max(0, actions[today] ?? 0),
    dailyFloor: settings.dailyFloor,
    floorCleared: streak.clearedToday,
  };
}
