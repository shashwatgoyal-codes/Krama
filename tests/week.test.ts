import { describe, it, expect } from "vitest";
import {
  weekDays,
  startOfWeek,
  describeWeek,
  monthGridDays,
  isInMonth,
  describeMonth,
  shiftMonth,
} from "@/lib/week";
import { weekdayOf } from "@/lib/day";

describe("weekDays", () => {
  it("always starts on Monday", () => {
    // Every day of one week must produce the same Monday.
    for (const day of [
      "2026-08-10", // Mon
      "2026-08-12", // Wed
      "2026-08-15", // Sat
      "2026-08-16", // Sun
    ]) {
      expect(startOfWeek(day)).toBe("2026-08-10");
    }
  });

  it("returns seven consecutive days", () => {
    const days = weekDays("2026-08-15");
    expect(days).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
      "2026-08-16",
    ]);
  });

  it("includes the weekend, which a five-column week would hide", () => {
    const days = weekDays("2026-08-12");
    expect(days.map(weekdayOf)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it("treats Sunday as the end of its week, not the start of the next", () => {
    // The classic off-by-one: with a Sunday-first calendar, Sunday jumps
    // forward a week and a block on it disappears from the view.
    expect(weekDays("2026-08-16")[6]).toBe("2026-08-16");
  });

  it("crosses a month boundary", () => {
    const days = weekDays("2026-09-01");
    expect(days[0]).toBe("2026-08-31");
    expect(days[6]).toBe("2026-09-06");
  });

  it("crosses a year boundary", () => {
    const days = weekDays("2027-01-01");
    expect(days).toContain("2026-12-28");
    expect(days).toContain("2027-01-03");
  });
});

describe("describeWeek", () => {
  it("names the month once when the week sits inside it", () => {
    expect(describeWeek(weekDays("2026-08-15"))).toBe("10 – 16 August");
  });

  it("names both months when the week straddles them", () => {
    expect(describeWeek(weekDays("2026-09-01"))).toBe(
      "31 August – 6 September",
    );
  });
});

describe("monthGridDays", () => {
  it("always returns six whole weeks", () => {
    for (const day of ["2026-02-15", "2026-08-15", "2027-01-05"]) {
      expect(monthGridDays(day)).toHaveLength(42);
    }
  });

  it("starts on the Monday on or before the first of the month", () => {
    // 1 August 2026 is a Saturday, so the grid opens on 27 July.
    expect(monthGridDays("2026-08-15")[0]).toBe("2026-07-27");
  });

  it("starts on the first itself when that is a Monday", () => {
    // 1 June 2026 is a Monday — no padding needed at the front.
    expect(monthGridDays("2026-06-10")[0]).toBe("2026-06-01");
  });

  it("contains every day of the month", () => {
    const grid = monthGridDays("2026-02-15");
    for (let d = 1; d <= 28; d++) {
      expect(grid).toContain(`2026-02-${String(d).padStart(2, "0")}`);
    }
  });

  it("does not care which day of the month it is given", () => {
    expect(monthGridDays("2026-08-01")).toEqual(monthGridDays("2026-08-31"));
  });
});

describe("isInMonth", () => {
  it("separates the month's own days from the padding", () => {
    expect(isInMonth("2026-08-15", "2026-08-01")).toBe(true);
    expect(isInMonth("2026-07-27", "2026-08-01")).toBe(false);
    expect(isInMonth("2026-09-06", "2026-08-15")).toBe(false);
  });
});

describe("shiftMonth", () => {
  it("steps forward and back a month", () => {
    expect(shiftMonth("2026-08-15", 1)).toBe("2026-09-01");
    expect(shiftMonth("2026-08-15", -1)).toBe("2026-07-01");
  });

  it("rolls over a year boundary", () => {
    expect(shiftMonth("2026-12-10", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-10", -1)).toBe("2025-12-01");
  });

  it("does not skip February when stepping from a long month", () => {
    // Naive date maths lands on 31 February and silently becomes March.
    expect(shiftMonth("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("describeMonth", () => {
  it("names the month and year", () => {
    expect(describeMonth("2026-08-15")).toBe("August 2026");
  });
});

describe("a week that starts on Sunday", () => {
  it("leads with Sunday when asked to", () => {
    // 2026-08-15 is a Saturday; its Sunday-led week opens on the 9th.
    expect(weekDays("2026-08-15", 0)[0]).toBe("2026-08-09");
    expect(weekDays("2026-08-15", 0)[6]).toBe("2026-08-15");
  });

  it("puts Sunday first in the weekday order", () => {
    expect(weekDays("2026-08-15", 0).map(weekdayOf)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("still contains the given day", () => {
    for (const day of ["2026-08-09", "2026-08-12", "2026-08-15"]) {
      expect(weekDays(day, 0)).toContain(day);
    }
  });

  it("defaults to Monday when not told otherwise", () => {
    expect(weekDays("2026-08-15")).toEqual(weekDays("2026-08-15", 1));
  });

  it("shifts the month grid's first cell as well", () => {
    // 1 August 2026 is a Saturday. Monday-led opens 27 Jul; Sunday-led
    // opens 26 Jul — one day earlier, not the same grid.
    expect(monthGridDays("2026-08-15", 1)[0]).toBe("2026-07-27");
    expect(monthGridDays("2026-08-15", 0)[0]).toBe("2026-07-26");
  });

  it("still covers every day of the month either way", () => {
    for (const startsOn of [0, 1]) {
      const grid = monthGridDays("2026-08-15", startsOn);
      expect(grid).toHaveLength(42);
      for (const d of ["2026-08-01", "2026-08-31"]) expect(grid).toContain(d);
    }
  });
});
