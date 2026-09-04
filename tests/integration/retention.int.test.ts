import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { sweep, sweepPreview } from "@/lib/repositories/retention";
import { RETENTION } from "@/lib/retention";
import { makeUser, cleanupAll } from "./harness";

/**
 * The sweep must take noise and leave history.
 *
 * The one thing that makes any of this safe is that point_ledger holds no
 * foreign key to tasks — so a removed task takes the plan and leaves the
 * record of having done it. That is checked here rather than assumed,
 * because if it were ever untrue this feature would quietly delete
 * somebody's score.
 */

const DAY = 86_400_000;
const NOW = new Date();
const ago = (days: number) => new Date(NOW.getTime() - days * DAY);
afterAll(cleanupAll);

async function routineDay(
  userId: string,
  status: "dropped" | "done",
  days: number,
) {
  const template = await db.task.create({
    data: {
      userId,
      title: "Standup",
      recurrence: "daily",
      points: 15,
      createdForDate: ago(days + 1),
    },
    select: { id: true },
  });
  return db.task.create({
    data: {
      userId,
      title: "Standup",
      recurrence: "none",
      points: 15,
      status,
      recurrenceParentId: template.id,
      createdForDate: ago(days),
      completedAt: status === "done" ? ago(days) : null,
    },
    select: { id: true },
  });
}

describe("skipped routine days", () => {
  it("removes ones past the window and keeps recent ones", async () => {
    const user = await makeUser("ret-dropped");
    const old = await routineDay(
      user.id,
      "dropped",
      RETENTION.droppedRoutineDays + 5,
    );
    const recent = await routineDay(user.id, "dropped", 2);

    const result = await sweep(user.id, 0, NOW);
    expect(result.droppedRoutines).toBe(1);

    const left = await db.task.findMany({
      where: { id: { in: [old.id, recent.id] } },
      select: { id: true },
    });
    expect(left.map((t) => t.id)).toEqual([recent.id]);
  });

  it("never removes a routine day that was actually done", async () => {
    const user = await makeUser("ret-done-routine");
    const done = await routineDay(
      user.id,
      "done",
      RETENTION.droppedRoutineDays + 50,
    );

    await sweep(user.id, 0, NOW);
    expect(await db.task.count({ where: { id: done.id } })).toBe(1);
  });
});

describe("finished tasks", () => {
  it("keeps them all when the setting says forever", async () => {
    const user = await makeUser("ret-forever");
    await db.task.create({
      data: {
        userId: user.id,
        title: "Ancient",
        status: "done",
        points: 25,
        createdForDate: ago(900),
        completedAt: ago(900),
      },
    });

    const result = await sweep(user.id, 0, NOW);
    expect(result.finishedTasks).toBe(0);
    expect(await db.task.count({ where: { userId: user.id } })).toBe(1);
  });

  it("removes only those past a chosen limit", async () => {
    const user = await makeUser("ret-limit");
    const old = await db.task.create({
      data: {
        userId: user.id,
        title: "Old",
        status: "done",
        points: 25,
        createdForDate: ago(200),
        completedAt: ago(200),
      },
      select: { id: true },
    });
    const recent = await db.task.create({
      data: {
        userId: user.id,
        title: "Recent",
        status: "done",
        points: 25,
        createdForDate: ago(10),
        completedAt: ago(10),
      },
      select: { id: true },
    });
    const open = await db.task.create({
      data: {
        userId: user.id,
        title: "Still open",
        status: "open",
        points: 25,
        createdForDate: ago(300),
      },
      select: { id: true },
    });

    const result = await sweep(user.id, 90, NOW);
    expect(result.finishedTasks).toBe(1);

    const left = await db.task.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    expect(new Set(left.map((t) => t.id))).toEqual(
      new Set([recent.id, open.id]),
    );
    expect(left.map((t) => t.id)).not.toContain(old.id);
  });

  it("never removes a routine's template, even one that was ticked off", async () => {
    const user = await makeUser("ret-template");
    const template = await db.task.create({
      data: {
        userId: user.id,
        title: "Weekly review",
        recurrence: "weekly",
        status: "done",
        points: 20,
        createdForDate: ago(400),
        completedAt: ago(400),
      },
      select: { id: true },
    });

    await sweep(user.id, 90, NOW);
    expect(await db.task.count({ where: { id: template.id } })).toBe(1);
  });
});

describe("points", () => {
  it("survive the task they came from being swept away", async () => {
    const user = await makeUser("ret-points");
    const task = await db.task.create({
      data: {
        userId: user.id,
        title: "Long done",
        status: "done",
        points: 25,
        createdForDate: ago(400),
        completedAt: ago(400),
      },
      select: { id: true },
    });
    await db.pointEntry.create({
      data: {
        userId: user.id,
        sourceType: "task",
        sourceId: task.id,
        points: 25,
        countedFor: ago(400),
      },
    });

    const before = await db.pointEntry.count({ where: { userId: user.id } });
    await sweep(user.id, 90, NOW);

    expect(await db.task.count({ where: { id: task.id } })).toBe(0);
    expect(await db.pointEntry.count({ where: { userId: user.id } })).toBe(
      before,
    );
  });
});

describe("expired sessions", () => {
  it("go once they are past the window, live ones stay", async () => {
    const user = await makeUser("ret-sessions");
    const stale = await db.session.create({
      data: {
        userId: user.id,
        tokenHash: `stale-${user.id}`,
        expiresAt: ago(RETENTION.expiredSessionDays + 3),
      },
      select: { id: true },
    });
    const live = await db.session.create({
      data: {
        userId: user.id,
        tokenHash: `live-${user.id}`,
        expiresAt: new Date(NOW.getTime() + 30 * DAY),
      },
      select: { id: true },
    });

    const result = await sweep(user.id, 0, NOW);
    expect(result.expiredSessions).toBe(1);

    const left = await db.session.findMany({
      where: { userId: user.id },
      select: { id: true },
    });
    expect(left.map((s) => s.id)).toEqual([live.id]);
    expect(stale.id).not.toBe(live.id);
  });
});

describe("what a sweep would do", () => {
  it("counts the same rows the sweep then removes", async () => {
    const user = await makeUser("ret-preview");
    await routineDay(user.id, "dropped", RETENTION.droppedRoutineDays + 5);
    await db.task.create({
      data: {
        userId: user.id,
        title: "Old",
        status: "done",
        points: 25,
        createdForDate: ago(200),
        completedAt: ago(200),
      },
    });

    const preview = await sweepPreview(user.id, 90, NOW);
    const result = await sweep(user.id, 90, NOW);

    expect(preview.droppedRoutines).toBe(result.droppedRoutines);
    expect(preview.finishedTasks).toBe(result.finishedTasks);
  });

  it("promises nothing when the setting says forever", async () => {
    const user = await makeUser("ret-preview-forever");
    await db.task.create({
      data: {
        userId: user.id,
        title: "Old",
        status: "done",
        points: 25,
        createdForDate: ago(900),
        completedAt: ago(900),
      },
    });
    expect((await sweepPreview(user.id, 0, NOW)).finishedTasks).toBe(0);
  });
});

describe("one account's sweep", () => {
  it("never reaches another account's rows", async () => {
    const mine = await makeUser("ret-mine");
    const other = await makeUser("ret-other");
    const theirs = await db.task.create({
      data: {
        userId: other.id,
        title: "Theirs",
        status: "done",
        points: 25,
        createdForDate: ago(900),
        completedAt: ago(900),
      },
      select: { id: true },
    });

    await sweep(mine.id, 90, NOW);
    expect(await db.task.count({ where: { id: theirs.id } })).toBe(1);
  });
});
