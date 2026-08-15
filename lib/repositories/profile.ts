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
