/**
 * Sign-in and password-reset throttling — the decision, not the storage.
 *
 * These functions are pure: hand them a stored attempt and the current
 * time, get back a verdict or the next attempt to store. Storage lives
 * in lib/repositories/auth-attempts.ts, against a Postgres table.
 *
 * It used to be a Map in this module, which was fine while the app was
 * one long-running process and wrong the moment it wasn't. On a
 * serverless host each request can land on a fresh instance with a fresh
 * empty Map, so "five attempts" silently becomes five per instance — a
 * limit that reads as enforced, is not, and says nothing in the logs
 * either way. A per-instance limiter is worse than no limiter, because
 * only one of the two is honest about what it does.
 *
 * The split is deliberate: this half is exhaustively unit-tested without
 * a database, and the half that talks to Postgres is small enough to
 * read in one go.
 */

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
export const WINDOW_MS = 15 * 60 * 1000;

/** What is stored per throttle key. */
export type Attempt = {
  count: number;
  /** Epoch ms at which the current window opened. */
  firstAt: number;
  /** Epoch ms until which this key is locked out, or null. */
  lockedUntil: number | null;
};

export type LimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

const FRESH: LimitResult = {
  allowed: true,
  remaining: MAX_ATTEMPTS - 1,
  retryAfterMs: 0,
};

/** Has this window closed, so the attempt should be forgotten? */
export function isStale(attempt: Attempt, now: number): boolean {
  return now - attempt.firstAt > WINDOW_MS;
}

/** Whether to allow the attempt, given what is on record. */
export function decide(attempt: Attempt | null, now: number): LimitResult {
  if (!attempt) return FRESH;

  if (attempt.lockedUntil !== null && attempt.lockedUntil > now) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: attempt.lockedUntil - now,
    };
  }

  if (isStale(attempt, now)) return FRESH;

  const left = MAX_ATTEMPTS - attempt.count;
  return {
    allowed: left > 0,
    // What will be left *after* this one, so the caller can warn.
    remaining: Math.max(0, left - 1),
    retryAfterMs: 0,
  };
}

/** What to store after a failed attempt. */
export function afterFailure(attempt: Attempt | null, now: number): Attempt {
  if (!attempt || isStale(attempt, now)) {
    return { count: 1, firstAt: now, lockedUntil: null };
  }

  const count = attempt.count + 1;
  return {
    count,
    firstAt: attempt.firstAt,
    lockedUntil: count >= MAX_ATTEMPTS ? now + LOCKOUT_MS : null,
  };
}

/** "Try again in 3 minutes." Rounded up, so it never reads as zero. */
export function retryMessage(retryAfterMs: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / 60_000));
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}
