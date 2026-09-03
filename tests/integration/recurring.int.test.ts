import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  materialiseRecurring,
  listRoutineInstances,
  listRoutineTemplates,
} from "@/lib/repositories/recurring";
import { setTaskStatus, listTasksForDay } from "@/lib/repositories/tasks";
import { projectRoutines } from "@/lib/projection";
import { makeUser, cleanupAll } from "./harness";

/**
 * A routine is a rule; a day is a row.
 *
 * Ticking one day off must not tick off the rest of the month, and the
 * day must be able to say it was done. Both were true in the database
 * and false on the calendar, because a projected occurrence is keyed by
 * the template it came from while a real row is keyed by itself — so
 * nothing ever matched, no ghost was ever suppressed, and a routine
 * completed this morning was drawn exactly like one nobody had touched.
 */

const DAY = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const asDate = (k: string) => new Date(`${k}T00:00:00.000Z`);

async function dailyRoutine(userId: string, from: string, until: string) {
  return db.task.create({
    data: {
      userId,
      title: "Standup",
      recurrence: "daily",
      points: 10,
      createdForDate: asDate(from),
      recurrenceUntil: asDate(until),
      routineStartMinute: 9 * 60,
      routineMinutes: 30,
    },
    select: { id: true },
  });
}

afterAll(cleanupAll);

describe("completing one day of a routine", () => {
  it("marks that day done and leaves the others alone", async () => {
    const user = await makeUser("rec-one-day");
    const now = new Date();
    const d0 = dayKey(now);
    const d1 = dayKey(new Date(now.getTime() + DAY));
    const template = await dailyRoutine(
      user.id,
      d0,
      dayKey(new Date(now.getTime() + 30 * DAY)),
    );

    await materialiseRecurring(user.id, d0);
    await materialiseRecurring(user.id, d1);

    const today = (await listTasksForDay(user.id, d0)).filter(
      (t) => t.title === "Standup",
    );
    expect(today).toHaveLength(1);
    await setTaskStatus(user.id, today[0].id, "done");

    const rows = await db.task.findMany({
      where: { userId: user.id, recurrenceParentId: template.id },
      select: { createdForDate: true, status: true },
      orderBy: { createdForDate: "asc" },
    });
    expect(rows.map((r) => [dayKey(r.createdForDate), r.status])).toEqual([
      [d0, "done"],
      [d1, "open"],
    ]);
  });

  it("leaves the template itself untouched", async () => {
    const user = await makeUser("rec-template");
    const d0 = dayKey(new Date());
    const template = await dailyRoutine(
      user.id,
      d0,
      dayKey(new Date(Date.now() + 30 * DAY)),
    );

    await materialiseRecurring(user.id, d0);
    const today = (await listTasksForDay(user.id, d0)).filter(
      (t) => t.title === "Standup",
    );
    await setTaskStatus(user.id, today[0].id, "done");

    const after = await db.task.findUnique({
      where: { id: template.id },
      select: { status: true, completedAt: true },
    });
    expect(after?.status).toBe("open");
    expect(after?.completedAt).toBeNull();
  });

  it("never hands the template to a day list", async () => {
    const user = await makeUser("rec-not-listed");
    const d0 = dayKey(new Date());
    const template = await dailyRoutine(
      user.id,
      d0,
      dayKey(new Date(Date.now() + 30 * DAY)),
    );

    await materialiseRecurring(user.id, d0);
    const ids = (await listTasksForDay(user.id, d0)).map((t) => t.id);
    expect(ids).not.toContain(template.id);
  });
});

describe("what the calendar draws for a routine", () => {
  it("stops drawing a ghost once the day has a real row", async () => {
    const user = await makeUser("rec-ghost");
    const now = new Date();
    const d0 = dayKey(now);
    const d1 = dayKey(new Date(now.getTime() + DAY));
    const template = await dailyRoutine(
      user.id,
      d0,
      dayKey(new Date(now.getTime() + 30 * DAY)),
    );

    await materialiseRecurring(user.id, d0);

    const days = [d0, d1];
    const instances = await listRoutineInstances(user.id, days);
    const occupied = new Set(
      instances.map((i) => `${i.templateId}:${i.dayKey}`),
    );
    const ghosts = projectRoutines(
      await listRoutineTemplates(user.id),
      days,
      occupied,
    );

    // Today has a row, so it is drawn from the row. Tomorrow does not.
    expect(ghosts.map((g) => g.dayKey)).toEqual([d1]);
    expect(instances.map((i) => i.dayKey)).toEqual([d0]);
    expect(instances[0].templateId).toBe(template.id);
  });

  it("reports the completed day as done, and only that day", async () => {
    const user = await makeUser("rec-done-state");
    const now = new Date();
    const d0 = dayKey(now);
    const d1 = dayKey(new Date(now.getTime() + DAY));
    await dailyRoutine(user.id, d0, dayKey(new Date(now.getTime() + 30 * DAY)));

    await materialiseRecurring(user.id, d0);
    await materialiseRecurring(user.id, d1);
    const today = (await listTasksForDay(user.id, d0)).filter(
      (t) => t.title === "Standup",
    );
    await setTaskStatus(user.id, today[0].id, "done");

    const instances = await listRoutineInstances(user.id, [d0, d1]);
    const byDay = Object.fromEntries(instances.map((i) => [i.dayKey, i.done]));
    expect(byDay[d0]).toBe(true);
    expect(byDay[d1]).toBe(false);
  });
});

describe("materialising the same day more than once", () => {
  it("produces one row however many times it runs", async () => {
    const user = await makeUser("rec-idempotent");
    const d0 = dayKey(new Date());
    const template = await dailyRoutine(
      user.id,
      d0,
      dayKey(new Date(Date.now() + 30 * DAY)),
    );

    // Concurrently, the way two tabs opening at once would.
    await Promise.all([
      materialiseRecurring(user.id, d0),
      materialiseRecurring(user.id, d0),
      materialiseRecurring(user.id, d0),
    ]);

    const count = await db.task.count({
      where: {
        userId: user.id,
        recurrenceParentId: template.id,
        createdForDate: asDate(d0),
      },
    });
    expect(count).toBe(1);
  });

  it("refuses a second row for the same routine and day", async () => {
    const user = await makeUser("rec-unique");
    const d0 = dayKey(new Date());
    const template = await dailyRoutine(
      user.id,
      d0,
      dayKey(new Date(Date.now() + 30 * DAY)),
    );
    await materialiseRecurring(user.id, d0);

    await expect(
      db.task.create({
        data: {
          userId: user.id,
          title: "Standup",
          recurrence: "none",
          points: 10,
          recurrenceParentId: template.id,
          createdForDate: asDate(d0),
        },
      }),
    ).rejects.toThrow();
  });

  it("still allows many templates, which carry no parent", async () => {
    const user = await makeUser("rec-templates");
    const d0 = dayKey(new Date());
    await dailyRoutine(user.id, d0, dayKey(new Date(Date.now() + 30 * DAY)));
    await dailyRoutine(user.id, d0, dayKey(new Date(Date.now() + 30 * DAY)));

    const templates = await listRoutineTemplates(user.id);
    expect(templates).toHaveLength(2);
  });
});

describe("a routine that has ended", () => {
  it("stops producing rows after its last day", async () => {
    const user = await makeUser("rec-until");
    const now = new Date();
    const yesterday = dayKey(new Date(now.getTime() - DAY));
    const today = dayKey(now);
    await dailyRoutine(user.id, yesterday, yesterday);

    expect(await materialiseRecurring(user.id, today)).toBe(0);
    expect(await listRoutineInstances(user.id, [today])).toHaveLength(0);
  });
});
