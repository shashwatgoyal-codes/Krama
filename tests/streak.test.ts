import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/streak";
import { weekdayOf, shiftDayKey } from "@/lib/day";

// 2026-08-15 is a Saturday, so the week walking backwards is
// Sat 15, Fri 14, Thu 13, Wed 12, Tue 11, Mon 10, Sun 09.
const TODAY = "2026-08-15";
const NO_REST: number[] = [];
const WEEKEND = [0, 6];

/** Builds a day-key → actions map from days-ago offsets. */
function history(byDaysAgo: Record<number, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [ago, count] of Object.entries(byDaysAgo)) {
    out[shiftDayKey(TODAY, -Number(ago))] = count;
  }
  return out;
}

function streak(
  byDaysAgo: Record<number, number>,
  restDays = NO_REST,
  dailyFloor = 3,
) {
  return computeStreak({
    today: TODAY,
    actionsByDay: history(byDaysAgo),
    dailyFloor,
    restDays,
  });
}

describe("the calendar assumption these tests rest on", () => {
  it("has 2026-08-15 as a Saturday", () => {
    expect(weekdayOf(TODAY)).toBe(6);
    expect(weekdayOf(shiftDayKey(TODAY, -6))).toBe(0); // Sunday
  });
});

describe("computeStreak", () => {
  it("is zero with no history at all", () => {
    expect(streak({}).days).toBe(0);
  });

  it("counts today once the floor is cleared", () => {
    const r = streak({ 0: 3 });
    expect(r.days).toBe(1);
    expect(r.clearedToday).toBe(true);
  });

  it("does not count a day that falls short of the floor", () => {
    expect(streak({ 0: 2 }).days).toBe(0);
  });

  it("counts a run of consecutive days", () => {
    expect(streak({ 0: 3, 1: 5, 2: 3, 3: 4 }).days).toBe(4);
  });

  it("stops at the first missed day", () => {
    // Three days ago was missed, so days four and five are not part of
    // this streak however good they were.
    expect(streak({ 0: 3, 1: 3, 2: 3, 3: 0, 4: 9, 5: 9 }).days).toBe(3);
  });

  it("stops at a day that fell short, not just an empty one", () => {
    expect(streak({ 0: 3, 1: 3, 2: 2, 3: 5 }).days).toBe(3 - 1);
  });
});

describe("an unfinished today", () => {
  it("does not break a live streak just because today isn't done", () => {
    // The single most annoying way to get this wrong: opening the app in
    // the morning and being told your streak is gone.
    const r = streak({ 1: 3, 2: 3, 3: 3 });
    expect(r.days).toBe(3);
    expect(r.clearedToday).toBe(false);
  });

  it("flags that today is still outstanding", () => {
    expect(streak({ 1: 3, 2: 3 }).atRisk).toBe(true);
  });

  it("is not at risk once today is cleared", () => {
    expect(streak({ 0: 3, 1: 3 }).atRisk).toBe(false);
  });

  it("is not at risk when there is no streak to lose", () => {
    expect(streak({}).atRisk).toBe(false);
  });

  it("is not at risk when today is a rest day", () => {
    // Today is Saturday; nothing is owed.
    expect(streak({ 1: 3, 2: 3 }, WEEKEND).atRisk).toBe(false);
  });
});

describe("rest days", () => {
  it("skips a rest day without counting or breaking it", () => {
    // Fri and Thu worked, Sat (today) and Sun off. The streak is the two
    // days actually worked.
    const r = streak({ 1: 3, 2: 3 }, WEEKEND);
    expect(r.days).toBe(2);
  });

  it("bridges a weekend rather than ending at it", () => {
    // Worked Mon–Fri, took Sat and Sun off, worked the Friday before.
    const r = streak({ 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 0, 7: 3 }, WEEKEND);
    // Fri 14 … Mon 10 is five days, Sun 09 skipped, Sat 08 skipped,
    // then Fri 07 adds one more.
    expect(r.days).toBe(6);
  });

  it("counts a rest day you worked anyway", () => {
    // Working on your day off must never be worth less than resting.
    const worked = streak({ 0: 3, 1: 3 }, WEEKEND);
    const rested = streak({ 1: 3 }, WEEKEND);
    expect(worked.days).toBe(2);
    expect(rested.days).toBe(1);
    expect(worked.days).toBeGreaterThan(rested.days);
  });

  it("still breaks on a working day that was missed", () => {
    // Sat and Sun are off, but Friday was simply missed.
    expect(streak({ 1: 0, 2: 3, 3: 3 }, WEEKEND).days).toBe(0);
  });
});

describe("the daily floor", () => {
  it("respects a higher floor", () => {
    expect(streak({ 0: 4, 1: 4 }, NO_REST, 5).days).toBe(0);
    expect(streak({ 0: 5, 1: 5 }, NO_REST, 5).days).toBe(2);
  });

  it("treats a floor of one as one action", () => {
    expect(streak({ 0: 1, 1: 1 }, NO_REST, 1).days).toBe(2);
  });

  it("refuses a floor of zero rather than reporting a fake streak", () => {
    // With a floor of zero every day in history clears it, including
    // days that never happened, and the walk runs to the lookback limit.
    const r = computeStreak({
      today: TODAY,
      actionsByDay: {},
      dailyFloor: 0,
      restDays: NO_REST,
    });
    expect(r.days).toBe(0);
  });

  it("is not fooled by a negative action count", () => {
    expect(streak({ 0: -5 }).days).toBe(0);
  });
});

describe("bounds", () => {
  it("never walks past the lookback limit", () => {
    // Every day cleared, forever. The answer must still terminate.
    const everyDay: Record<string, number> = {};
    for (let i = 0; i <= 900; i++) everyDay[shiftDayKey(TODAY, -i)] = 10;

    const r = computeStreak({
      today: TODAY,
      actionsByDay: everyDay,
      dailyFloor: 3,
      restDays: NO_REST,
      maxLookback: 30,
    });
    expect(r.days).toBe(31);
  });

  it("terminates when every recent day is a rest day with no work", () => {
    const r = computeStreak({
      today: TODAY,
      actionsByDay: {},
      dailyFloor: 3,
      restDays: [0, 1, 2, 3, 4, 5, 6],
      maxLookback: 10,
    });
    expect(r.days).toBe(0);
  });
});
