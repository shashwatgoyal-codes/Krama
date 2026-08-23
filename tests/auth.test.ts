import { describe, it, expect, beforeEach } from "vitest";
import {
  checkPassword,
  hashPassword,
  verifyPassword,
  MIN_PASSWORD_LENGTH,
} from "@/lib/auth/password";
import {
  createSessionToken,
  hashSessionToken,
  tokensMatch,
  sessionExpiry,
  shouldRefresh,
  sessionCookieOptions,
  SESSION_TTL_DAYS,
} from "@/lib/auth/token";
import {
  decide,
  afterFailure,
  retryMessage,
  MAX_ATTEMPTS,
  LOCKOUT_MS,
  type Attempt,
} from "@/lib/auth/rate-limit";
import { signUpSchema, signInSchema, emailSchema } from "@/lib/validation";

describe("password rules", () => {
  it("requires length, not character classes", () => {
    // A long passphrase with no symbols must pass — composition rules
    // push people toward "Password1!" without adding real strength.
    expect(checkPassword("correct horse battery staple").ok).toBe(true);
  });

  it("rejects anything shorter than the minimum", () => {
    const short = "a".repeat(MIN_PASSWORD_LENGTH - 1);
    expect(checkPassword(short).ok).toBe(false);
  });

  it("rejects known-obvious passwords that pass the length check", () => {
    expect(checkPassword("password123").ok).toBe(false);
    expect(checkPassword("PASSWORD123").ok).toBe(false); // case-insensitive
  });

  it("rejects absurdly long input, so hashing can't be a DoS", () => {
    expect(checkPassword("a".repeat(5000)).ok).toBe(false);
  });
});

describe("password hashing", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("a long enough test password");
    expect(await verifyPassword(hash, "a long enough test password")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("a long enough test password");
    expect(await verifyPassword(hash, "some other password")).toBe(false);
  });

  it("never stores the password itself", async () => {
    const secret = "a long enough test password";
    const hash = await hashPassword(secret);
    expect(hash).not.toContain(secret);
    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("salts — the same password hashes differently each time", async () => {
    const a = await hashPassword("a long enough test password");
    const b = await hashPassword("a long enough test password");
    expect(a).not.toBe(b);
  });

  it("returns false rather than throwing on a corrupt hash", async () => {
    expect(await verifyPassword("not-a-real-hash", "anything")).toBe(false);
  });
});

describe("session tokens", () => {
  it("produces unguessable, unique tokens", () => {
    const seen = new Set(Array.from({ length: 200 }, createSessionToken));
    expect(seen.size).toBe(200);
    expect(createSessionToken().length).toBeGreaterThanOrEqual(40);
  });

  it("stores only a hash, never the token", () => {
    const token = createSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64); // sha256 hex
  });

  it("hashes deterministically, so lookup works", () => {
    const token = createSessionToken();
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
  });

  it("compares in constant time without throwing on length mismatch", () => {
    const a = createSessionToken();
    expect(tokensMatch(a, a)).toBe(true);
    expect(tokensMatch(a, "short")).toBe(false);
  });

  it("sets a cookie the browser won't hand to JavaScript", () => {
    expect(sessionCookieOptions.httpOnly).toBe(true);
    expect(sessionCookieOptions.sameSite).toBe("lax");
    expect(sessionCookieOptions.path).toBe("/");
  });

  it("expires 30 days out", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const days =
      (sessionExpiry(now).getTime() - now.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(SESSION_TTL_DAYS, 5);
  });

  it("slides only once past halfway, not on every request", () => {
    const now = new Date("2026-08-15T00:00:00Z");
    const fresh = new Date(now.getTime() + 29 * 86_400_000);
    const stale = new Date(now.getTime() + 5 * 86_400_000);
    expect(shouldRefresh(fresh, now)).toBe(false);
    expect(shouldRefresh(stale, now)).toBe(true);
  });
});

/**
 * The limiter's storage now lives in Postgres, so these exercise the pure
 * decision core against an in-test store. Same assertions as before the
 * move — the point of splitting the module was that this stayed testable
 * without a database.
 */
function limiter() {
  const store = new Map<string, Attempt>();
  return {
    check: (key: string, now = Date.now()) => decide(store.get(key) ?? null, now),
    fail: (key: string, now = Date.now()) =>
      store.set(key, afterFailure(store.get(key) ?? null, now)),
    clear: (key: string) => store.delete(key),
  };
}

describe("sign-in rate limiting", () => {
  let rl: ReturnType<typeof limiter>;
  beforeEach(() => {
    rl = limiter();
  });

  it("allows the first attempt", () => {
    expect(rl.check("ip:someone@example.com").allowed).toBe(true);
  });

  it("locks out after the allowance is spent", () => {
    const key = "ip:someone@example.com";
    for (let i = 0; i < MAX_ATTEMPTS; i++) rl.fail(key);
    const result = rl.check(key);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(LOCKOUT_MS);
  });

  it("keeps one person's lockout away from another's", () => {
    for (let i = 0; i < MAX_ATTEMPTS; i++) rl.fail("ip:victim@example.com");
    expect(rl.check("ip:victim@example.com").allowed).toBe(false);
    expect(rl.check("ip:someone-else@example.com").allowed).toBe(true);
  });

  it("clears the count after a successful sign-in", () => {
    const key = "ip:someone@example.com";
    rl.fail(key);
    rl.fail(key);
    rl.clear(key);
    expect(rl.check(key).allowed).toBe(true);
  });

  it("lets the lockout lapse once the window passes", () => {
    const key = "ip:someone@example.com";
    const t0 = 1_000_000;
    for (let i = 0; i < MAX_ATTEMPTS; i++) rl.fail(key, t0);
    expect(rl.check(key, t0).allowed).toBe(false);
    expect(rl.check(key, t0 + LOCKOUT_MS + 1000).allowed).toBe(true);
  });

  it("never tells someone to try again in zero minutes", () => {
    // Rounded up, because "try again in 0 minutes" is not an instruction.
    for (const ms of [1, 999, 60_000, 60_001, LOCKOUT_MS]) {
      expect(retryMessage(ms)).not.toContain("0 minute");
      expect(retryMessage(ms)).toMatch(/\d+ minutes?\./);
    }
    expect(retryMessage(60_000)).toContain("1 minute.");
    expect(retryMessage(120_000)).toContain("2 minutes.");
  });
});

describe("input validation", () => {
  it("normalises email so Casing@X and casing@x are one account", () => {
    expect(emailSchema.parse("  Shashwat@Example.COM ")).toBe(
      "shashwat@example.com",
    );
  });

  it("rejects malformed email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
  });

  it("requires every sign-up field", () => {
    expect(
      signUpSchema.safeParse({ email: "a@b.com", password: "long enough pw" })
        .success,
    ).toBe(false);
  });

  it("strips unknown fields, so a crafted post can't smuggle values in", () => {
    const parsed = signUpSchema.parse({
      name: "Shashwat",
      email: "a@b.com",
      password: "a long enough password",
      isAdmin: true,
    } as never);
    expect(parsed).not.toHaveProperty("isAdmin");
  });

  it("doesn't apply full password rules on sign-in", () => {
    // An older account may predate the rules; rejecting a valid password
    // at the door would be maddening and tells an attacker nothing useful.
    expect(
      signInSchema.safeParse({ email: "a@b.com", password: "short" }).success,
    ).toBe(true);
  });
});
