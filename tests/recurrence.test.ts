import { describe, it, expect } from "vitest";
import {
  occursOn,
  nextOccurrence,
  clampToMonth,
  describeRecurrence,
} from "@/lib/recurrence";

// 2026-08-15 is a Saturday.
const SAT = "2026-08-15";
const SUN = "2026-08-16";
const MON = "2026-08-17";
const FRI = "2026-08-21";

describe("occursOn", () => {
  it("daily fires every day", () => {
    expect(occursOn(SAT, "daily", null)).toBe(true);
    expect(occursOn(SUN, "daily", null)).toBe(true);
  });

  it("weekdays skips the weekend", () => {
    expect(occursOn(MON, "weekdays", null)).toBe(true);
    expect(occursOn(FRI, "weekdays", null)).toBe(true);
    expect(occursOn(SAT, "weekdays", null)).toBe(false);
    expect(occursOn(SUN, "weekdays", null)).toBe(false);
  });

  it("weekly fires on its chosen day only", () => {
    expect(occursOn(MON, "weekly", 1)).toBe(true);
    expect(occursOn(SAT, "weekly", 1)).toBe(false);
  });

  it("monthly fires on its date", () => {
    expect(occursOn("2026-08-15", "monthly", 15)).toBe(true);
    expect(occursOn("2026-08-16", "monthly", 15)).toBe(false);
  });

  it("never fires for a one-off", () => {
    expect(occursOn(SAT, "none", null)).toBe(false);
  });
});

describe("monthly on a date that doesn't always exist", () => {
  it("clamps the 31st to the last day of a short month", () => {
    expect(clampToMonth("2026-01-01", 31)).toBe(31); // January
    expect(clampToMonth("2026-02-01", 31)).toBe(28); // February
    expect(clampToMonth("2026-04-01", 31)).toBe(30); // April
  });

  it("handles a leap February", () => {
    expect(clampToMonth("2028-02-01", 31)).toBe(29);
  });

  it("fires on 28 February for a 31st rule", () => {
    // The naive version silently never fires in February. This is the
    // bug the audit called out, so it gets a test.
    expect(occursOn("2026-02-28", "monthly", 31)).toBe(true);
    expect(occursOn("2026-02-27", "monthly", 31)).toBe(false);
  });

  it("still fires on the 31st in a long month", () => {
    expect(occursOn("2026-01-31", "monthly", 31)).toBe(true);
    expect(occursOn("2026-01-30", "monthly", 31)).toBe(false);
  });
});

describe("nextOccurrence", () => {
  it("daily is tomorrow", () => {
    expect(nextOccurrence(SAT, "daily", null)).toBe(SUN);
  });

  it("weekdays jumps the weekend", () => {
    // Friday's next weekday is Monday, not Saturday.
    expect(nextOccurrence(FRI, "weekdays", null)).toBe("2026-08-24");
  });

  it("weekly is seven days later", () => {
    expect(nextOccurrence(MON, "weekly", 1)).toBe("2026-08-24");
  });

  it("monthly rolls to the next month", () => {
    expect(nextOccurrence("2026-08-15", "monthly", 15)).toBe("2026-09-15");
  });

  it("monthly on the 31st lands on the end of February", () => {
    expect(nextOccurrence("2026-01-31", "monthly", 31)).toBe("2026-02-28");
  });

  it("crosses a year boundary", () => {
    expect(nextOccurrence("2026-12-31", "daily", null)).toBe("2027-01-01");
  });

  it("returns null for a one-off, so nothing is ever generated", () => {
    expect(nextOccurrence(SAT, "none", null)).toBeNull();
  });
});

describe("describeRecurrence", () => {
  it("reads as a sentence, not a rule", () => {
    expect(describeRecurrence("daily", null)).toBe("Every day");
    expect(describeRecurrence("weekdays", null)).toBe("Weekdays");
    expect(describeRecurrence("weekly", 1)).toBe("Every Monday");
    expect(describeRecurrence("monthly", 1)).toBe("Monthly on the 1st");
    expect(describeRecurrence("monthly", 22)).toBe("Monthly on the 22nd");
    expect(describeRecurrence("monthly", 3)).toBe("Monthly on the 3rd");
    expect(describeRecurrence("none", null)).toBe("Once");
  });
});
