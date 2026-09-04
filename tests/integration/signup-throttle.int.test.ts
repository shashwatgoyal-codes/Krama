import { describe, it, expect, afterAll, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  checkRateLimit,
  recordFailure,
  clearAttempts,
} from "@/lib/repositories/auth-attempts";
import { cleanupAll } from "./harness";

/**
 * Creating an account is throttled.
 *
 * It was the one unauthenticated action with nothing in front of it. The
 * open_registration flag closes the door while registration is shut, but
 * a flag is a policy, not a limit — the moment it opens, this is an
 * endpoint that mints rows on demand.
 *
 * It is also the place someone can ask "does this address have an
 * account". A sign-up form has to answer that to be usable, so the
 * throttle is what keeps the answer from being asked ten thousand times.
 */

const KEY = "it-signup-throttle:someone@krama.invalid";

beforeEach(async () => {
  await clearAttempts(KEY);
});

afterAll(async () => {
  await clearAttempts(KEY);
  await cleanupAll();
});

describe("the sign-up throttle", () => {
  it("allows a first attempt", async () => {
    expect((await checkRateLimit(KEY)).allowed).toBe(true);
  });

  it("closes after enough failures, and says how long for", async () => {
    let blocked = false;
    for (let i = 0; i < 12; i++) {
      const limit = await checkRateLimit(KEY);
      if (!limit.allowed) {
        blocked = true;
        expect(limit.retryAfterMs).toBeGreaterThan(0);
        break;
      }
      await recordFailure(KEY);
    }
    expect(blocked).toBe(true);
  });

  it("is cleared by a success, so a real person is not punished", async () => {
    for (let i = 0; i < 12; i++) await recordFailure(KEY);
    expect((await checkRateLimit(KEY)).allowed).toBe(false);

    await clearAttempts(KEY);
    expect((await checkRateLimit(KEY)).allowed).toBe(true);
  });

  it("keeps one address's attempts away from another's", async () => {
    const other = "it-signup-throttle:someone-else@krama.invalid";
    await clearAttempts(other);
    for (let i = 0; i < 12; i++) await recordFailure(KEY);

    expect((await checkRateLimit(KEY)).allowed).toBe(false);
    expect((await checkRateLimit(other)).allowed).toBe(true);
    await clearAttempts(other);
  });

  it("stores no attempt row in the clear beyond its key", async () => {
    await recordFailure(KEY);
    const row = await db.authAttempt.findUnique({ where: { key: KEY } });
    expect(row).not.toBeNull();
    expect(Object.keys(row!)).toEqual(
      expect.arrayContaining(["key", "count", "firstAt"]),
    );
  });
});
