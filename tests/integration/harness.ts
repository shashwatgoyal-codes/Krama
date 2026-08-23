import { db } from "@/lib/db";

/**
 * A throwaway account per test, and nothing left behind.
 *
 * These tests run against a real Postgres, which means they can see each
 * other's data and each other's mistakes. Every one gets its own user,
 * and every row it creates hangs off that user, so "clean up" is a
 * single cascading delete rather than a list of tables somebody will
 * forget to extend.
 *
 * The ledger is append-only and refuses ordinary deletes, so the
 * teardown opens the transaction-local escape hatch the schema provides
 * — the same one account deletion uses in the app.
 */

let counter = 0;

export type TestUser = {
  id: string;
  email: string;
  name: string;
};

/** Creates an isolated account. Call `cleanup` in afterEach. */
export async function makeUser(label = "case"): Promise<TestUser> {
  counter += 1;
  const email = `it-${label}-${counter}-${randomSuffix()}@krama.invalid`;
  const user = await db.user.create({
    data: {
      email,
      name: `Integration ${label}`,
      // Not a real hash. Nothing here signs in; the auth tests build
      // their own users with real hashes where it matters.
      passwordHash: "integration-test-not-a-real-hash",
      emailVerified: new Date(),
      profile: { create: {} },
    },
    select: { id: true, email: true, name: true },
  });
  return user;
}

/**
 * Removes the account and everything hanging off it.
 *
 * Safe to call twice, and safe to call on a user that failed halfway
 * through being set up — a test that has already failed should not also
 * fail its own teardown and bury the real error.
 */
export async function cleanup(user: TestUser | null): Promise<void> {
  if (!user) return;
  try {
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL krama.allow_ledger_delete = 'on'`);
      await tx.user.deleteMany({ where: { id: user.id } });
    });
  } catch {
    // Best effort. A leaked test row is a nuisance; a masked assertion
    // failure is a bug that ships.
  }
}

/** Removes any account this harness has ever created. For a fresh start. */
export async function cleanupAll(): Promise<number> {
  const stale = await db.user.findMany({
    where: { email: { endsWith: "@krama.invalid" } },
    select: { id: true },
  });
  for (const u of stale) await cleanup({ ...u, email: "", name: "" });
  return stale.length;
}

/** Three areas, as a real account gets on signup. */
export async function makeAreas(userId: string) {
  await db.area.createMany({
    data: [
      { userId, name: "Work", colour: "acc", order: 0 },
      { userId, name: "Learning", colour: "ok", order: 1 },
      { userId, name: "Personal", colour: "warn", order: 2 },
    ],
  });
  return db.area.findMany({
    where: { userId },
    orderBy: { order: "asc" },
    select: { id: true, name: true },
  });
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** A day key, so tests do not depend on the day they are run. */
export const DAY = {
  monday: "2026-08-17",
  tuesday: "2026-08-18",
  wednesday: "2026-08-19",
  sunday: "2026-08-23",
} as const;

export function dayDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}
