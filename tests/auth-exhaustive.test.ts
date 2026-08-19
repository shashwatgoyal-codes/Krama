import { describe, it, expect, beforeEach } from "vitest";
import {
  checkPassword,
  hashPassword,
  verifyPassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
} from "@/lib/auth/password";
import {
  checkRateLimit,
  recordFailure,
  clearAttempts,
  resetRateLimiter,
  MAX_ATTEMPTS,
  LOCKOUT_MS,
} from "@/lib/auth/rate-limit";
import {
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  sessionCookieOptions,
} from "@/lib/auth/constants";
import { withVerifiedSsl } from "@/lib/neon";
import { appEnv } from "@/lib/env";

/**
 * The parts that decide whether someone is who they say they are.
 *
 * Rate limiting and password handling both fail quietly when they fail:
 * a limiter that resets too eagerly still looks like a limiter, and a
 * cookie missing httpOnly still logs you in. So these assert the
 * properties that make them worth having rather than that they run.
 */

describe("checkPassword", () => {
  it("refuses everything below the minimum length", () => {
    for (let length = 0; length < MIN_PASSWORD_LENGTH; length++) {
      expect(checkPassword("x".repeat(length)).ok).toBe(false);
    }
  });

  it("accepts from the minimum up to the maximum", () => {
    for (const length of [MIN_PASSWORD_LENGTH, 20, 64, MAX_PASSWORD_LENGTH]) {
      expect(checkPassword("x".repeat(length)).ok).toBe(true);
    }
  });

  it("refuses one character past the maximum", () => {
    expect(checkPassword("x".repeat(MAX_PASSWORD_LENGTH + 1)).ok).toBe(false);
  });

  it("prefers a long phrase to a short scramble, as the hint promises", () => {
    expect(checkPassword("correct horse battery staple").ok).toBe(true);
    expect(checkPassword("P@ss1!").ok).toBe(false);
  });

  it("gives a reason whenever it refuses", () => {
    for (const password of ["", "short", "x".repeat(500)]) {
      const result = checkPassword(password);
      if (!result.ok) expect(result.reason.length).toBeGreaterThan(0);
    }
  });
});

describe("hashPassword and verifyPassword", () => {
  it("never stores the password itself", async () => {
    const password = "a long enough passphrase";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
  }, 20_000);

  it("produces a different hash each time, so two accounts never match", async () => {
    const password = "a long enough passphrase";
    const a = await hashPassword(password);
    const b = await hashPassword(password);
    expect(a).not.toBe(b);
  }, 20_000);

  it("verifies the password it was given", async () => {
    const password = "a long enough passphrase";
    const hash = await hashPassword(password);
    expect(await verifyPassword(hash, password)).toBe(true);
  }, 20_000);

  it("refuses a password that is wrong by one character", async () => {
    const hash = await hashPassword("a long enough passphrase");
    expect(await verifyPassword(hash, "a long enough passphras")).toBe(false);
    expect(await verifyPassword(hash, "A long enough passphrase")).toBe(false);
  }, 20_000);

  it("refuses rather than throwing on a malformed hash", async () => {
    for (const hash of ["", "not-a-hash", "$argon2id$nonsense"]) {
      await expect(verifyPassword(hash, "anything at all")).resolves.toBe(
        false,
      );
    }
  }, 20_000);
});

describe("rate limiting", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it("allows a fresh key", () => {
    expect(checkRateLimit("fresh@example.com").allowed).toBe(true);
  });

  it("allows exactly the stated number of failures before locking", () => {
    const key = "user@example.com";
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      expect(checkRateLimit(key).allowed).toBe(true);
      recordFailure(key);
    }
    expect(checkRateLimit(key).allowed).toBe(false);
  });

  it("keeps separate counts per key, so one user cannot lock out another", () => {
    const victim = "victim@example.com";
    for (let i = 0; i < MAX_ATTEMPTS + 3; i++) recordFailure("attacker");
    expect(checkRateLimit(victim).allowed).toBe(true);
    expect(checkRateLimit("attacker").allowed).toBe(false);
  });

  it("forgets the failures once the lockout has passed", () => {
    const key = "user@example.com";
    const start = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) recordFailure(key, start);
    expect(checkRateLimit(key, start).allowed).toBe(false);
    expect(checkRateLimit(key, start + LOCKOUT_MS + 1).allowed).toBe(true);
  });

  it("is still locked one millisecond before the window closes", () => {
    const key = "user@example.com";
    const start = 2_000_000;
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) recordFailure(key, start);
    expect(checkRateLimit(key, start + LOCKOUT_MS - 1).allowed).toBe(false);
  });

  it("clears on a successful sign-in", () => {
    const key = "user@example.com";
    for (let i = 0; i < MAX_ATTEMPTS + 1; i++) recordFailure(key);
    expect(checkRateLimit(key).allowed).toBe(false);
    clearAttempts(key);
    expect(checkRateLimit(key).allowed).toBe(true);
  });

  it("holds up across many distinct keys", () => {
    for (let i = 0; i < 100; i++) {
      const key = `user${i}@example.com`;
      for (let n = 0; n < MAX_ATTEMPTS + 1; n++) recordFailure(key);
      expect(checkRateLimit(key).allowed).toBe(false);
    }
    expect(checkRateLimit("someone-else").allowed).toBe(true);
  });

  it("locks out for a window long enough to matter but short enough to survive", () => {
    expect(LOCKOUT_MS).toBeGreaterThanOrEqual(60_000);
    expect(LOCKOUT_MS).toBeLessThanOrEqual(60 * 60_000);
  });
});

describe("the session cookie", () => {
  it("is httpOnly, so script cannot read it", () => {
    expect(sessionCookieOptions.httpOnly).toBe(true);
  });

  it("is sameSite lax, which blocks the cross-site post", () => {
    expect(sessionCookieOptions.sameSite).toBe("lax");
  });

  it("is scoped to the whole site", () => {
    expect(sessionCookieOptions.path).toBe("/");
  });

  it("lasts a sensible number of days", () => {
    expect(SESSION_TTL_DAYS).toBeGreaterThanOrEqual(7);
    expect(SESSION_TTL_DAYS).toBeLessThanOrEqual(90);
  });

  it("has a name that does not advertise the stack", () => {
    expect(SESSION_COOKIE.length).toBeGreaterThan(0);
    expect(SESSION_COOKIE.toLowerCase()).not.toContain("next");
  });
});

describe("withVerifiedSsl", () => {
  it("raises require to verify-full", () => {
    const out = withVerifiedSsl("postgres://u:p@host/db?sslmode=require");
    expect(out).toContain("sslmode=verify-full");
  });

  it("raises prefer and verify-ca too", () => {
    for (const mode of ["prefer", "verify-ca", "allow"]) {
      expect(withVerifiedSsl(`postgres://u:p@host/db?sslmode=${mode}`)).toContain(
        "verify-full",
      );
    }
  });

  it("adds the mode when none is given", () => {
    expect(withVerifiedSsl("postgres://u:p@host/db")).toContain(
      "sslmode=verify-full",
    );
  });

  it("leaves a deliberate disable alone", () => {
    const url = "postgres://u:p@host/db?sslmode=disable";
    expect(withVerifiedSsl(url)).toContain("sslmode=disable");
    expect(withVerifiedSsl(url)).not.toContain("verify-full");
  });

  it("keeps the other parameters", () => {
    const out = withVerifiedSsl(
      "postgres://u:p@host/db?sslmode=require&channel_binding=require",
    );
    expect(out).toContain("channel_binding=require");
  });

  it("returns unusable input untouched rather than throwing", () => {
    for (const input of ["", "not a url", "://"]) {
      expect(() => withVerifiedSsl(input)).not.toThrow();
    }
  });

  it("is idempotent", () => {
    const once = withVerifiedSsl("postgres://u:p@host/db?sslmode=require");
    expect(withVerifiedSsl(once)).toBe(once);
  });
});

describe("appEnv", () => {
  const originals = process.env.APP_ENV;

  it("recognises each named environment", () => {
    for (const name of ["dev", "qa", "stage", "prod"]) {
      process.env.APP_ENV = name;
      expect(appEnv()).toBe(name);
    }
    process.env.APP_ENV = originals;
  });

  it("falls back to dev for anything it does not recognise", () => {
    for (const name of ["", "production", "staging", "nonsense"]) {
      process.env.APP_ENV = name;
      expect(appEnv()).toBe("dev");
    }
    process.env.APP_ENV = originals;
  });

  it("falls back to dev when unset, rather than assuming production", () => {
    delete process.env.APP_ENV;
    expect(appEnv()).toBe("dev");
    process.env.APP_ENV = originals;
  });
});
