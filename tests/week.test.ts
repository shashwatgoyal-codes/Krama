import { describe, it, expect } from "vitest";
import { weekDays, startOfWeek, describeWeek } from "@/lib/week";
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
