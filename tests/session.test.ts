import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression cover for a bug that made /app return 500.
 *
 * getSessionUser() runs in two very different places: server actions, where
 * setting a cookie is legal, and page renders, where Next throws if you try.
 * The sliding-expiry refresh set a cookie unconditionally, so once a session
 * aged past the refresh threshold every page load threw — signed in, valid
 * session, 500 anyway.
 */

const jarSet = vi.fn();
const jarGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: jarGet, set: jarSet, delete: vi.fn() }),
}));

const findUnique = vi.fn();
const update = vi.fn().mockResolvedValue({});
const deleteFn = vi.fn().mockResolvedValue({});

vi.mock("@/lib/db", () => ({
  db: { session: { findUnique, update, delete: deleteFn } },
}));

const { getSessionUser } = await import("@/lib/auth/session");
const { SESSION_COOKIE } = await import("@/lib/auth/constants");

const USER = { id: "u1", email: "a@b.com", name: "A" };
const DAY = 86_400_000;

/** Old enough that the sliding-expiry branch runs. */
function staleSession() {
  return {
    id: "s1",
    expiresAt: new Date(Date.now() + 2 * DAY),
    user: USER,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  jarGet.mockReturnValue({ value: "raw-token" });
  update.mockResolvedValue({});
});

describe("getSessionUser during a page render", () => {
  it("returns the user even though the cookie write is forbidden", async () => {
    findUnique.mockResolvedValue(staleSession());
    jarSet.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action");
    });

    await expect(getSessionUser()).resolves.toEqual(USER);
  });

  it("still extends the session in the database, which is the authority", async () => {
    findUnique.mockResolvedValue(staleSession());
    jarSet.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action");
    });

    await getSessionUser();

    expect(update).toHaveBeenCalledOnce();
    const { where, data } = update.mock.calls[0][0];
    expect(where).toEqual({ id: "s1" });
    // Pushed out well beyond the two days it had left.
    expect(data.expiresAt.getTime()).toBeGreaterThan(Date.now() + 20 * DAY);
  });

  it("sets the cookie when the context does allow it", async () => {
    findUnique.mockResolvedValue(staleSession());

    await getSessionUser();

    expect(jarSet).toHaveBeenCalledOnce();
    expect(jarSet.mock.calls[0][0]).toBe(SESSION_COOKIE);
    expect(jarSet.mock.calls[0][1]).toBe("raw-token");
  });
});

describe("getSessionUser basics", () => {
  it("returns null with no cookie, without querying", async () => {
    jarGet.mockReturnValue(undefined);
    await expect(getSessionUser()).resolves.toBeNull();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("returns null when the token matches no session", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getSessionUser()).resolves.toBeNull();
  });

  it("deletes an expired session rather than honouring it", async () => {
    findUnique.mockResolvedValue({
      id: "s1",
      expiresAt: new Date(Date.now() - 1000),
      user: USER,
    });

    await expect(getSessionUser()).resolves.toBeNull();
    expect(deleteFn).toHaveBeenCalledWith({ where: { id: "s1" } });
  });

  it("looks the session up by hash, never by the raw token", async () => {
    findUnique.mockResolvedValue(staleSession());
    await getSessionUser();

    const { where } = findUnique.mock.calls[0][0];
    expect(where.tokenHash).not.toBe("raw-token");
    expect(where.tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not touch the cookie when the session is nowhere near expiry", async () => {
    findUnique.mockResolvedValue({
      id: "s1",
      expiresAt: new Date(Date.now() + 29 * DAY),
      user: USER,
    });

    await getSessionUser();

    expect(update).not.toHaveBeenCalled();
    expect(jarSet).not.toHaveBeenCalled();
  });
});
