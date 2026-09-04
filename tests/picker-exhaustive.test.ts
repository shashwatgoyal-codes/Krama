import { describe, it, expect } from "vitest";
import { monthGrid } from "@/components/ui/DateField";
import { toMinutes, toValue } from "@/components/ui/TimeField";

/**
 * Every month the calendar can be paged to, and every minute the time
 * field can hold.
 *
 * A hand-built date picker is easy to make pretty and hard to make right.
 * The failures are all at the edges — a leap February, a month starting
 * on a Sunday, the week that straddles New Year — and they are invisible
 * until someone happens to open that month. So every month across fifty
 * years is opened here instead.
 */

const YEARS = Array.from({ length: 51 }, (_, i) => 2000 + i);
const MONTHS = YEARS.flatMap((y) =>
  Array.from({ length: 12 }, (_, m) => [y, m] as const),
);

describe("the month grid", () => {
  it.each(MONTHS)("%i-%i is six whole weeks", (y, m) => {
    expect(monthGrid(y, m)).toHaveLength(42);
  });

  it.each(MONTHS)("%i-%i begins on a Monday", (y, m) => {
    expect(monthGrid(y, m)[0].getUTCDay()).toBe(1);
  });

  it.each(MONTHS)("%i-%i runs in unbroken daily steps", (y, m) => {
    const grid = monthGrid(y, m);
    for (let i = 1; i < grid.length; i++) {
      expect(grid[i].getTime() - grid[i - 1].getTime()).toBe(86_400_000);
    }
  });

  it.each(MONTHS)("%i-%i holds every day of that month, in order", (y, m) => {
    const own = monthGrid(y, m)
      .filter((d) => d.getUTCFullYear() === y && d.getUTCMonth() === m)
      .map((d) => d.getUTCDate());
    const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    expect(own).toEqual(Array.from({ length: last }, (_, i) => i + 1));
  });

  it.each(MONTHS)(
    "%i-%i shows the month itself before any padding ends",
    (y, m) => {
      const grid = monthGrid(y, m);
      const first = grid.findIndex((d) => d.getUTCMonth() === m);
      // Padding only ever leads and trails; the month is one run.
      const last = grid.map((d) => d.getUTCMonth()).lastIndexOf(m);
      expect(last - first + 1).toBe(
        new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
      );
      expect(first).toBeLessThan(7);
    },
  );
});

const ALL_MINUTES = Array.from({ length: 1440 }, (_, i) => i);

describe("the stored time value", () => {
  it.each(ALL_MINUTES)("minute %i round-trips", (m) => {
    expect(toMinutes(toValue(m))).toBe(m);
  });

  it.each(ALL_MINUTES)("minute %i is stored 24-hour and zero-padded", (m) => {
    expect(toValue(m)).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
  });
});

describe("times that are not times", () => {
  const BAD = [
    "",
    " ",
    "9",
    "09",
    "9:",
    ":30",
    "24:00",
    "25:00",
    "23:60",
    "99:99",
    "ab:cd",
    "09:0a",
    "-1:00",
    "09:30:00",
    "09.30",
    "0930",
    "9 30",
    "09:30 am",
    "am",
    "null",
    "undefined",
    "NaN",
    "1e2:00",
    "٠٩:٣٠",
  ];
  it.each(BAD)("%j is refused", (bad) => {
    expect(toMinutes(bad)).toBeNull();
  });
});
