import { describe, it, expect } from "vitest";
import {
  dayKeyFor,
  daysBetween,
  weekdayOf,
  isBackdated,
} from "@/lib/day";

const TZ = "Asia/Kolkata"; // UTC+5:30, no DST — the user's own zone
const DAY_END = 4;

describe("dayKeyFor", () => {
  it("puts afternoon work on the same day", () => {
    // 15 Aug 2026, 14:00 IST  ->  08:30 UTC
    const at = new Date("2026-08-15T08:30:00Z");
    expect(dayKeyFor(at, TZ, DAY_END)).toBe("2026-08-15");
  });

  it("counts 01:30 as the previous day", () => {
    // 16 Aug 01:30 IST  ->  15 Aug 20:00 UTC. Still Saturday's work.
    const at = new Date("2026-08-15T20:00:00Z");
    expect(dayKeyFor(at, TZ, DAY_END)).toBe("2026-08-15");
  });

  it("rolls over exactly at the boundary hour", () => {
    // 16 Aug 04:00 IST  ->  15 Aug 22:30 UTC. First minute of the new day.
    const at = new Date("2026-08-15T22:30:00Z");
    expect(dayKeyFor(at, TZ, DAY_END)).toBe("2026-08-16");
  });

  it("treats 03:59 and 04:00 as different days", () => {
    const before = new Date("2026-08-15T22:29:00Z"); // 03:59 IST
    const after = new Date("2026-08-15T22:30:00Z"); // 04:00 IST
    expect(dayKeyFor(before, TZ, DAY_END)).toBe("2026-08-15");
    expect(dayKeyFor(after, TZ, DAY_END)).toBe("2026-08-16");
  });

  it("honours a midnight boundary when the user prefers it", () => {
    const at = new Date("2026-08-15T20:00:00Z"); // 01:30 IST on the 16th
    expect(dayKeyFor(at, TZ, 0)).toBe("2026-08-16");
  });

  it("survives a daylight-saving jump", () => {
    // London springs forward 29 Mar 2026 at 01:00 UTC.
    const before = new Date("2026-03-29T00:30:00Z"); // 00:30 GMT
    const after = new Date("2026-03-29T01:30:00Z"); // 02:30 BST
    expect(dayKeyFor(before, "Europe/London", DAY_END)).toBe("2026-03-28");
    expect(dayKeyFor(after, "Europe/London", DAY_END)).toBe("2026-03-28");
  });

  it("puts the same instant on different days in different zones", () => {
    const at = new Date("2026-08-15T20:00:00Z");
    expect(dayKeyFor(at, "Asia/Kolkata", DAY_END)).toBe("2026-08-15");
    expect(dayKeyFor(at, "America/Los_Angeles", DAY_END)).toBe("2026-08-15");
  });
});

describe("daysBetween", () => {
  it("counts forward and backward", () => {
    expect(daysBetween("2026-08-15", "2026-08-18")).toBe(3);
    expect(daysBetween("2026-08-18", "2026-08-15")).toBe(-3);
    expect(daysBetween("2026-08-15", "2026-08-15")).toBe(0);
  });

  it("crosses a month boundary", () => {
    expect(daysBetween("2026-08-30", "2026-09-02")).toBe(3);
  });

  it("is unaffected by DST in the underlying dates", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });
});

describe("weekdayOf", () => {
  it("maps Sunday to 0, matching restDays", () => {
    expect(weekdayOf("2026-08-16")).toBe(0); // Sunday
    expect(weekdayOf("2026-08-15")).toBe(6); // Saturday
    expect(weekdayOf("2026-08-17")).toBe(1); // Monday
  });
});

describe("isBackdated", () => {
  it("is false for today and the future", () => {
    expect(isBackdated("2026-08-15", "2026-08-15")).toBe(false);
    expect(isBackdated("2026-08-16", "2026-08-15")).toBe(false);
  });

  it("is true for any earlier day", () => {
    expect(isBackdated("2026-08-14", "2026-08-15")).toBe(true);
    expect(isBackdated("2026-07-01", "2026-08-15")).toBe(true);
  });
});

describe("the backdate grace period", () => {
  it("treats today as never backdated", () => {
    expect(isBackdated("2026-08-15", "2026-08-15", 2)).toBe(false);
  });

  it("keeps yesterday at full rate inside a 2-day grace", () => {
    // Logging last night's work this morning is ordinary life, not
    // gaming the score.
    expect(isBackdated("2026-08-14", "2026-08-15", 2)).toBe(false);
    expect(isBackdated("2026-08-13", "2026-08-15", 2)).toBe(false);
  });

  it("drops to half once past the grace", () => {
    expect(isBackdated("2026-08-12", "2026-08-15", 2)).toBe(true);
  });

  it("with no grace, anything before today pays half", () => {
    expect(isBackdated("2026-08-14", "2026-08-15", 0)).toBe(true);
    expect(isBackdated("2026-08-15", "2026-08-15", 0)).toBe(false);
  });

  it("defaults to no grace, which is the old behaviour", () => {
    expect(isBackdated("2026-08-14", "2026-08-15")).toBe(true);
  });

  it("never treats a future day as backdated", () => {
    expect(isBackdated("2026-08-20", "2026-08-15", 2)).toBe(false);
  });

  it("ignores a negative limit rather than inverting the rule", () => {
    expect(isBackdated("2026-08-14", "2026-08-15", -5)).toBe(true);
  });
});
