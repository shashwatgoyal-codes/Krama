import { describe, it, expect } from "vitest";
import {
  weekDays,
  startOfWeek,
  monthGridDays,
  isInMonth,
  describeMonth,
  shiftMonth,
  describeWeek,
} from "@/lib/week";
import { shiftDayKey, weekdayOf } from "@/lib/day";
import {
  NOTE_COLOURS,
  TINT_PRESETS,
  DEFAULT_TINTS,
  tintPreset,
  tintCss,
} from "@/lib/notes";
import { ACCENTS, ACCENT_VALUES, isAccent, DENSITIES } from "@/lib/appearance";

/**
 * The calendar's week and month arithmetic, plus the small palettes.
 *
 * The calendar grid is the place where an off-by-one is invisible until
 * someone notices their Monday column starts on Sunday, so these check
 * the properties that must hold for every week of a year rather than
 * for one convenient date.
 */

describe("weekDays", () => {
  for (const startsOn of [0, 1]) {
    it(`always returns seven days when the week starts on ${startsOn}`, () => {
      let cursor = "2026-01-01";
      for (let i = 0; i < 120; i++) {
        expect(weekDays(cursor, startsOn)).toHaveLength(7);
        cursor = shiftDayKey(cursor, 3);
      }
    });
  }

  for (const startsOn of [0, 1]) {
    it(`begins on weekday ${startsOn} every time, across a year`, () => {
      let cursor = "2026-01-01";
      for (let i = 0; i < 365; i++) {
        expect(weekdayOf(weekDays(cursor, startsOn)[0]!)).toBe(startsOn);
        cursor = shiftDayKey(cursor, 1);
      }
    });
  }

  for (const startsOn of [0, 1]) {
    it(`returns consecutive days when starting on ${startsOn}`, () => {
      const days = weekDays("2026-08-17", startsOn);
      for (let i = 1; i < days.length; i++) {
        expect(days[i]).toBe(shiftDayKey(days[i - 1]!, 1));
      }
    });
  }

  for (const startsOn of [0, 1]) {
    it(`always contains the day it was asked about, starting on ${startsOn}`, () => {
      let cursor = "2026-02-01";
      for (let i = 0; i < 200; i++) {
        expect(weekDays(cursor, startsOn)).toContain(cursor);
        cursor = shiftDayKey(cursor, 1);
      }
    });
  }

  it("gives the same week for every day within it", () => {
    for (const startsOn of [0, 1]) {
      const reference = weekDays("2026-08-17", startsOn);
      for (const day of reference) {
        expect(weekDays(day, startsOn)).toEqual(reference);
      }
    }
  });
});

describe("startOfWeek", () => {
  for (const startsOn of [0, 1]) {
    it(`lands on weekday ${startsOn}, across a year`, () => {
      let cursor = "2026-01-01";
      for (let i = 0; i < 365; i++) {
        expect(weekdayOf(startOfWeek(cursor, startsOn))).toBe(startsOn);
        cursor = shiftDayKey(cursor, 1);
      }
    });
  }

  for (const startsOn of [0, 1]) {
    it(`is never more than six days before the day given (start ${startsOn})`, () => {
      let cursor = "2026-03-01";
      for (let i = 0; i < 200; i++) {
        const start = startOfWeek(cursor, startsOn);
        expect(start <= cursor).toBe(true);
        expect(shiftDayKey(start, 7) > cursor).toBe(true);
        cursor = shiftDayKey(cursor, 1);
      }
    });
  }

  it("is idempotent", () => {
    for (const startsOn of [0, 1]) {
      let cursor = "2026-05-01";
      for (let i = 0; i < 60; i++) {
        const once = startOfWeek(cursor, startsOn);
        expect(startOfWeek(once, startsOn)).toBe(once);
        cursor = shiftDayKey(cursor, 1);
      }
    }
  });
});

describe("monthGridDays", () => {
  const months = Array.from(
    { length: 24 },
    (_, i) => `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`,
  );

  for (const startsOn of [0, 1]) {
    it(`returns whole weeks for every month over two years (start ${startsOn})`, () => {
      for (const month of months) {
        expect(monthGridDays(month, startsOn).length % 7).toBe(0);
      }
    });
  }

  for (const startsOn of [0, 1]) {
    it(`covers every day of every month over two years (start ${startsOn})`, () => {
      for (const month of months) {
        const grid = monthGridDays(month, startsOn);
        const inMonth = grid.filter((d) => isInMonth(d, month));
        // Every day of the month appears exactly once.
        expect(new Set(inMonth).size).toBe(inMonth.length);
        expect(inMonth.length).toBeGreaterThanOrEqual(28);
        expect(inMonth.length).toBeLessThanOrEqual(31);
      }
    });
  }

  for (const startsOn of [0, 1]) {
    it(`is consecutive with no gaps (start ${startsOn})`, () => {
      for (const month of months.slice(0, 6)) {
        const grid = monthGridDays(month, startsOn);
        for (let i = 1; i < grid.length; i++) {
          expect(grid[i]).toBe(shiftDayKey(grid[i - 1]!, 1));
        }
      }
    });
  }

  for (const startsOn of [0, 1]) {
    it(`begins on the configured weekday (start ${startsOn})`, () => {
      for (const month of months) {
        expect(weekdayOf(monthGridDays(month, startsOn)[0]!)).toBe(startsOn);
      }
    });
  }
});

describe("isInMonth", () => {
  it("is true for every day of a month and false either side", () => {
    for (const month of ["2026-01-01", "2026-02-01", "2024-02-01"]) {
      let cursor = month;
      while (isInMonth(cursor, month)) cursor = shiftDayKey(cursor, 1);
      // The first day outside is the first of the next month.
      expect(cursor.slice(8)).toBe("01");
      expect(isInMonth(shiftDayKey(month, -1), month)).toBe(false);
    }
  });
});

describe("shiftMonth", () => {
  it("returns to where it started after twelve steps", () => {
    for (const start of ["2026-01-15", "2026-06-30", "2024-02-29"]) {
      let cursor = start;
      for (let i = 0; i < 12; i++) cursor = shiftMonth(cursor, 1);
      expect(cursor.slice(0, 4)).toBe(String(Number(start.slice(0, 4)) + 1));
    }
  });

  it("is reversible", () => {
    for (const delta of [1, -1, 3, -3, 6, 12, -12]) {
      const start = "2026-08-17";
      expect(shiftMonth(shiftMonth(start, delta), -delta).slice(0, 7)).toBe(
        start.slice(0, 7),
      );
    }
  });

  it("steps through every month of a year without repeating", () => {
    const seen = new Set<string>();
    let cursor = "2026-01-01";
    for (let i = 0; i < 12; i++) {
      seen.add(cursor.slice(0, 7));
      cursor = shiftMonth(cursor, 1);
    }
    expect(seen.size).toBe(12);
  });
});

describe("describeMonth and describeWeek", () => {
  it("names all twelve months distinctly", () => {
    const seen = new Set<string>();
    for (let m = 1; m <= 12; m++) {
      seen.add(describeMonth(`2026-${String(m).padStart(2, "0")}-01`));
    }
    expect(seen.size).toBe(12);
  });

  it("never returns an empty description", () => {
    let cursor = "2026-01-01";
    for (let i = 0; i < 60; i++) {
      expect(describeMonth(cursor).length).toBeGreaterThan(0);
      cursor = shiftMonth(cursor, 1);
    }
  });

  it("describes a week without throwing", () => {
    for (const startsOn of [0, 1]) {
      let cursor = "2026-01-01";
      for (let i = 0; i < 52; i++) {
        expect(describeWeek(weekDays(cursor, startsOn)).length).toBeGreaterThan(
          0,
        );
        cursor = shiftDayKey(cursor, 7);
      }
    }
  });

  it("survives an empty week without throwing", () => {
    expect(() => describeWeek([])).not.toThrow();
    expect(describeWeek([])).toBe("");
  });

  it("survives a malformed week without throwing", () => {
    expect(() => describeWeek(["not-a-date"])).not.toThrow();
    expect(describeWeek(["not-a-date"])).toBe("");
  });
});

describe("note tints", () => {
  it("offers exactly five slots", () => {
    expect(NOTE_COLOURS).toHaveLength(5);
    expect(DEFAULT_TINTS).toHaveLength(5);
  });

  it("has a preset for every default", () => {
    for (const name of DEFAULT_TINTS) {
      expect(TINT_PRESETS.some((p) => p.value === name)).toBe(true);
    }
  });

  it("gives every preset a distinct name", () => {
    expect(new Set(TINT_PRESETS.map((p) => p.value)).size).toBe(
      TINT_PRESETS.length,
    );
  });

  it("resolves every preset by name", () => {
    for (const preset of TINT_PRESETS) {
      expect(tintPreset(preset.value)).toBeTruthy();
    }
  });

  it("falls back rather than returning nothing for an unknown name", () => {
    expect(tintPreset("chartreuse")).toBeTruthy();
  });

  it("produces css for every valid combination of five presets", () => {
    for (const preset of TINT_PRESETS) {
      const chosen = [preset.value, ...DEFAULT_TINTS.slice(1)];
      const css = tintCss(chosen);
      expect(typeof css).toBe("string");
      expect(css.length).toBeGreaterThan(0);
    }
  });

  it("produces css even when handed nonsense", () => {
    expect(() => tintCss(["nope", "also-nope"])).not.toThrow();
    expect(() => tintCss([])).not.toThrow();
  });
});

describe("accents", () => {
  it("accepts every accent it offers", () => {
    for (const accent of ACCENT_VALUES) {
      expect(isAccent(accent)).toBe(true);
    }
  });

  const notAccents = ["", "chartreuse", "AMBER", "red ", "#ff0000"];
  for (const value of notAccents) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(isAccent(value)).toBe(false);
    });
  }

  it("gives every accent a distinct value", () => {
    expect(new Set(ACCENT_VALUES).size).toBe(ACCENT_VALUES.length);
  });

  it("gives every accent a label", () => {
    for (const accent of ACCENTS) {
      expect(accent.label.length).toBeGreaterThan(0);
    }
  });

  it("offers exactly two densities", () => {
    expect(DENSITIES).toHaveLength(2);
  });
});
