/**
 * The scoring rules.
 *
 * Two principles hold this together, and both are deliberate:
 *  1. Effort is scored, outcomes are not. Nothing here can be earned by
 *     something outside the user's control.
 *  2. The spread is narrow — 30 at the top, 5 at the bottom. When one
 *     action pays far more than the rest, people optimise for the score
 *     instead of doing the work.
 */

import { BACKDATE_MULTIPLIER } from "./day";

export const POINTS = {
  deepBlock: 30,
  standardTask: 25,
  studySession: 20,
  recurringRoutine: 15,
  quickTask: 12,
  upkeep: 5,
} as const;

export const MAX_POINTS = POINTS.deepBlock;
export const MIN_POINTS = POINTS.upkeep;

/** Streak multiplier, capped so a long streak can't dwarf the work. */
export function streakMultiplier(streakDays: number): number {
  const capped = Math.min(Math.max(streakDays, 0), 30);
  return 1 + capped * 0.02; // 1.00 … 1.60
}

/**
 * Past the daily cap, awards pay half, then a quarter. Nothing is ever
 * blocked — the ceiling just stops mattering, so a big day still counts
 * for something without letting one day dominate the record.
 */
export function softCapFactor(pointsToday: number, dailyCap: number): number {
  if (pointsToday < dailyCap) return 1;
  if (pointsToday < dailyCap * 2) return 0.5;
  return 0.25;
}

export type AwardInput = {
  basePoints: number;
  streakDays: number;
  pointsToday: number;
  dailyCap: number;
  backdated: boolean;
};

export type Award = {
  points: number;
  multiplier: number;
};

/** What a single completed action is worth, after every rule is applied. */
export function computeAward({
  basePoints,
  streakDays,
  pointsToday,
  dailyCap,
  backdated,
}: AwardInput): Award {
  const multiplier =
    streakMultiplier(streakDays) *
    softCapFactor(pointsToday, dailyCap) *
    (backdated ? BACKDATE_MULTIPLIER : 1);

  return {
    points: Math.max(1, Math.round(basePoints * multiplier)),
    multiplier: Number(multiplier.toFixed(3)),
  };
}

/** Total points needed to reach a level. Fast early so week one pays. */
export function pointsForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.round(80 * Math.pow(level, 1.55));
}

export function levelFromPoints(totalPoints: number): number {
  let level = 1;
  while (pointsForLevel(level + 1) <= totalPoints) level++;
  return level;
}

/** How far through the current level, 0–1. */
export function levelProgress(totalPoints: number): {
  level: number;
  into: number;
  needed: number;
  fraction: number;
} {
  const level = levelFromPoints(totalPoints);
  const floor = pointsForLevel(level);
  const ceiling = pointsForLevel(level + 1);
  const into = totalPoints - floor;
  const needed = ceiling - floor;
  return { level, into, needed, fraction: needed === 0 ? 0 : into / needed };
}

const PACE_DECAY = 0.82; // ~18% a day
const PACE_WINDOW = 7;

/**
 * Pace decays instead of resetting. A missed day is a dip you can watch
 * recover, not a wipeout — which is the difference between coming back
 * and giving up.
 *
 * @param dailyPoints most recent day first
 */
export function computePace(dailyPoints: number[], dailyTarget: number): number {
  if (dailyTarget <= 0) return 0;
  let weighted = 0;
  let weightSum = 0;
  for (let i = 0; i < Math.min(dailyPoints.length, PACE_WINDOW); i++) {
    const w = Math.pow(PACE_DECAY, i);
    weighted += (dailyPoints[i] ?? 0) * w;
    weightSum += w;
  }
  if (weightSum === 0) return 0;
  const avg = weighted / weightSum;
  return Math.max(0, Math.min(100, Math.round((avg / dailyTarget) * 100)));
}
