import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { monthGrid } from "@/components/ui/DateField";
import { toMinutes, toValue } from "@/components/ui/TimeField";

/**
 * The pickers the app draws itself.
 *
 * The native date and time controls are fine except for one thing that
 * cannot be fixed: their popups are drawn by the browser, outside the
 * page, so they stay white rectangles on a dark screen. Matching them to
 * the app means not using them.
 *
 * What must not change in the swap is the value. The stored form is still
 * "YYYY-MM-DD" and "HH:MM" in 24-hour, whatever the reader's clock says,
 * because that is what the server parses and what every other time is
 * compared against.
 */

const root = join(import.meta.dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

describe("the month grid", () => {
  it("always draws six whole weeks, so the popup never resizes", () => {
    for (const [y, m] of [
      [2026, 0], [2026, 1], [2026, 8], [2024, 1], [2027, 11],
    ] as const) {
      expect(monthGrid(y, m)).toHaveLength(42);
    }
  });

  it("starts on a Monday", () => {
    for (let m = 0; m < 12; m++) {
      // getUTCDay: Sunday is 0, so Monday is 1.
      expect(monthGrid(2026, m)[0].getUTCDay()).toBe(1);
    }
  });

  it("contains every day of the month it is for", () => {
    for (let m = 0; m < 12; m++) {
      const days = monthGrid(2026, m)
        .filter((d) => d.getUTCMonth() === m)
        .map((d) => d.getUTCDate());
      const last = new Date(Date.UTC(2026, m + 1, 0)).getUTCDate();
      expect(days).toEqual(Array.from({ length: last }, (_, i) => i + 1));
    }
  });

  it("handles a leap February", () => {
    const feb = monthGrid(2024, 1).filter((d) => d.getUTCMonth() === 1);
    expect(feb).toHaveLength(29);
  });

  it("handles a non-leap February", () => {
    const feb = monthGrid(2026, 1).filter((d) => d.getUTCMonth() === 1);
    expect(feb).toHaveLength(28);
  });

  it("runs in unbroken daily steps across a year boundary", () => {
    const grid = monthGrid(2026, 11);
    for (let i = 1; i < grid.length; i++) {
      const gap = grid[i].getTime() - grid[i - 1].getTime();
      expect(gap).toBe(86_400_000);
    }
  });
});

describe("time values", () => {
  it("round-trips every half hour of the day", () => {
    for (let m = 0; m < 1440; m += 30) {
      expect(toMinutes(toValue(m))).toBe(m);
    }
  });

  it("round-trips every single minute of the day", () => {
    for (let m = 0; m < 1440; m++) {
      expect(toMinutes(toValue(m))).toBe(m);
    }
  });

  it("always writes 24-hour, zero-padded", () => {
    expect(toValue(0)).toBe("00:00");
    expect(toValue(9 * 60)).toBe("09:00");
    expect(toValue(13 * 60 + 30)).toBe("13:30");
    expect(toValue(23 * 60 + 59)).toBe("23:59");
  });

  it("wraps rather than producing an impossible hour", () => {
    expect(toValue(1440)).toBe("00:00");
    expect(toValue(-30)).toBe("23:30");
    expect(toValue(1470)).toBe("00:30");
  });

  it("refuses what is not a time", () => {
    for (const bad of ["", "9", "9:00 am", "24:00", "12:60", "ab:cd", "1:2", "-1:00"]) {
      expect(toMinutes(bad)).toBeNull();
    }
  });

  it("accepts a single-digit hour, which is what typing produces", () => {
    expect(toMinutes("9:30")).toBe(9 * 60 + 30);
  });
});

describe("what the pickers promise", () => {
  const FILES = ["components/ui/DateField.tsx", "components/ui/TimeField.tsx"];

  it.each(FILES)("%s posts through a hidden input, not the visible text", (f) => {
    expect(read(f)).toMatch(/<input type="hidden" name=\{name\}/);
  });

  it.each(FILES)("%s falls back to the native control on a touch screen", (f) => {
    const src = read(f);
    expect(src).toContain("useCoarsePointer()");
    expect(src).toMatch(/if \(touch\) \{/);
  });

  it.each(FILES)("%s closes on Escape", (f) => {
    expect(read(f)).toMatch(/e\.key === "Escape"/);
  });

  it.each(FILES)("%s closes on a click outside", (f) => {
    expect(read(f)).toContain('document.addEventListener("mousedown", away)');
  });

  it.each(FILES)("%s draws its popup on the shared glass surface", (f) => {
    expect(read(f)).toMatch(/className="glass /);
  });

  it.each(FILES)("%s removes the listeners it added", (f) => {
    const src = read(f);
    expect(src).toContain('document.removeEventListener("mousedown", away)');
    expect(src).toContain('document.removeEventListener("keydown", key)');
  });
});

describe("no native picker is left in the app", () => {
  it("uses the app's own field everywhere a date is chosen", () => {
    for (const f of [
      "components/tasks/TaskDetail.tsx",
      "components/tasks/UntilField.tsx",
    ]) {
      expect(read(f)).not.toMatch(/type="date"/);
      expect(read(f)).toContain("DateField");
    }
  });

  it("uses the app's own field everywhere a time is chosen", () => {
    for (const f of ["components/tasks/TaskDetail.tsx", "components/AddTask.tsx"]) {
      expect(read(f)).not.toMatch(/type="time"/);
      expect(read(f)).toContain("TimeField");
    }
  });
});
