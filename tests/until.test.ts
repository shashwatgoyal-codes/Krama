import { describe, it, expect } from "vitest";
import {
  endOfMonth,
  endOfYear,
  resolveUntil,
  presetFor,
  describeUntil,
  hasEnded,
  isUntilPreset,
  UNTIL_PRESETS,
} from "@/lib/until";
import { occursOn, nextOccurrence } from "@/lib/recurrence";
import { shiftDayKey } from "@/lib/day";

/**
 * When a routine stops.
 *
 * The failure mode here is quiet in both directions: an end date that is
 * ignored means the routine keeps producing work forever, and one that
 * is applied a day early means the last occurrence silently never
 * happens. Neither announces itself — you just find a task list that is
 * subtly wrong — so the boundary day gets checked from both sides.
 */

describe("endOfMonth", () => {
  const cases: [string, string][] = [
    ["2026-01-15", "2026-01-31"],
    ["2026-02-01", "2026-02-28"],
    ["2024-02-01", "2024-02-29"],
    ["2000-02-10", "2000-02-29"],
    ["1900-02-10", "1900-02-28"],
    ["2026-03-31", "2026-03-31"],
    ["2026-04-01", "2026-04-30"],
    ["2026-06-15", "2026-06-30"],
    ["2026-12-01", "2026-12-31"],
    ["2026-12-31", "2026-12-31"],
  ];

  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      expect(endOfMonth(input)).toBe(expected);
    });
  }

  it("is idempotent — the end of the month is its own month end", () => {
    for (let month = 1; month <= 12; month++) {
      const key = `2026-${String(month).padStart(2, "0")}-01`;
      const end = endOfMonth(key);
      expect(endOfMonth(end)).toBe(end);
    }
  });

  it("never returns a day outside the month it was asked about", () => {
    for (let month = 1; month <= 12; month++) {
      const key = `2026-${String(month).padStart(2, "0")}-05`;
      expect(endOfMonth(key).slice(0, 7)).toBe(key.slice(0, 7));
    }
  });

  it("is never earlier than the day it was given", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 400; i++) {
      expect(endOfMonth(cursor) >= cursor).toBe(true);
      cursor = shiftDayKey(cursor, 1);
    }
  });
});

describe("endOfYear", () => {
  for (const year of [2024, 2025, 2026, 2100]) {
    it(`${year} ends on 31 December`, () => {
      expect(endOfYear(`${year}-06-15`)).toBe(`${year}-12-31`);
    });
  }

  it("is idempotent", () => {
    expect(endOfYear(endOfYear("2026-03-01"))).toBe("2026-12-31");
  });

  it("is never earlier than the day it was given", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 365; i++) {
      expect(endOfYear(cursor) >= cursor).toBe(true);
      cursor = shiftDayKey(cursor, 1);
    }
  });
});

describe("resolveUntil", () => {
  const today = "2026-08-17";

  it("means open-ended when never", () => {
    expect(resolveUntil("never", today)).toBe(null);
  });

  it("resolves the month preset against the day the user is on", () => {
    expect(resolveUntil("month", today)).toBe("2026-08-31");
    expect(resolveUntil("month", "2026-02-03")).toBe("2026-02-28");
    expect(resolveUntil("month", "2024-02-03")).toBe("2024-02-29");
  });

  it("resolves the year preset", () => {
    expect(resolveUntil("year", today)).toBe("2026-12-31");
  });

  it("takes a chosen date as given", () => {
    expect(resolveUntil("date", today, "2027-03-01")).toBe("2027-03-01");
  });

  it("treats a missing date as open-ended rather than failing the save", () => {
    // The picker was opened and never filled in. Refusing to save the
    // whole routine over that would be worse than treating it as never.
    expect(resolveUntil("date", today, null)).toBe(null);
    expect(resolveUntil("date", today, "")).toBe(null);
    expect(resolveUntil("date", today, undefined)).toBe(null);
  });

  it("treats a malformed date the same way", () => {
    for (const bad of ["tomorrow", "17-08-2026", "2026-8-1", "nonsense"]) {
      expect(resolveUntil("date", today, bad)).toBe(null);
    }
  });
});

describe("presetFor — a stored date maps back to the control", () => {
  const today = "2026-08-17";

  it("shows never for an open-ended routine", () => {
    expect(presetFor(null, today)).toBe("never");
  });

  it("recognises this month's end", () => {
    expect(presetFor("2026-08-31", today)).toBe("month");
  });

  it("recognises this year's end", () => {
    expect(presetFor("2026-12-31", today)).toBe("year");
  });

  it("falls back to a specific date for anything else", () => {
    expect(presetFor("2027-04-09", today)).toBe("date");
  });

  it("round-trips every preset", () => {
    for (const preset of UNTIL_PRESETS) {
      if (preset.value === "date") continue;
      const resolved = resolveUntil(preset.value, today);
      expect(presetFor(resolved, today)).toBe(preset.value);
    }
  });
});

describe("occursOn — with an end date", () => {
  it("fires on the last day, which is the whole point of it being inclusive", () => {
    expect(occursOn("2026-08-31", "daily", null, "2026-08-31")).toBe(true);
  });

  it("stops the day after", () => {
    expect(occursOn("2026-09-01", "daily", null, "2026-08-31")).toBe(false);
  });

  it("fires on every day up to the end and none after", () => {
    const until = "2026-08-31";
    let cursor = "2026-08-01";
    for (let i = 0; i < 60; i++) {
      const expected = cursor <= until;
      expect(occursOn(cursor, "daily", null, until)).toBe(expected);
      cursor = shiftDayKey(cursor, 1);
    }
  });

  it("still respects the underlying rule inside the window", () => {
    // Weekly on a Monday, ending mid-September.
    const until = "2026-09-15";
    let cursor = "2026-08-17"; // a Monday
    let fired = 0;
    for (let i = 0; i < 60; i++) {
      if (occursOn(cursor, "weekly", 1, until)) fired++;
      cursor = shiftDayKey(cursor, 1);
    }
    // Mondays from 17 August to 14 September inclusive.
    expect(fired).toBe(5);
  });

  it("behaves exactly as before when open-ended", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 200; i++) {
      expect(occursOn(cursor, "weekdays", null, null)).toBe(
        occursOn(cursor, "weekdays", null),
      );
      cursor = shiftDayKey(cursor, 1);
    }
  });

  it("never fires for a routine whose end is in the past", () => {
    let cursor = "2026-08-01";
    for (let i = 0; i < 30; i++) {
      expect(occursOn(cursor, "daily", null, "2026-07-31")).toBe(false);
      cursor = shiftDayKey(cursor, 1);
    }
  });
});

describe("nextOccurrence — with an end date", () => {
  it("returns nothing once the end has passed", () => {
    expect(nextOccurrence("2026-09-01", "daily", null, "2026-08-31")).toBe(
      null,
    );
  });

  it("returns nothing when asked from the last day itself", () => {
    expect(nextOccurrence("2026-08-31", "daily", null, "2026-08-31")).toBe(
      null,
    );
  });

  it("returns the last day when asked from the day before", () => {
    expect(nextOccurrence("2026-08-30", "daily", null, "2026-08-31")).toBe(
      "2026-08-31",
    );
  });

  it("walks a bounded routine to its end and then stops", () => {
    const until = "2026-09-30";
    let cursor = "2026-08-17";
    let steps = 0;
    while (steps < 100) {
      const next = nextOccurrence(cursor, "weekly", 1, until);
      if (!next) break;
      expect(next <= until).toBe(true);
      cursor = next;
      steps++;
    }
    // It terminated rather than running to the lookback limit.
    expect(steps).toBeLessThan(10);
    expect(steps).toBeGreaterThan(0);
  });

  it("is unchanged when open-ended", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 50; i++) {
      expect(nextOccurrence(cursor, "daily", null, null)).toBe(
        nextOccurrence(cursor, "daily", null),
      );
      cursor = shiftDayKey(cursor, 1);
    }
  });
});

describe("hasEnded", () => {
  it("is false for an open-ended routine, whatever the day", () => {
    for (const day of ["2020-01-01", "2026-08-17", "2099-12-31"]) {
      expect(hasEnded(null, day)).toBe(false);
    }
  });

  it("is false on the last day itself", () => {
    expect(hasEnded("2026-08-31", "2026-08-31")).toBe(false);
  });

  it("is true the day after", () => {
    expect(hasEnded("2026-08-31", "2026-09-01")).toBe(true);
  });
});

describe("describeUntil", () => {
  it("is empty for an open-ended routine", () => {
    expect(describeUntil(null)).toBe("");
  });

  it("names the day and month", () => {
    expect(describeUntil("2026-08-31")).toContain("August");
    expect(describeUntil("2026-08-31")).toContain("31");
  });

  it("survives a malformed date without throwing", () => {
    expect(() => describeUntil("nonsense")).not.toThrow();
    expect(describeUntil("nonsense")).toBe("");
  });
});

describe("isUntilPreset", () => {
  for (const preset of UNTIL_PRESETS) {
    it(`accepts ${preset.value}`, () => {
      expect(isUntilPreset(preset.value)).toBe(true);
    });
  }

  for (const value of ["", "forever", "NEVER", "week", "decade"]) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(isUntilPreset(value)).toBe(false);
    });
  }
});
