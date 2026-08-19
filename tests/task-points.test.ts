import { describe, it, expect } from "vitest";
import { createTaskSchema, rhythmSchema } from "@/lib/validation";
import { computeStreak } from "@/lib/streak";

/**
 * Two rules that used to be one, and shouldn't have been.
 *
 * Before this, a task's worth could not be set at all — the column had a
 * default of 20 and nothing ever wrote anything else, so every task in
 * the database was worth exactly the same. The streak then asked for
 * three of those a day, and pace measured you against dailyFloor × 20,
 * a number that only meant anything while every task really was worth 20.
 *
 * Now: you set the worth, the streak asks only that you turned up, and
 * pace has its own target.
 */

describe("a task's worth is the user's to set", () => {
  const base = { title: "Write the thing", recurrence: "none" as const };

  it("accepts anything across the 1–30 band", () => {
    for (const points of [1, 5, 12, 20, 29, 30]) {
      expect(createTaskSchema.safeParse({ ...base, points }).success).toBe(true);
    }
  });

  it("still defaults to nothing, so the repository picks 20", () => {
    const parsed = createTaskSchema.parse(base);
    expect(parsed.points).toBeUndefined();
  });

  it("refuses a worthless task and refuses one worth more than the top", () => {
    expect(createTaskSchema.safeParse({ ...base, points: 0 }).success).toBe(false);
    expect(createTaskSchema.safeParse({ ...base, points: 31 }).success).toBe(false);
  });

  it("refuses a fractional worth, so the ledger stays in whole points", () => {
    expect(createTaskSchema.safeParse({ ...base, points: 7.5 }).success).toBe(
      false,
    );
  });
});

describe("the streak asks whether you showed up, not how much you did", () => {
  const restDays: number[] = [];

  it("one small thing a day is enough", () => {
    // A week of exactly one action per day — the smallest possible
    // showing up, every day.
    const actionsByDay = Object.fromEntries(
      [
        "2026-08-11",
        "2026-08-12",
        "2026-08-13",
        "2026-08-14",
        "2026-08-15",
        "2026-08-16",
        "2026-08-17",
      ].map((d) => [d, 1]),
    );

    const result = computeStreak({
      today: "2026-08-17",
      actionsByDay,
      dailyFloor: 1,
      restDays,
    });

    expect(result.days).toBe(7);
    expect(result.clearedToday).toBe(true);
    expect(result.atRisk).toBe(false);
  });

  it("would have broken the same week under the old floor of three", () => {
    const actionsByDay = { "2026-08-16": 1, "2026-08-17": 1 };

    expect(
      computeStreak({
        today: "2026-08-17",
        actionsByDay,
        dailyFloor: 3,
        restDays,
      }).days,
    ).toBe(0);

    expect(
      computeStreak({
        today: "2026-08-17",
        actionsByDay,
        dailyFloor: 1,
        restDays,
      }).days,
    ).toBe(2);
  });

  it("a genuinely empty day still ends it — showing up is the one ask", () => {
    const result = computeStreak({
      today: "2026-08-17",
      actionsByDay: { "2026-08-17": 1, "2026-08-16": 0, "2026-08-15": 1 },
      dailyFloor: 1,
      restDays,
    });

    expect(result.days).toBe(1);
  });

  it("today being empty doesn't end it, because the day isn't over", () => {
    const result = computeStreak({
      today: "2026-08-17",
      actionsByDay: { "2026-08-16": 1, "2026-08-15": 1 },
      dailyFloor: 1,
      restDays,
    });

    expect(result.days).toBe(2);
    expect(result.clearedToday).toBe(false);
    expect(result.atRisk).toBe(true);
  });
});

describe("pace has its own target, separate from the streak's floor", () => {
  const base = {
    dailyFloor: "1",
    dailyTargetPoints: "60",
    restDays: ["0", "6"],
    morningReminder: "08:30",
    eveningReminder: "21:00",
    backdateLimitDays: "2",
    rolloverUnfinished: true,
    catchUpRoutines: false,
  };

  it("coerces the posted string to a number", () => {
    expect(rhythmSchema.parse(base).dailyTargetPoints).toBe(60);
  });

  it("can be set far above the floor without touching the streak", () => {
    const parsed = rhythmSchema.parse({ ...base, dailyTargetPoints: "180" });
    expect(parsed.dailyTargetPoints).toBe(180);
    expect(parsed.dailyFloor).toBe(1);
  });

  it("refuses a target of zero, which would make pace divide by nothing", () => {
    expect(
      rhythmSchema.safeParse({ ...base, dailyTargetPoints: "0" }).success,
    ).toBe(false);
  });
});
