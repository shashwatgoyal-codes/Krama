import { db } from "@/lib/db";
import { dayKeyFor, dayKeyToDate, isBackdated } from "@/lib/day";
import { getStreak } from "@/lib/repositories/profile";
import type { PointSource } from "@prisma/client";

/**
 * Points are never computed or written by the client, and never by
 * application code either — this calls a database function that does the
 * whole award in one atomic statement. See the migration for why.
 */

export type AwardResult = { points: number; multiplier: number };

export async function awardPoints(params: {
  userId: string;
  sourceType: PointSource;
  sourceId?: string;
  basePoints: number;
  /** Which day it counts toward. Defaults to today for this user. */
  countedForDay?: string;
  timezone: string;
  dayEndsAtHour: number;
  dailyFloor: number;
  restDays: number[];
}): Promise<AwardResult> {
  const today = dayKeyFor(new Date(), params.timezone, params.dayEndsAtHour);
  const countedFor = params.countedForDay ?? today;

  // Derived here rather than inside the function so there is one
  // definition of the streak rule instead of two that can drift. It is
  // read from the same ledger the function writes to, never from input.
  const streak = await getStreak(params.userId, {
    timezone: params.timezone,
    dayEndsAtHour: params.dayEndsAtHour,
    dailyFloor: params.dailyFloor,
    restDays: params.restDays,
  });

  const rows = await db.$queryRaw<{ awarded: number; multiplier: string }[]>`
    SELECT * FROM krama_award_points(
      ${params.userId},
      ${params.sourceType}::"PointSource",
      ${params.sourceId ?? null},
      ${params.basePoints}::int,
      ${dayKeyToDate(countedFor)}::timestamp,
      ${isBackdated(countedFor, today)}::boolean,
      ${streak.days}::int
    )
  `;

  const row = rows[0];
  if (!row) throw new Error("Award failed — no row returned.");

  return { points: Number(row.awarded), multiplier: Number(row.multiplier) };
}

/**
 * Reverses an award by appending a negative entry. The ledger is
 * append-only, so nothing is ever edited or removed — unticking a task
 * leaves both the award and its reversal in the history, which is what
 * makes the totals reconstructible.
 */
export async function reverseAward(params: {
  userId: string;
  sourceType: PointSource;
  sourceId: string;
  countedForDay: string;
}): Promise<number> {
  const rows = await db.$queryRaw<{ total: bigint | null }[]>`
    SELECT COALESCE(SUM("points"), 0)::bigint AS total
      FROM "point_ledger"
     WHERE "userId" = ${params.userId}
       AND "sourceId" = ${params.sourceId}
  `;

  const net = Number(rows[0]?.total ?? 0);
  if (net === 0) return 0;

  await db.$executeRaw`
    INSERT INTO "point_ledger" ("id", "userId", "sourceType", "sourceId",
                                "points", "multiplier", "countedFor", "createdAt")
    VALUES (gen_random_uuid()::text, ${params.userId},
            ${params.sourceType}::"PointSource", ${params.sourceId},
            ${-net}::int, 1, ${dayKeyToDate(params.countedForDay)}::timestamp, NOW())
  `;

  await db.$executeRaw`
    UPDATE "profiles"
       SET "totalPoints" = GREATEST(0, "totalPoints" - ${net}::int)
     WHERE "userId" = ${params.userId}
  `;

  return net;
}
