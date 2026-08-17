import { describe, it, expect } from "vitest";
import {
  dayKeyFor,
  dayKeyToDate,
  daysBetween,
  weekdayOf,
  shiftDayKey,
  isBackdated,
} from "@/lib/day";

/**
 * Day arithmetic, walked rather than sampled.
 *
 * Dates are where off-by-one bugs live, and they hide at the seams:
 * month ends, leap days, year boundaries, and the hour the day is
 * declared to roll over. Sampling a few dates finds none of them, so
 * this walks whole ranges and checks invariants that must hold at every
 * step rather than asserting one answer at a time.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const key = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

describe("shiftDayKey — walking a full year one day at a time", () => {
  it("takes 365 steps to cross a common year", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 365; i++) cursor = shiftDayKey(cursor, 1);
    expect(cursor).toBe("2027-01-01");
  });

  it("takes 366 steps to cross a leap year", () => {
    let cursor = "2024-01-01";
    for (let i = 0; i < 366; i++) cursor = shiftDayKey(cursor, 1);
    expect(cursor).toBe("2025-01-01");
  });

  it("never produces a malformed key across 800 consecutive days", () => {
    let cursor = "2025-06-15";
    for (let i = 0; i < 800; i++) {
      cursor = shiftDayKey(cursor, 1);
      expect(cursor).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("is reversible at every step of a long walk", () => {
    let cursor = "2026-03-01";
    for (let i = 0; i < 400; i++) {
      const forward = shiftDayKey(cursor, 1);
      expect(shiftDayKey(forward, -1)).toBe(cursor);
      cursor = forward;
    }
  });
});

describe("shiftDayKey — month ends", () => {
  const monthEnds: [string, string][] = [
    ["2026-01-31", "2026-02-01"],
    ["2026-02-28", "2026-03-01"],
    ["2024-02-28", "2024-02-29"],
    ["2024-02-29", "2024-03-01"],
    ["2000-02-28", "2000-02-29"],
    ["1900-02-28", "1900-03-01"],
    ["2026-03-31", "2026-04-01"],
    ["2026-04-30", "2026-05-01"],
    ["2026-05-31", "2026-06-01"],
    ["2026-06-30", "2026-07-01"],
    ["2026-07-31", "2026-08-01"],
    ["2026-08-31", "2026-09-01"],
    ["2026-09-30", "2026-10-01"],
    ["2026-10-31", "2026-11-01"],
    ["2026-11-30", "2026-12-01"],
    ["2026-12-31", "2027-01-01"],
  ];

  for (const [from, to] of monthEnds) {
    it(`${from} + 1 = ${to}`, () => {
      expect(shiftDayKey(from, 1)).toBe(to);
    });
    it(`${to} - 1 = ${from}`, () => {
      expect(shiftDayKey(to, -1)).toBe(from);
    });
  }
});

describe("shiftDayKey — leap years across four centuries", () => {
  // 2000 is a leap year (divisible by 400); 1900 and 2100 are not.
  const leap = [2000, 2004, 2008, 2012, 2016, 2020, 2024, 2028, 2032, 2036];
  const common = [1900, 2001, 2002, 2003, 2005, 2100, 2200, 2300, 2018, 2026];

  for (const year of leap) {
    it(`${year} has a 29 February`, () => {
      expect(shiftDayKey(key(year, 2, 28), 1)).toBe(key(year, 2, 29));
    });
  }

  for (const year of common) {
    it(`${year} has no 29 February`, () => {
      expect(shiftDayKey(key(year, 2, 28), 1)).toBe(key(year, 3, 1));
    });
  }
});

describe("shiftDayKey — arbitrary offsets", () => {
  const offsets = [0, 1, -1, 7, -7, 30, -30, 365, -365, 1000, -1000];

  for (const delta of offsets) {
    it(`shifting by ${delta} then back returns the original`, () => {
      const start = "2026-08-17";
      expect(shiftDayKey(shiftDayKey(start, delta), -delta)).toBe(start);
    });
  }

  for (const delta of offsets) {
    it(`shifting by ${delta} moves exactly ${delta} days`, () => {
      const start = "2026-08-17";
      expect(daysBetween(start, shiftDayKey(start, delta))).toBe(delta);
    });
  }
});

describe("daysBetween", () => {
  const cases: [string, string, number][] = [
    ["2026-01-01", "2026-01-01", 0],
    ["2026-01-01", "2026-01-02", 1],
    ["2026-01-02", "2026-01-01", -1],
    ["2026-01-01", "2026-02-01", 31],
    ["2026-01-01", "2027-01-01", 365],
    ["2024-01-01", "2025-01-01", 366],
    ["2024-02-28", "2024-03-01", 2],
    ["2026-02-28", "2026-03-01", 1],
    ["2026-12-31", "2027-01-01", 1],
    ["2020-01-01", "2026-01-01", 2192],
  ];

  for (const [a, b, expected] of cases) {
    it(`${a} → ${b} is ${expected}`, () => {
      expect(daysBetween(a, b)).toBe(expected);
    });
  }

  it("is antisymmetric across a long walk", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 200; i++) {
      const other = shiftDayKey(cursor, i);
      // `|| 0` normalises negative zero, which Object.is treats as a
      // different value from positive zero and which -(0) produces.
      expect(daysBetween(cursor, other) || 0).toBe(
        -daysBetween(other, cursor) || 0,
      );
    }
  });
});

describe("weekdayOf", () => {
  // 2026-08-17 is a Monday; walk from there so every case is derived
  // from one anchor rather than seven independent guesses.
  const anchor = "2026-08-17";

  it("knows the anchor is a Monday", () => {
    expect(weekdayOf(anchor)).toBe(1);
  });

  it("cycles 0..6 without gaps over 70 days", () => {
    for (let i = 0; i < 70; i++) {
      const day = shiftDayKey(anchor, i);
      expect(weekdayOf(day)).toBe((1 + i) % 7);
    }
  });

  it("repeats every seven days for a year", () => {
    for (let i = 0; i < 365; i++) {
      const a = shiftDayKey(anchor, i);
      const b = shiftDayKey(anchor, i + 7);
      expect(weekdayOf(a)).toBe(weekdayOf(b));
    }
  });

  it("always returns a value in range across four years", () => {
    for (let i = 0; i < 1460; i += 13) {
      const day = weekdayOf(shiftDayKey(anchor, i));
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day).toBeLessThanOrEqual(6);
    }
  });
});

describe("dayKeyToDate", () => {
  it("round-trips through a whole month", () => {
    for (let d = 1; d <= 31; d++) {
      const k = key(2026, 1, d);
      expect(dayKeyToDate(k).toISOString().slice(0, 10)).toBe(k);
    }
  });

  it("is midnight UTC, so day maths never drifts by a timezone", () => {
    for (let d = 1; d <= 28; d++) {
      const at = dayKeyToDate(key(2026, 2, d));
      expect(at.getUTCHours()).toBe(0);
      expect(at.getUTCMinutes()).toBe(0);
      expect(at.getUTCSeconds()).toBe(0);
      expect(at.getUTCMilliseconds()).toBe(0);
    }
  });
});

describe("dayKeyFor — the day-end rule", () => {
  const zone = "Asia/Kolkata";

  it("counts work before the roll-over hour as the previous day", () => {
    // 02:00 IST on the 18th, with the day ending at 04:00, is the 17th.
    const at = new Date("2026-08-17T20:30:00.000Z"); // 02:00 IST on 18th
    expect(dayKeyFor(at, zone, 4)).toBe("2026-08-17");
  });

  it("counts work after the roll-over hour as the new day", () => {
    const at = new Date("2026-08-17T23:30:00.000Z"); // 05:00 IST on 18th
    expect(dayKeyFor(at, zone, 4)).toBe("2026-08-18");
  });

  for (const hour of [0, 1, 2, 3, 4, 5, 6, 8, 12]) {
    it(`is stable for a whole day with the roll-over at ${hour}:00`, () => {
      // Every instant in a 24-hour span maps to one of two adjacent keys
      // and never jumps around.
      const seen = new Set<string>();
      for (let m = 0; m < 24 * 60; m += 37) {
        const at = new Date(Date.UTC(2026, 7, 17, 0, m));
        seen.add(dayKeyFor(at, zone, hour));
      }
      expect(seen.size).toBeLessThanOrEqual(2);
    });
  }

  const zones = [
    "Asia/Kolkata",
    "UTC",
    "America/New_York",
    "Europe/London",
    "Australia/Sydney",
    "Pacific/Kiritimati",
    "Pacific/Niue",
    "Asia/Tokyo",
    "America/Los_Angeles",
    "Africa/Cairo",
  ];

  for (const z of zones) {
    it(`returns a well-formed key in ${z}`, () => {
      expect(dayKeyFor(new Date("2026-08-17T12:00:00Z"), z, 4)).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
    });
  }

  for (const z of zones) {
    it(`advances by one day over 24 hours in ${z}`, () => {
      const start = new Date("2026-08-17T12:00:00Z");
      const later = new Date(start.getTime() + 86_400_000);
      expect(daysBetween(dayKeyFor(start, z, 4), dayKeyFor(later, z, 4))).toBe(
        1,
      );
    });
  }
});

describe("isBackdated", () => {
  const today = "2026-08-17";

  it("today is never backdated", () => {
    expect(isBackdated(today, today, 0)).toBe(false);
  });

  it("the future is not backdated", () => {
    for (let i = 1; i <= 10; i++) {
      expect(isBackdated(shiftDayKey(today, i), today, 0)).toBe(false);
    }
  });

  it("with no grace, anything before today counts as backdated", () => {
    for (let i = 1; i <= 10; i++) {
      expect(isBackdated(shiftDayKey(today, -i), today, 0)).toBe(true);
    }
  });

  for (const limit of [0, 1, 2, 3, 5, 7, 14, 30]) {
    it(`a grace of ${limit} days forgives exactly that many`, () => {
      for (let back = 0; back <= limit; back++) {
        expect(isBackdated(shiftDayKey(today, -back), today, limit)).toBe(false);
      }
      expect(isBackdated(shiftDayKey(today, -(limit + 1)), today, limit)).toBe(
        true,
      );
    });
  }
});
