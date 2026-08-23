import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  checkRateLimit,
  recordFailure,
  clearAttempts,
  purgeStaleAttempts,
} from "@/lib/repositories/auth-attempts";
import {
  afterFailure,
  MAX_ATTEMPTS,
  LOCKOUT_MS,
  WINDOW_MS,
  type Attempt,
} from "@/lib/auth/rate-limit";

/**
 * The throttle, against a real database.
 *
 * The thing worth testing here is not that a counter counts. It is that
 * the CASE arms in the SQL and afterFailure() in the pure module still
 * agree: the same rule is written twice, in two languages, and nothing
 * makes them move together. A drift between them would show up as a
 * limiter that is quietly looser than the tests claim.
 */

const KEY = "test:rate-limit@example.invalid";
const OTHER = "test:someone-else@example.invalid";

async function readAttempt(key: string): Promise<Attempt | null> {
  const row = await db.authAttempt.findUnique({ where: { key } });
  if (!row) return null;
  return {
    count: row.count,
    firstAt: row.firstAt.getTime(),
    lockedUntil: row.lockedUntil?.getTime() ?? null,
  };
}

beforeEach(async () => {
  await db.authAttempt.deleteMany({
    where: { key: { in: [KEY, OTHER] } },
  });
});

afterAll(async () => {
  await db.authAttempt.deleteMany({
    where: { key: { startsWith: "test:" } },
  });
});

describe("rate limiting, against Postgres", () => {
  it("allows a key with nothing on record", async () => {
    expect((await checkRateLimit(KEY)).allowed).toBe(true);
  });

  it("locks out after the allowance is spent", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) await recordFailure(KEY);
    const result = await checkRateLimit(KEY);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(LOCKOUT_MS);
  });

  it("keeps one key's lockout away from another's", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) await recordFailure(KEY);
    expect((await checkRateLimit(KEY)).allowed).toBe(false);
    expect((await checkRateLimit(OTHER)).allowed).toBe(true);
  });

  it("clears on success", async () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) await recordFailure(KEY);
    expect((await checkRateLimit(KEY)).allowed).toBe(false);
    await clearAttempts(KEY);
    expect((await checkRateLimit(KEY)).allowed).toBe(true);
    expect(await readAttempt(KEY)).toBe(null);
  });

  it("writes what afterFailure would have written, every step of the way", async () => {
    // The assertion that matters: SQL and TypeScript, same rule.
    let expected: Attempt | null = null;
    for (let i = 0; i < MAX_ATTEMPTS + 2; i++) {
      const now = Date.now();
      await recordFailure(KEY, now);
      expected = afterFailure(expected, now);
      const actual = await readAttempt(KEY);

      expect(actual).not.toBe(null);
      expect(actual!.count).toBe(expected.count);
      // Both are derived from the same `now`, so the lock state must match
      // exactly even though the timestamps round-trip through Postgres.
      expect(actual!.lockedUntil === null).toBe(expected.lockedUntil === null);
      if (expected.lockedUntil !== null) {
        expect(Math.abs(actual!.lockedUntil! - expected.lockedUntil)).toBeLessThan(1000);
      }
    }
  });

  it("starts a new window rather than resuming an abandoned one", async () => {
    const old = Date.now() - WINDOW_MS - 60_000;
    await recordFailure(KEY, old);
    await recordFailure(KEY, old);
    expect((await readAttempt(KEY))!.count).toBe(2);

    // A failure after the window has closed resets rather than accumulates.
    await recordFailure(KEY, Date.now());
    expect((await readAttempt(KEY))!.count).toBe(1);
    expect((await checkRateLimit(KEY)).allowed).toBe(true);
  });

  it("counts concurrent failures once each, not once in total", async () => {
    // The reason this is one SQL statement. Read-modify-write would let
    // these interleave and spend fewer than they should.
    await Promise.all(
      Array.from({ length: MAX_ATTEMPTS }, () => recordFailure(KEY)),
    );
    expect((await readAttempt(KEY))!.count).toBe(MAX_ATTEMPTS);
    expect((await checkRateLimit(KEY)).allowed).toBe(false);
  });

  it("sweeps away closed windows and leaves live ones alone", async () => {
    await recordFailure(KEY, Date.now() - WINDOW_MS - 60_000);
    await recordFailure(OTHER, Date.now());

    await purgeStaleAttempts();

    expect(await readAttempt(KEY)).toBe(null);
    expect(await readAttempt(OTHER)).not.toBe(null);
  });

  it("does not sweep away a key that is still locked out", async () => {
    // Its window has closed but the lockout has not — deleting it here
    // would hand an attacker their allowance back early.
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      await recordFailure(KEY, Date.now() - WINDOW_MS + 1000);
    }
    await purgeStaleAttempts(Date.now());
    expect(await readAttempt(KEY)).not.toBe(null);
  });
});
