import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { hasLiveCode, issueCode } from "@/lib/repositories/verification";
import { makeUser, cleanupAll } from "./harness";

/**
 * Whether a code is already waiting.
 *
 * This decides whether opening the verification page sends one. It used
 * to be decided by a ?sent=1 parameter that sign-up added, which was
 * wrong in both directions: reaching the page from the banner sent
 * nothing, so people waited for an email that was never coming — and
 * refreshing a URL that still carried the parameter tried to send
 * another every time.
 *
 * So the cases that matter are "nothing outstanding" and "one already
 * live", and they are checked against the real table rather than by
 * reasoning about it.
 */

let userId: string;

beforeEach(async () => {
  const user = await makeUser();
  userId = user.id;
});

afterAll(async () => {
  // cleanupAll rather than cleanup: several users are made across these
  // tests, including the second one in the isolation case, and cleanup
  // takes a single user.
  await cleanupAll();
});

describe("hasLiveCode", () => {
  it("is false for an account that has never had one", async () => {
    expect(await hasLiveCode(userId, "email_verify")).toBe(false);
  });

  it("is true once one has been issued", async () => {
    const issued = await issueCode(userId, "email_verify");
    expect(issued.ok).toBe(true);
    expect(await hasLiveCode(userId, "email_verify")).toBe(true);
  });

  it("stays true across repeated checks, so a refresh sends nothing", async () => {
    await issueCode(userId, "email_verify");
    for (let i = 0; i < 5; i++) {
      expect(await hasLiveCode(userId, "email_verify")).toBe(true);
    }
  });

  it("is false again once the code has been used", async () => {
    await issueCode(userId, "email_verify");
    await db.verificationCode.updateMany({
      where: { userId, purpose: "email_verify" },
      data: { consumedAt: new Date() },
    });
    expect(await hasLiveCode(userId, "email_verify")).toBe(false);
  });

  it("is false once it has expired, so a stale code does not block a new one", async () => {
    await issueCode(userId, "email_verify");
    await db.verificationCode.updateMany({
      where: { userId, purpose: "email_verify" },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await hasLiveCode(userId, "email_verify")).toBe(false);
  });

  it("does not confuse one purpose with another", async () => {
    // A pending password reset must not stop a verification code being
    // sent, and vice versa.
    await issueCode(userId, "password_reset");
    expect(await hasLiveCode(userId, "password_reset")).toBe(true);
    expect(await hasLiveCode(userId, "email_verify")).toBe(false);
  });

  it("does not see another account's code", async () => {
    const other = await makeUser();
    await issueCode(other.id, "email_verify");
    expect(await hasLiveCode(userId, "email_verify")).toBe(false);
  });
});
