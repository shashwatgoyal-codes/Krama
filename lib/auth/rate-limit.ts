/**
 * Sign-in throttling.
 *
 * In-memory on purpose: this app runs as a single instance for a handful
 * of people, and an in-process map costs nothing. If it ever runs on
 * more than one instance, move this to a Postgres table — a per-instance
 * limiter is worse than none, because it quietly multiplies the allowance.
 */

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

type Bucket = { count: number; firstAt: number; lockedUntil?: number };

const buckets = new Map<string, Bucket>();

export type LimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(key: string, now = Date.now()): LimitResult {
  const bucket = buckets.get(key);

  if (!bucket) return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterMs: 0 };

  if (bucket.lockedUntil && bucket.lockedUntil > now) {
    return { allowed: false, remaining: 0, retryAfterMs: bucket.lockedUntil - now };
  }

  // Window expired — start fresh.
  if (now - bucket.firstAt > WINDOW_MS) {
    buckets.delete(key);
    return { allowed: true, remaining: MAX_ATTEMPTS - 1, retryAfterMs: 0 };
  }

  const remaining = MAX_ATTEMPTS - bucket.count;
  return { allowed: remaining > 0, remaining: Math.max(0, remaining - 1), retryAfterMs: 0 };
}

/** Call after a failed attempt. Locks out once the allowance is spent. */
export function recordFailure(key: string, now = Date.now()): void {
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.firstAt > WINDOW_MS) {
    buckets.set(key, { count: 1, firstAt: now });
    return;
  }

  bucket.count += 1;
  if (bucket.count >= MAX_ATTEMPTS) bucket.lockedUntil = now + LOCKOUT_MS;
}

/** Call after a successful sign-in. */
export function clearAttempts(key: string): void {
  buckets.delete(key);
}

/** Test seam. */
export function resetRateLimiter(): void {
  buckets.clear();
}
