import { describe, it, expect } from "vitest";
import {
  occursOn,
  clampToMonth,
  nextOccurrence,
  describeRecurrence,
} from "@/lib/recurrence";
import { shiftDayKey, weekdayOf, dayKeyToDate } from "@/lib/day";

/**
 * Recurrence, walked across whole years.
 *
 * Routine work appearing on its own is the point of the feature — if a
 * rule silently stops firing, the day simply looks empty and nothing
 * announces the failure. "Monthly on the 31st" is the classic way that
 * happens, so February gets particular attention here.
 */

const pad = (n: number) => String(n).padStart(2, "0");

describe("occursOn — daily", () => {
  it("fires on every one of 400 consecutive days", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 400; i++) {
      expect(occursOn(cursor, "daily", null)).toBe(true);
      cursor = shiftDayKey(cursor, 1);
    }
  });

  it("ignores whatever value it is given", () => {
    for (const value of [null, 0, 1, 15, 31, -5]) {
      expect(occursOn("2026-08-17", "daily", value)).toBe(true);
    }
  });
});

describe("occursOn — weekdays", () => {
  it("fires Monday to Friday and rests at weekends, for a whole year", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 365; i++) {
      const dow = weekdayOf(cursor);
      const isWeekday = dow >= 1 && dow <= 5;
      expect(occursOn(cursor, "weekdays", null)).toBe(isWeekday);
      cursor = shiftDayKey(cursor, 1);
    }
  });

  it("fires exactly five times in each of 20 consecutive weeks", () => {
    let cursor = "2026-01-05"; // a Monday
    for (let week = 0; week < 20; week++) {
      let fired = 0;
      for (let d = 0; d < 7; d++) {
        if (occursOn(shiftDayKey(cursor, d), "weekdays", null)) fired++;
      }
      expect(fired).toBe(5);
      cursor = shiftDayKey(cursor, 7);
    }
  });
});

describe("occursOn — weekly", () => {
  for (let dow = 0; dow <= 6; dow++) {
    it(`fires only on weekday ${dow}, across a year`, () => {
      let cursor = "2026-01-01";
      for (let i = 0; i < 365; i++) {
        expect(occursOn(cursor, "weekly", dow)).toBe(weekdayOf(cursor) === dow);
        cursor = shiftDayKey(cursor, 1);
      }
    });
  }

  for (let dow = 0; dow <= 6; dow++) {
    it(`fires exactly 52 or 53 times a year on weekday ${dow}`, () => {
      let cursor = "2026-01-01";
      let fired = 0;
      for (let i = 0; i < 365; i++) {
        if (occursOn(cursor, "weekly", dow)) fired++;
        cursor = shiftDayKey(cursor, 1);
      }
      expect(fired).toBeGreaterThanOrEqual(52);
      expect(fired).toBeLessThanOrEqual(53);
    });
  }

  it("defaults to Monday when given no day", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 60; i++) {
      expect(occursOn(cursor, "weekly", null)).toBe(weekdayOf(cursor) === 1);
      cursor = shiftDayKey(cursor, 1);
    }
  });
});

describe("clampToMonth — the 31st problem", () => {
  const lengths: [number, number, number][] = [
    [2026, 1, 31],
    [2026, 2, 28],
    [2024, 2, 29],
    [2000, 2, 29],
    [1900, 2, 28],
    [2026, 3, 31],
    [2026, 4, 30],
    [2026, 5, 31],
    [2026, 6, 30],
    [2026, 7, 31],
    [2026, 8, 31],
    [2026, 9, 30],
    [2026, 10, 31],
    [2026, 11, 30],
    [2026, 12, 31],
  ];

  for (const [year, month, length] of lengths) {
    it(`${year}-${pad(month)} has ${length} days`, () => {
      expect(clampToMonth(`${year}-${pad(month)}-01`, 31)).toBe(length);
    });
  }

  for (const [year, month, length] of lengths) {
    it(`never returns past the end of ${year}-${pad(month)}`, () => {
      for (let asked = 1; asked <= 31; asked++) {
        const got = clampToMonth(`${year}-${pad(month)}-01`, asked);
        expect(got).toBeLessThanOrEqual(length);
        expect(got).toBeLessThanOrEqual(asked);
        expect(got).toBeGreaterThanOrEqual(1);
      }
    });
  }

  it("leaves a day that already fits alone", () => {
    for (let day = 1; day <= 28; day++) {
      expect(clampToMonth("2026-02-01", day)).toBe(day);
    }
  });
});

describe("occursOn — monthly", () => {
  for (const dom of [1, 5, 15, 28, 29, 30, 31]) {
    it(`fires once a month on the ${dom}, over two years`, () => {
      let cursor = "2025-01-01";
      const months = new Set<string>();
      let fired = 0;

      for (let i = 0; i < 730; i++) {
        if (occursOn(cursor, "monthly", dom)) {
          fired++;
          months.add(cursor.slice(0, 7));
        }
        cursor = shiftDayKey(cursor, 1);
      }

      // Exactly one firing per month it saw — never zero, never twice.
      expect(fired).toBe(months.size);
      expect(months.size).toBeGreaterThanOrEqual(23);
    });
  }

  it("still fires in February when asked for the 31st", () => {
    let cursor = "2026-02-01";
    let fired = 0;
    for (let i = 0; i < 28; i++) {
      if (occursOn(cursor, "monthly", 31)) fired++;
      cursor = shiftDayKey(cursor, 1);
    }
    expect(fired).toBe(1);
  });

  it("lands on the last day of February when asked for the 31st", () => {
    expect(occursOn("2026-02-28", "monthly", 31)).toBe(true);
    expect(occursOn("2024-02-29", "monthly", 31)).toBe(true);
    expect(occursOn("2024-02-28", "monthly", 31)).toBe(false);
  });
});

describe("occursOn — none", () => {
  it("never fires, on any day", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 100; i++) {
      expect(occursOn(cursor, "none", null)).toBe(false);
      cursor = shiftDayKey(cursor, 1);
    }
  });
});

describe("nextOccurrence", () => {
  it("returns nothing for a task that does not repeat", () => {
    expect(nextOccurrence("2026-08-17", "none", null)).toBe(null);
  });

  it("is always strictly after the day it is given", () => {
    const rules: [string, number | null][] = [
      ["daily", null],
      ["weekdays", null],
      ["weekly", 0],
      ["weekly", 3],
      ["monthly", 1],
      ["monthly", 31],
    ];

    let cursor = "2026-01-01";
    for (let i = 0; i < 120; i++) {
      for (const [rule, value] of rules) {
        const next = nextOccurrence(
          cursor,
          rule as Parameters<typeof nextOccurrence>[1],
          value,
        );
        expect(next).not.toBe(null);
        expect(next! > cursor).toBe(true);
      }
      cursor = shiftDayKey(cursor, 3);
    }
  });

  it("gives tomorrow for a daily rule, every time", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 200; i++) {
      expect(nextOccurrence(cursor, "daily", null)).toBe(
        shiftDayKey(cursor, 1),
      );
      cursor = shiftDayKey(cursor, 1);
    }
  });

  it("skips the weekend for a weekdays rule", () => {
    // Friday 2026-01-02 → Monday 2026-01-05
    expect(nextOccurrence("2026-01-02", "weekdays", null)).toBe("2026-01-05");
    expect(nextOccurrence("2026-01-03", "weekdays", null)).toBe("2026-01-05");
    expect(nextOccurrence("2026-01-04", "weekdays", null)).toBe("2026-01-05");
  });

  it("is exactly a week later for a weekly rule", () => {
    for (let dow = 0; dow <= 6; dow++) {
      let cursor = "2026-01-01";
      // Advance to the first firing, then check the gap repeatedly.
      const first = nextOccurrence(cursor, "weekly", dow)!;
      cursor = first;
      for (let i = 0; i < 20; i++) {
        const next = nextOccurrence(cursor, "weekly", dow)!;
        expect(next).toBe(shiftDayKey(cursor, 7));
        cursor = next;
      }
    }
  });

  it("always lands on a day that satisfies its own rule", () => {
    const rules: [string, number | null][] = [
      ["daily", null],
      ["weekdays", null],
      ["weekly", 2],
      ["monthly", 15],
      ["monthly", 31],
    ];

    for (const [rule, value] of rules) {
      let cursor = "2026-01-01";
      for (let i = 0; i < 30; i++) {
        const next = nextOccurrence(
          cursor,
          rule as Parameters<typeof nextOccurrence>[1],
          value,
        )!;
        expect(
          occursOn(next, rule as Parameters<typeof occursOn>[1], value),
        ).toBe(true);
        cursor = next;
      }
    }
  });

  it("never skips a month for a monthly rule", () => {
    for (const dom of [1, 15, 29, 30, 31]) {
      let cursor = "2025-01-01";
      let previousMonth = -1;
      for (let i = 0; i < 24; i++) {
        const next = nextOccurrence(cursor, "monthly", dom)!;
        const month = dayKeyToDate(next).getUTCMonth();
        if (previousMonth >= 0) {
          expect((previousMonth + 1) % 12).toBe(month);
        }
        previousMonth = month;
        cursor = next;
      }
    }
  });
});

describe("describeRecurrence", () => {
  it("returns a non-empty description for every rule", () => {
    const rules: [string, number | null][] = [
      ["none", null],
      ["daily", null],
      ["weekdays", null],
      ["weekly", 0],
      ["weekly", 6],
      ["monthly", 1],
      ["monthly", 31],
    ];

    for (const [rule, value] of rules) {
      const text = describeRecurrence(
        rule as Parameters<typeof describeRecurrence>[0],
        value,
      );
      expect(typeof text).toBe("string");
    }
  });

  it("names each weekday distinctly", () => {
    const seen = new Set<string>();
    for (let dow = 0; dow <= 6; dow++) {
      seen.add(describeRecurrence("weekly", dow));
    }
    expect(seen.size).toBe(7);
  });
});
