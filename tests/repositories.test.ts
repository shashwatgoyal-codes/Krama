import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * These tests exist for one reason: to prove that every database call
 * filters on userId.
 *
 * The whole authorisation model is "the repository always scopes by
 * user". A single forgotten filter leaks another account's rows, and
 * that's a mistake that reads as harmless in review. So rather than
 * trusting it, the Prisma client is mocked and every call it receives
 * is inspected.
 */

type Call = { model: string; method: string; args: Record<string, any> };
const calls: Call[] = [];

function recorder(model: string) {
  return new Proxy(
    {},
    {
      get: (_t, method: string) => (args: Record<string, any>) => {
        calls.push({ model, method, args });
        if (method === "findMany") return Promise.resolve([]);
        if (method === "aggregate")
          return Promise.resolve({ _sum: { points: 7 } });
        if (method === "updateMany" || method === "deleteMany")
          return Promise.resolve({ count: 1 });
        return Promise.resolve({ id: "tsk_1", title: "x" });
      },
    },
  );
}

vi.mock("@/lib/db", () => ({
  db: { task: recorder("task"), pointEntry: recorder("pointEntry") },
}));

const {
  listTasksForDay,
  listOpenTasks,
  getTask,
  createTask,
  setTaskStatus,
  deleteTask,
  pointsOnDay,
} = await import("@/lib/repositories/tasks");

const USER = "usr_owner";
const OTHER = "usr_someone_else";

/** Pulls the userId out of whatever shape the call used. */
function userIdIn(args: Record<string, any>): unknown {
  return args?.where?.userId ?? args?.data?.userId;
}

beforeEach(() => {
  calls.length = 0;
});

describe("every read is scoped to the signed-in user", () => {
  it("listTasksForDay filters on userId", async () => {
    await listTasksForDay(USER, "2026-08-15");
    expect(calls).toHaveLength(1);
    expect(userIdIn(calls[0].args)).toBe(USER);
  });

  it("listOpenTasks filters on userId", async () => {
    await listOpenTasks(USER);
    expect(userIdIn(calls[0].args)).toBe(USER);
  });

  it("getTask uses findFirst with userId, never findUnique by id", async () => {
    await getTask(USER, "tsk_1");
    // findUnique can't filter on userId — using it here would return
    // another account's row for a guessed id.
    expect(calls[0].method).toBe("findFirst");
    expect(calls[0].args.where).toMatchObject({ id: "tsk_1", userId: USER });
  });

  it("pointsOnDay filters on userId", async () => {
    const total = await pointsOnDay(USER, "2026-08-15");
    expect(userIdIn(calls[0].args)).toBe(USER);
    expect(total).toBe(7);
  });
});

describe("every write is scoped to the signed-in user", () => {
  it("createTask stamps the owner", async () => {
    await createTask(USER, {
      title: "Write the migration notes",
      timezone: "Asia/Kolkata",
      dayEndsAtHour: 4,
    });
    expect(calls[0].args.data.userId).toBe(USER);
  });

  it("setTaskStatus filters on userId as well as id", async () => {
    await setTaskStatus(USER, "tsk_1", "done");
    const update = calls.find((c) => c.method === "updateMany");
    expect(update?.args.where).toMatchObject({ id: "tsk_1", userId: USER });
  });

  it("deleteTask filters on userId as well as id", async () => {
    await deleteTask(USER, "tsk_1");
    expect(calls[0].method).toBe("deleteMany");
    expect(calls[0].args.where).toMatchObject({ id: "tsk_1", userId: USER });
  });
});

describe("one user's id never reaches another user's query", () => {
  it("passes through exactly the caller's id, not a default", async () => {
    await listOpenTasks(OTHER);
    expect(userIdIn(calls[0].args)).toBe(OTHER);
    expect(userIdIn(calls[0].args)).not.toBe(USER);
  });

  it("scopes every single call the module makes", async () => {
    await listTasksForDay(USER, "2026-08-15");
    await listOpenTasks(USER);
    await getTask(USER, "tsk_1");
    await setTaskStatus(USER, "tsk_1", "done");
    await deleteTask(USER, "tsk_1");
    await pointsOnDay(USER, "2026-08-15");

    expect(calls.length).toBeGreaterThan(5);
    for (const call of calls) {
      expect(
        userIdIn(call.args),
        `${call.model}.${call.method} was not scoped to a user`,
      ).toBe(USER);
    }
  });
});

describe("task completion records when it happened", () => {
  it("sets completedAt when marking done", async () => {
    await setTaskStatus(USER, "tsk_1", "done");
    const update = calls.find((c) => c.method === "updateMany");
    expect(update?.args.data.completedAt).toBeInstanceOf(Date);
  });

  it("clears completedAt when reopening", async () => {
    await setTaskStatus(USER, "tsk_1", "open");
    const update = calls.find((c) => c.method === "updateMany");
    expect(update?.args.data.completedAt).toBeNull();
  });
});

describe("createTask files work under the right day", () => {
  it("uses the day-boundary rule, not the raw date", async () => {
    // 01:30 IST belongs to the previous day when the day ends at 04:00.
    vi.setSystemTime(new Date("2026-08-15T20:00:00Z"));
    await createTask(USER, {
      title: "Late night fix",
      timezone: "Asia/Kolkata",
      dayEndsAtHour: 4,
    });
    const created = calls[0].args.data.createdForDate as Date;
    expect(created.toISOString().slice(0, 10)).toBe("2026-08-15");
    vi.useRealTimers();
  });
});
