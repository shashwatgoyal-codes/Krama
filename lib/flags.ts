import { createHash } from "node:crypto";

/**
 * Deciding whether a flag is on for one person.
 *
 * Pure and separated from the database, because the interesting part is
 * the bucketing and it should be testable without one.
 *
 * The bucket is derived from the flag key and the user id, so it is
 * stable: somebody at 30% stays inside every rollout up to 30% and does
 * not flicker in and out on each page load. Including the key means the
 * same person is not always in the first 10% of everything, which would
 * make a small rollout test the same handful of people every time.
 */

export type Flag = {
  key: string;
  enabled: boolean;
  /** 0-100. Ignored when enabled is false. */
  rollout: number;
};

/** 0-99, stable for a given key and user. */
export function bucketFor(key: string, userId: string): number {
  const digest = createHash("sha256").update(`${key}:${userId}`).digest();
  // Two bytes is plenty for 100 buckets and avoids the modulo bias a
  // single byte would introduce (256 is not divisible by 100).
  return digest.readUInt16BE(0) % 100;
}

export function isOn(flag: Flag | null | undefined, userId: string): boolean {
  // A missing flag is off. A typo in a key then turns a feature off for
  // everybody rather than on, which is the direction to fail in.
  if (!flag || !flag.enabled) return false;
  if (flag.rollout >= 100) return true;
  if (flag.rollout <= 0) return false;
  return bucketFor(flag.key, userId) < flag.rollout;
}

/** For things with no user attached — a closed sign-up page, say. */
export function isOnGlobally(flag: Flag | null | undefined): boolean {
  return Boolean(flag?.enabled && flag.rollout >= 100);
}

export function clampRollout(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
