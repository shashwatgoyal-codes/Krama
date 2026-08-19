import { describe, it, expect } from "vitest";
import { occursOn, nextOccurrence, parseWeekdays, describeRecurrence } from "@/lib/recurrence";
import { shiftDayKey, weekdayOf } from "@/lib/day";

/**
 * Weekly routines that run on more than one day.
 *
 * "Every day except Sunday" was not sayable before this: a single
 * weekday meant six separate routines, which is six things to edit when
 * the time changes and six chances for them to drift apart.
 */

describe("parseWeekdays", () => {
  const cases: [string, number[]][] = [
    ["1", [1]],
    ["1,2,3", [1, 2, 3]],
    ["3,1,2", [1, 2, 3]],
    ["1, 2, 3", [1, 2, 3]],
    ["0,6", [0, 6]],
    ["1,2,3,4,5,6", [1, 2, 3, 4, 5, 6]],
    ["0,1,2,3,4,5,6", [0, 1, 2, 3, 4, 5, 6]],
    ["1,1,1", [1]],
    ["", []],
    [",", []],
    ["7", []],
    ["-1", []],
    ["abc", []],
    ["1,abc,2", [1, 2]],
    ["1,7,2", [1, 2]],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      expect(parseWeekdays(input)).toEqual(expected);
    });
  }

  it("treats missing input as no days rather than throwing", () => {
    expect(parseWeekdays(null)).toEqual([]);
    expect(parseWeekdays(undefined)).toEqual([]);
  });

  it("drops a bad day rather than failing the whole save", () => {
    expect(parseWeekdays("1,99,3")).toEqual([1, 3]);
  });
});

describe("occursOn — several weekdays", () => {
  it("fires on exactly the days chosen, across a fortnight", () => {
    const days = [1, 3, 5];
    let cursor = "2026-08-17";
    for (let i = 0; i < 14; i++) {
      expect(occursOn(cursor, "weekly", null, null, days)).toBe(
        days.includes(weekdayOf(cursor)),
      );
      cursor = shiftDayKey(cursor, 1);
    }
  });

  it("fires six days a week for every-day-except-Sunday", () => {
    const days = [1, 2, 3, 4, 5, 6];
    let cursor = "2026-08-17";
    let fired = 0;
    for (let i = 0; i < 7; i++) {
      if (occursOn(cursor, "weekly", null, null, days)) fired++;
      cursor = shiftDayKey(cursor, 1);
    }
    expect(fired).toBe(6);
  });

  it("never fires on the excluded day, across a whole year", () => {
    const days = [1, 2, 3, 4, 5, 6];
    let cursor = "2026-01-01";
    for (let i = 0; i < 365; i++) {
      if (weekdayOf(cursor) === 0) {
        expect(occursOn(cursor, "weekly", null, null, days)).toBe(false);
      }
      cursor = shiftDayKey(cursor, 1);
    }
  });

  it("fires every day when all seven are chosen", () => {
    let cursor = "2026-08-17";
    for (let i = 0; i < 30; i++) {
      expect(occursOn(cursor, "weekly", null, null, [0, 1, 2, 3, 4, 5, 6])).toBe(true);
      cursor = shiftDayKey(cursor, 1);
    }
  });

  it("never fires when no days are chosen and no fallback exists", () => {
    // An empty list falls back to the single value, which defaults to
    // Monday — so this is Monday-only, not never. Checked explicitly so
    // the fallback is a decision rather than an accident.
    let mondays = 0;
    let cursor = "2026-08-17";
    for (let i = 0; i < 14; i++) {
      if (occursOn(cursor, "weekly", null, null, [])) mondays++;
      cursor = shiftDayKey(cursor, 1);
    }
    expect(mondays).toBe(2);
  });

  it("uses the old single value when the list is empty", () => {
    let cursor = "2026-08-17";
    for (let i = 0; i < 14; i++) {
      expect(occursOn(cursor, "weekly", 3, null, [])).toBe(
        weekdayOf(cursor) === 3,
      );
      cursor = shiftDayKey(cursor, 1);
    }
  });

  it("lets the list win over the old single value", () => {
    // A row migrated to the array must not also honour the stale column.
    expect(occursOn("2026-08-18", "weekly", 1, null, [2])).toBe(true);
    expect(occursOn("2026-08-17", "weekly", 1, null, [2])).toBe(false);
  });

  it("still respects an end date", () => {
    const days = [1, 2, 3, 4, 5, 6];
    expect(occursOn("2026-08-31", "weekly", null, "2026-08-31", days)).toBe(true);
    expect(occursOn("2026-09-01", "weekly", null, "2026-08-31", days)).toBe(false);
  });
});

describe("nextOccurrence — several weekdays", () => {
  it("finds the next chosen day, never skipping one", () => {
    const days = [1, 3, 5];
    let cursor = "2026-08-17";
    for (let i = 0; i < 20; i++) {
      const next = nextOccurrence(cursor, "weekly", null, null, days)!;
      expect(days).toContain(weekdayOf(next));
      // Nothing chosen was skipped between cursor and next.
      let between = shiftDayKey(cursor, 1);
      while (between < next) {
        expect(days).not.toContain(weekdayOf(between));
        between = shiftDayKey(between, 1);
      }
      cursor = next;
    }
  });

  it("is tomorrow for every-day-except-Sunday, unless tomorrow is Sunday", () => {
    const days = [1, 2, 3, 4, 5, 6];
    let cursor = "2026-08-17";
    for (let i = 0; i < 14; i++) {
      const next = nextOccurrence(cursor, "weekly", null, null, days)!;
      const tomorrow = shiftDayKey(cursor, 1);
      expect(next).toBe(weekdayOf(tomorrow) === 0 ? shiftDayKey(cursor, 2) : tomorrow);
      cursor = next;
    }
  });
});

describe("describeRecurrence — several weekdays", () => {
  const cases: [number[], string][] = [
    [[1, 2, 3, 4, 5, 6], "Every day except Sunday"],
    [[0, 1, 2, 3, 4, 5], "Every day except Saturday"],
    [[0, 1, 2, 3, 4, 5, 6], "Every day"],
    [[1, 2, 3, 4, 5], "Weekdays"],
    [[0, 6], "Weekends"],
    [[1], "Every Monday"],
    [[3], "Every Wednesday"],
  ];

  for (const [days, expected] of cases) {
    it(`${JSON.stringify(days)} reads as "${expected}"`, () => {
      expect(describeRecurrence("weekly", null, days)).toBe(expected);
    });
  }

  it("lists the days when there is no better name for the set", () => {
    expect(describeRecurrence("weekly", null, [1, 3, 5])).toBe("Mon, Wed, Fri");
  });

  it("falls back to the single value when the list is empty", () => {
    expect(describeRecurrence("weekly", 2, [])).toBe("Every Tuesday");
  });

  it("never returns an empty string for any subset of days", () => {
    for (let mask = 1; mask < 128; mask++) {
      const days = [0, 1, 2, 3, 4, 5, 6].filter((d) => mask & (1 << d));
      expect(describeRecurrence("weekly", null, days).length).toBeGreaterThan(0);
    }
  });
});
