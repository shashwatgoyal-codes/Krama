import { describe, it, expect } from "vitest";
import { encode, verify, remainingMs, STEPUP_TTL_MINUTES } from "@/lib/admin/stepup";

/**
 * The token that says "you proved it was you, recently".
 *
 * Everything here is about refusing. The one thing this must never do is
 * accept a token it should not — a forged one, an expired one, or one
 * minted for somebody else — so those are the cases stated in full.
 */

// Set at module load, not in beforeAll. A describe body runs during
// collection, before any hook — so a token minted there would be signed
// with whatever secret happened to be in the environment and verified
// with this one. The mismatch made every "must refuse" test below pass
// for the wrong reason, which is the worst way for a security test to
// pass.
process.env.SESSION_SECRET = "test-secret-at-least-sixteen-characters-long";

const USER = "user_abc";
const OTHER = "user_xyz";

describe("a fresh token", () => {
  it("verifies for the person it was minted for", () => {
    expect(verify(encode(USER), USER)).toBe(true);
  });

  it("does not verify for anybody else", () => {
    // Otherwise one admin's step-up would open the portal for another.
    expect(verify(encode(USER), OTHER)).toBe(false);
  });

  it("is different every time, even for the same person in the same moment", () => {
    const now = 1_000_000;
    expect(encode(USER, now)).not.toBe(encode(USER, now));
  });

  it("reports roughly the configured lifetime remaining", () => {
    const now = 1_000_000;
    const left = remainingMs(encode(USER, now), now);
    expect(left).toBe(STEPUP_TTL_MINUTES * 60_000);
  });
});

describe("expiry", () => {
  const now = 5_000_000;
  const token = encode(USER, now);

  it("holds one millisecond before it lapses", () => {
    expect(verify(token, USER, now + STEPUP_TTL_MINUTES * 60_000 - 1)).toBe(true);
  });

  it("is refused the moment it lapses", () => {
    expect(verify(token, USER, now + STEPUP_TTL_MINUTES * 60_000)).toBe(false);
  });

  it("stays refused long after", () => {
    expect(verify(token, USER, now + 86_400_000)).toBe(false);
  });

  it("reports nothing remaining once lapsed", () => {
    expect(remainingMs(token, now + 86_400_000)).toBe(0);
  });
});

describe("tampering", () => {
  // Minted inside each test, so every one of these is checked against a
  // token that genuinely verifies when untouched.
  const parts = () => {
    const [body, mac] = encode(USER).split(".");
    return { body, mac };
  };

  it("is a real token before it is tampered with", () => {
    // Guards the rest of this block: without it, a token that never
    // verified would make every refusal below meaningless.
    const { body, mac } = parts();
    expect(verify(`${body}.${mac}`, USER)).toBe(true);
  });

  it("refuses a token with no signature", () => {
    expect(verify(parts().body, USER)).toBe(false);
  });

  it("refuses a token with a wrong signature", () => {
    const { body, mac } = parts();
    expect(verify(`${body}.${"0".repeat(mac.length)}`, USER)).toBe(false);
  });

  it("refuses a payload edited to name somebody else", () => {
    const { body, mac } = parts();
    // The attack this exists to stop: take your own valid token, swap
    // the id, keep the signature. The signature no longer matches.
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    payload.userId = OTHER;
    const forged = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(verify(`${forged}.${mac}`, OTHER)).toBe(false);
  });

  it("refuses a payload edited to last longer", () => {
    const { body, mac } = parts();
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    payload.expiresAt = Date.now() + 86_400_000 * 365;
    const forged = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(verify(`${forged}.${mac}`, USER)).toBe(false);
  });

  for (const junk of ["", "   ", ".", "a.b", "....", "not-a-token", "a".repeat(500)]) {
    it(`refuses ${JSON.stringify(junk.slice(0, 18))} without throwing`, () => {
      expect(() => verify(junk, USER)).not.toThrow();
      expect(verify(junk, USER)).toBe(false);
    });
  }

  it("refuses undefined — no cookie is not a valid cookie", () => {
    expect(verify(undefined, USER)).toBe(false);
    expect(remainingMs(undefined)).toBe(0);
  });
});

describe("the lifetime itself", () => {
  it("is short enough to matter and long enough to work in", () => {
    expect(STEPUP_TTL_MINUTES).toBeGreaterThanOrEqual(5);
    expect(STEPUP_TTL_MINUTES).toBeLessThanOrEqual(120);
  });

  it("is far shorter than the login session it sits inside", () => {
    // The whole point: the 30-day session must not carry portal access.
    const sessionDays = 30;
    expect(STEPUP_TTL_MINUTES * 60_000).toBeLessThan(sessionDays * 86_400_000 / 100);
  });
});
