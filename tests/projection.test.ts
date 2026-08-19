import { describe, it, expect } from "vitest";
import {
  projectRoutines,
  minuteLabel,
  spanLabel,
  parseMinute,
  DEFAULT_ROUTINE_MINUTES,
  type RoutineTemplate,
} from "@/lib/projection";
import { shiftDayKey, weekdayOf } from "@/lib/day";

/**
 * Routines drawn on the calendar without rows behind them.
 *
 * The bug this fixes was quiet: scheduling a weekly task produced one
 * block, and every later week showed an empty morning even though the
 * routine was still running. Nothing announced it — the calendar simply
 * disagreed with the task list.
 */

function template(over: Partial<RoutineTemplate> = {}): RoutineTemplate {
  return {
    id: "t1",
    title: "Gym",
    points: 30,
    areaId: null,
    recurrence: "weekly",
    recurrenceValue: null,
    recurrenceDays: [1, 2, 3, 4, 5, 6],
    recurrenceUntil: null,
    routineStartMinute: 8 * 60,
    routineMinutes: 90,
    ...over,
  };
}

function range(from: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftDayKey(from, i));
}

describe("projectRoutines — the gym case", () => {
  const days = range("2026-08-17", 14);

  it("draws twelve sessions across a fortnight, skipping both Sundays", () => {
    const out = projectRoutines([template()], days);
    expect(out).toHaveLength(12);
    expect(out.every((b) => weekdayOf(b.dayKey) !== 0)).toBe(true);
  });

  it("puts every one at the same time", () => {
    for (const block of projectRoutines([template()], days)) {
      expect(block.startMinute).toBe(8 * 60);
      expect(block.minutes).toBe(90);
    }
  });

  it("carries the points, so the reason to turn up is visible", () => {
    for (const block of projectRoutines([template()], days)) {
      expect(block.points).toBe(30);
    }
  });

  it("returns them in day order", () => {
    const out = projectRoutines([template()], days);
    for (let i = 1; i < out.length; i++) {
      expect(out[i]!.dayKey >= out[i - 1]!.dayKey).toBe(true);
    }
  });
});

describe("projectRoutines — what it refuses to draw", () => {
  const days = range("2026-08-17", 7);

  it("still draws a routine with no time, marked all-day", () => {
    // It used to be skipped, which meant a repeating task with no hour
    // set simply did not exist as far as the calendar was concerned.
    // Something that happens every Tuesday is on Tuesday whether or not
    // you have decided when.
    const out = projectRoutines([template({ routineStartMinute: null })], days);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((b) => b.allDay)).toBe(true);
  });

  it("marks a routine that has a time as not all-day", () => {
    const out = projectRoutines([template()], days);
    expect(out.every((b) => b.allDay)).toBe(false);
  });

  it("skips a task that does not repeat", () => {
    const out = projectRoutines([template({ recurrence: "none" })], days);
    expect(out).toEqual([]);
  });

  it("stops at the end date", () => {
    const out = projectRoutines(
      [template({ recurrenceUntil: "2026-08-19" })],
      days,
    );
    expect(out.every((b) => b.dayKey <= "2026-08-19")).toBe(true);
    expect(out).toHaveLength(3);
  });

  it("draws nothing for a routine that ended before the range", () => {
    const out = projectRoutines(
      [template({ recurrenceUntil: "2026-01-01" })],
      days,
    );
    expect(out).toEqual([]);
  });

  it("leaves a day alone when a real block already covers it", () => {
    const occupied = new Set(["t1:2026-08-17", "t1:2026-08-18"]);
    const out = projectRoutines([template()], days, occupied);
    expect(out.some((b) => b.dayKey === "2026-08-17")).toBe(false);
    expect(out.some((b) => b.dayKey === "2026-08-18")).toBe(false);
    expect(out.some((b) => b.dayKey === "2026-08-19")).toBe(true);
  });

  it("draws nothing for an empty range", () => {
    expect(projectRoutines([template()], [])).toEqual([]);
  });

  it("draws nothing when there are no routines", () => {
    expect(projectRoutines([], days)).toEqual([]);
  });
});

describe("projectRoutines — the other rules", () => {
  const days = range("2026-08-17", 14);

  it("draws a daily routine every day", () => {
    const out = projectRoutines(
      [template({ recurrence: "daily", recurrenceDays: [] })],
      days,
    );
    expect(out).toHaveLength(14);
  });

  it("draws a weekdays routine ten times in a fortnight", () => {
    const out = projectRoutines(
      [template({ recurrence: "weekdays", recurrenceDays: [] })],
      days,
    );
    expect(out).toHaveLength(10);
  });

  it("draws a monthly routine once", () => {
    const out = projectRoutines(
      [
        template({
          recurrence: "monthly",
          recurrenceValue: 20,
          recurrenceDays: [],
        }),
      ],
      days,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.dayKey).toBe("2026-08-20");
  });

  it("handles several routines at once without mixing them up", () => {
    const out = projectRoutines(
      [
        template({ id: "gym", title: "Gym" }),
        template({
          id: "standup",
          title: "Standup",
          recurrence: "weekdays",
          recurrenceDays: [],
          routineStartMinute: 10 * 60,
        }),
      ],
      days,
    );
    expect(out.filter((b) => b.templateId === "gym")).toHaveLength(12);
    expect(out.filter((b) => b.templateId === "standup")).toHaveLength(10);
  });

  it("gives every projection a distinct key", () => {
    const out = projectRoutines(
      [template({ id: "a" }), template({ id: "b" })],
      days,
    );
    expect(new Set(out.map((b) => b.key)).size).toBe(out.length);
  });

  it("falls back to a default length when none was chosen", () => {
    const out = projectRoutines([template({ routineMinutes: null })], days);
    expect(out[0]!.minutes).toBe(DEFAULT_ROUTINE_MINUTES);
  });

  it("never writes anything — the input templates are untouched", () => {
    const input = template();
    const snapshot = JSON.stringify(input);
    projectRoutines([input], days);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("minuteLabel", () => {
  const cases: [number, string][] = [
    [0, "00:00"],
    [1, "00:01"],
    [60, "01:00"],
    [8 * 60, "08:00"],
    [9 * 60 + 30, "09:30"],
    [12 * 60, "12:00"],
    [23 * 60 + 59, "23:59"],
  ];

  for (const [minute, expected] of cases) {
    it(`${minute} → ${expected}`, () => {
      expect(minuteLabel(minute)).toBe(expected);
    });
  }

  it("wraps past midnight rather than producing a 25th hour", () => {
    expect(minuteLabel(24 * 60)).toBe("00:00");
    expect(minuteLabel(25 * 60)).toBe("01:00");
  });

  it("is always five characters, across the whole day", () => {
    for (let m = 0; m < 1440; m++) {
      expect(minuteLabel(m)).toMatch(/^\d{2}:\d{2}$/);
    }
  });
});

describe("spanLabel", () => {
  it("reads as the gym session does", () => {
    expect(spanLabel(8 * 60, 90)).toBe("08:00 – 09:30");
  });

  it("handles a block ending exactly on the hour", () => {
    expect(spanLabel(9 * 60, 60)).toBe("09:00 – 10:00");
  });
});

describe("parseMinute", () => {
  const valid: [string, number][] = [
    ["00:00", 0],
    ["08:00", 480],
    ["8:00", 480],
    ["09:30", 570],
    ["23:59", 1439],
    ["  08:00  ", 480],
  ];

  for (const [input, expected] of valid) {
    it(`${JSON.stringify(input)} → ${expected}`, () => {
      expect(parseMinute(input)).toBe(expected);
    });
  }

  const invalid = ["", "  ", "24:00", "08:60", "-1:00", "8", "eight", "08:0", null, undefined];
  for (const input of invalid) {
    it(`rejects ${JSON.stringify(input)}`, () => {
      expect(parseMinute(input)).toBe(null);
    });
  }

  it("round-trips through minuteLabel across the day", () => {
    for (let m = 0; m < 1440; m += 7) {
      expect(parseMinute(minuteLabel(m))).toBe(m);
    }
  });
});
