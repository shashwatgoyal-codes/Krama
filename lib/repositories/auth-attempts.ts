import { db } from "@/lib/db";
import {
  decide,
  afterFailure,
  MAX_ATTEMPTS,
  LOCKOUT_MS,
  WINDOW_MS,
  type Attempt,
  type LimitResult,
} from "@/lib/auth/rate-limit";

/**
 * Where throttle state is kept.
 *
 * The increment is one statement rather than read-modify-write. Two
 * sign-in attempts arriving together would otherwise both read count=4,
 * both write 5, and between them spend six of an allowance of five —
 * which is exactly the kind of gap a limiter exists to close. ON CONFLICT
 * DO UPDATE takes a row lock, so the second one sees the first.
 *
 * That also rules out an interactive transaction: the pooled Neon
 * endpoint runs transaction pooling, where statements in one $transaction
 * can land on different backends. Single statements are the only thing
 * that is reliably atomic through it.
 */

type Row = { count: number; firstAt: Date; lockedUntil: Date | null };

function toAttempt(row: Row | undefined): Attempt | null {
  if (!row) return null;
  return {
    count: row.count,
    firstAt: row.firstAt.getTime(),
    lockedUntil: row.lockedUntil?.getTime() ?? null,
  };
}

export async function checkRateLimit(
  key: string,
  now = Date.now(),
): Promise<LimitResult> {
  const row = await db.authAttempt.findUnique({
    where: { key },
    select: { count: true, firstAt: true, lockedUntil: true },
  });
  return decide(toAttempt(row ?? undefined), now);
}

/** Record a failure. Locks the key out once the allowance is spent. */
export async function recordFailure(
  key: string,
  now = Date.now(),
): Promise<void> {
  // Epoch milliseconds rather than Date objects, converted in SQL.
  // Postgres cannot infer a parameter's type inside a CASE arm — it
  // guesses text and the insert fails — and building the value here
  // pins it to UTC rather than leaving it to the driver's idea of the
  // local zone, which the column has no timezone to correct with.
  const at = now;
  const windowOpened = now - WINDOW_MS;
  const lockUntil = now + LOCKOUT_MS;

  // One statement on purpose — see the note above. The CASE arms mirror
  // afterFailure() in lib/auth/rate-limit.ts, and the integration test
  // walks both side by side so they cannot drift apart unnoticed.
  await db.$executeRaw`
    INSERT INTO auth_attempts ("key", "count", "firstAt", "lockedUntil")
    VALUES (
      ${key},
      1,
      to_timestamp(${at}::double precision / 1000) AT TIME ZONE 'UTC',
      NULL
    )
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN auth_attempts."firstAt"
             < to_timestamp(${windowOpened}::double precision / 1000) AT TIME ZONE 'UTC'
        THEN 1
        ELSE auth_attempts."count" + 1
      END,
      "firstAt" = CASE
        WHEN auth_attempts."firstAt"
             < to_timestamp(${windowOpened}::double precision / 1000) AT TIME ZONE 'UTC'
        THEN to_timestamp(${at}::double precision / 1000) AT TIME ZONE 'UTC'
        ELSE auth_attempts."firstAt"
      END,
      "lockedUntil" = CASE
        WHEN auth_attempts."firstAt"
             < to_timestamp(${windowOpened}::double precision / 1000) AT TIME ZONE 'UTC'
        THEN NULL
        WHEN auth_attempts."count" + 1 >= ${MAX_ATTEMPTS}
        THEN to_timestamp(${lockUntil}::double precision / 1000) AT TIME ZONE 'UTC'
        ELSE NULL
      END
  `;
}

/** Call after a success. The key has proved it is not an attacker. */
export async function clearAttempts(key: string): Promise<void> {
  await db.authAttempt.deleteMany({ where: { key } });
}

/**
 * Drop rows whose window has closed and whose lockout has expired.
 *
 * Nothing here is load-bearing — a stale row is ignored by decide() — so
 * this only stops the table growing forever. Called on successful
 * sign-in, which is rare enough to be free and frequent enough to keep up.
 */
export async function purgeStaleAttempts(now = Date.now()): Promise<number> {
  const result = await db.authAttempt.deleteMany({
    where: {
      firstAt: { lt: new Date(now - WINDOW_MS) },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: new Date(now) } }],
    },
  });
  return result.count;
}

/** Exported so the pure and SQL paths can be checked against each other. */
export { afterFailure, decide };
