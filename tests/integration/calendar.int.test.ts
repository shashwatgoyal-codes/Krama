import { describe, it, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { deleteTask } from "@/lib/repositories/tasks";
import { listRoutineTemplates } from "@/lib/repositories/recurring";
import { projectRoutines } from "@/lib/projection";
import { listBlocksBetween } from "@/lib/repositories/events";
import { makeUser, cleanup, dayDate, DAY, type TestUser } from "./harness";

/**
 * What the calendar draws, after things are deleted.
 *
 * Reported from use: "I deleted every task, the calendar still shows
 * everything." The data was gone, so the question is whether anything
 * the calendar reads still returns rows once the tasks behind them are
 * removed — a routine template, a projection, or a block left behind.
 */

let user: TestUser | null = null;
afterEach(async () => {
  await cleanup(user);
  user = null;
});

const week = [
  DAY.monday,
  DAY.tuesday,
  DAY.wednesday,
  "2026-08-20",
  "2026-08-21",
  "2026-08-22",
  DAY.sunday,
];

async function makeRoutine(userId: string, title = "Gym") {
  return db.task.create({
    data: {
      userId,
      title,
      points: 30,
      recurrence: "weekly",
      recurrenceDays: [1, 2, 3, 4, 5, 6],
      routineStartMinute: 8 * 60,
      routineMinutes: 90,
      createdForDate: dayDate(DAY.monday),
    },
    select: { id: true },
  });
}

describe("deleting a routine clears it from the calendar", () => {
  it("draws it while it exists", async () => {
    user = await makeUser("cal-before");
    await makeRoutine(user.id);
    const drawn = projectRoutines(await listRoutineTemplates(user.id), week);
    expect(drawn.length).toBe(6);
  });

  it("draws nothing once the routine is deleted", async () => {
    user = await makeUser("cal-after");
    const routine = await makeRoutine(user.id);

    await deleteTask(user.id, routine.id);

    const drawn = projectRoutines(await listRoutineTemplates(user.id), week);
    expect(drawn).toEqual([]);
  });

  it("takes the routine's instances with it", async () => {
    user = await makeUser("cal-instances");
    const routine = await makeRoutine(user.id);
    await db.task.create({
      data: {
        userId: user.id,
        title: "Gym",
        points: 30,
        recurrence: "weekly",
        recurrenceParentId: routine.id,
        createdForDate: dayDate(DAY.tuesday),
      },
    });

    const result = await deleteTask(user.id, routine.id);
    expect(result.instances).toBe(1);
    expect(await db.task.count({ where: { userId: user.id } })).toBe(0);
  });

  it("removes the calendar block a task was scheduled into", async () => {
    // Events cascade on task delete. A block for a task that no longer
    // exists is an appointment with nothing.
    user = await makeUser("cal-block");
    const task = await db.task.create({
      data: {
        userId: user.id,
        title: "Scheduled thing",
        points: 20,
        createdForDate: dayDate(DAY.monday),
      },
      select: { id: true },
    });
    await db.event.create({
      data: {
        userId: user.id,
        taskId: task.id,
        title: "Scheduled thing",
        startsAt: new Date("2026-08-17T09:00:00Z"),
        endsAt: new Date("2026-08-17T10:00:00Z"),
      },
    });

    await deleteTask(user.id, task.id);

    const blocks = await listBlocksBetween(
      user.id,
      new Date("2026-08-17T00:00:00Z"),
      new Date("2026-08-24T00:00:00Z"),
    );
    expect(blocks).toEqual([]);
  });

  it("leaves an empty calendar when every task is gone", async () => {
    user = await makeUser("cal-empty");
    const a = await makeRoutine(user.id, "One");
    const b = await makeRoutine(user.id, "Two");
    await deleteTask(user.id, a.id);
    await deleteTask(user.id, b.id);

    expect(await listRoutineTemplates(user.id)).toEqual([]);
    expect(projectRoutines(await listRoutineTemplates(user.id), week)).toEqual(
      [],
    );
    expect(
      await listBlocksBetween(
        user.id,
        new Date("2026-08-17T00:00:00Z"),
        new Date("2026-08-24T00:00:00Z"),
      ),
    ).toEqual([]);
  });

  it("does not draw another account's routines", async () => {
    user = await makeUser("cal-mine");
    const other = await makeUser("cal-theirs");
    try {
      await makeRoutine(other.id);
      expect(projectRoutines(await listRoutineTemplates(user.id), week)).toEqual(
        [],
      );
    } finally {
      await cleanup(other);
    }
  });
});
