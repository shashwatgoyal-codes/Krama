import { db } from "@/lib/db";
import { dayKeyFor, dayKeyToDate } from "@/lib/day";
import { computePace, levelProgress } from "@/lib/points";

export type ProfileSettings = {
  timezone: string;
  dayEndsAtHour: number;
  dailyFloor: number;
  dailyCap: number;
  scoringVisibility: string;
  streakDays: number;
  totalPoints: number;
};

/** Settings every action needs before it can decide which day it's on. */
export async function getSettings(userId: string): Promise<ProfileSettings> {
  const p = await db.profile.findUnique({
    where: { userId },
    select: {
      timezone: true,
      dayEndsAtHour: true,
      dailyFloor: true,
      dailyCap: true,
      scoringVisibility: true,
      streakDays: true,
      totalPoints: true,
    },
  });
  if (!p) throw new Error("Profile missing for this account.");
  return p;
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
            totalPoints: true,
            streakDays: true,
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

  return {
    name: user.name,
    email: user.email,
    memberSince: user.createdAt,
    ...user.profile,
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
  pointsToday: number;
  actionsToday: number;
  dailyFloor: number;
  floorCleared: boolean;
};

/**
 * Pace is computed from the ledger rather than stored, so it can never
 * drift from the record. Seven days is a small enough read to do on
 * every load.
 */
export async function getTodayStats(userId: string): Promise<TodayStats> {
  const settings = await getSettings(userId);
  const today = dayKeyFor(new Date(), settings.timezone, settings.dayEndsAtHour);

  const days: string[] = [];
  const cursor = dayKeyToDate(today);
  for (let i = 0; i < 7; i++) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  const rows = await db.pointEntry.groupBy({
    by: ["countedFor"],
    where: { userId, countedFor: { gte: dayKeyToDate(days[6]) } },
    _sum: { points: true },
    _count: { _all: true },
  });

  const byDay = new Map(
    rows.map((r) => [
      r.countedFor.toISOString().slice(0, 10),
      { points: r._sum.points ?? 0, count: r._count._all },
    ]),
  );

  // Most recent day first, which is what computePace expects.
  const dailyPoints = days.map((d) => byDay.get(d)?.points ?? 0);
  const todayEntry = byDay.get(today) ?? { points: 0, count: 0 };

  // A day's worth of work, used as the yardstick for pace.
  const dailyTarget = settings.dailyFloor * 20;
  const progress = levelProgress(settings.totalPoints);

  return {
    pace: computePace(dailyPoints, dailyTarget),
    level: progress.level,
    into: progress.into,
    needed: progress.needed,
    streakDays: settings.streakDays,
    pointsToday: todayEntry.points,
    actionsToday: todayEntry.count,
    dailyFloor: settings.dailyFloor,
    floorCleared: todayEntry.count >= settings.dailyFloor,
  };
}
