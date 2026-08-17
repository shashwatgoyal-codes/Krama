import { describe, it, expect } from "vitest";
import { computeStreak } from "@/lib/streak";
import { shiftDayKey, weekdayOf } from "@/lib/day";

/**
 * The streak, across many shapes of week.
 *
 * A streak is the one number in the app people take personally, and it
 * is derived from the ledger on every read rather than stored — so the
 * failure mode is not a stale counter but a rule applied inconsistently
 * at the edges: the day that is still in progress, the rest day that
 * happens to be worked, the gap that falls on a weekend.
 *
 * These build day patterns programmatically and assert the rule holds
 * for every one, rather than hand-picking three friendly weeks.
 */

const TODAY = "2026-08-17"; // a Monday

/** Turns "1110111" into a day map ending today, most recent last. */
function pattern(bits: string, perDay = 1): Record<string, number> {
  const out: Record<string, number> = {};
  const days = bits.length;
  for (let i = 0; i < days; i++) {
    const key = shiftDayKey(TODAY, -(days - 1 - i));
    out[key] = bits[i] === "1" ? perDay : 0;
  }
  return out;
}

describe("computeStreak — the floor", () => {
  for (let floor = 1; floor <= 10; floor++) {
    it(`counts a day that exactly meets a floor of ${floor}`, () => {
      const result = computeStreak({
        today: TODAY,
        actionsByDay: { [TODAY]: floor },
        dailyFloor: floor,
        restDays: [],
      });
      expect(result.clearedToday).toBe(true);
      expect(result.days).toBe(1);
    });
  }

  for (let floor = 2; floor <= 10; floor++) {
    it(`does not count a day one short of a floor of ${floor}`, () => {
      const result = computeStreak({
        today: TODAY,
        actionsByDay: { [TODAY]: floor - 1 },
        dailyFloor: floor,
        restDays: [],
      });
      expect(result.clearedToday).toBe(false);
    });
  }

  it("treats a floor of zero as a floor of one, or every day in history counts", () => {
    const result = computeStreak({
      today: TODAY,
      actionsByDay: {},
      dailyFloor: 0,
      restDays: [],
      maxLookback: 30,
    });
    expect(result.days).toBe(0);
  });

  it("treats a negative floor the same way", () => {
    const result = computeStreak({
      today: TODAY,
      actionsByDay: {},
      dailyFloor: -5,
      restDays: [],
      maxLookback: 30,
    });
    expect(result.days).toBe(0);
  });
});

describe("computeStreak — unbroken runs", () => {
  for (let length = 1; length <= 40; length++) {
    it(`counts a run of ${length} days`, () => {
      const result = computeStreak({
        today: TODAY,
        actionsByDay: pattern("1".repeat(length)),
        dailyFloor: 1,
        restDays: [],
      });
      expect(result.days).toBe(length);
    });
  }
});

describe("computeStreak — where the run breaks", () => {
  for (let gapAt = 1; gapAt <= 10; gapAt++) {
    it(`stops at a gap ${gapAt} days back`, () => {
      // gapAt days of work, then a missed day, then more work behind it.
      const bits = "1".repeat(5) + "0" + "1".repeat(gapAt);
      const result = computeStreak({
        today: TODAY,
        actionsByDay: pattern(bits),
        dailyFloor: 1,
        restDays: [],
      });
      expect(result.days).toBe(gapAt);
    });
  }

  it("returns zero when yesterday and today are both empty", () => {
    const result = computeStreak({
      today: TODAY,
      actionsByDay: pattern("111100"),
      dailyFloor: 1,
      restDays: [],
    });
    expect(result.days).toBe(0);
  });

  it("returns zero for an entirely empty history", () => {
    for (const lookback of [7, 30, 365]) {
      const result = computeStreak({
        today: TODAY,
        actionsByDay: {},
        dailyFloor: 1,
        restDays: [],
        maxLookback: lookback,
      });
      expect(result.days).toBe(0);
    }
  });
});

describe("computeStreak — today is still in progress", () => {
  it("does not end a streak just because today is not done yet", () => {
    for (let length = 1; length <= 20; length++) {
      const result = computeStreak({
        today: TODAY,
        actionsByDay: pattern("1".repeat(length) + "0"),
        dailyFloor: 1,
        restDays: [],
      });
      expect(result.days).toBe(length);
      expect(result.clearedToday).toBe(false);
    }
  });

  it("flags a live streak with today unmet as at risk", () => {
    const result = computeStreak({
      today: TODAY,
      actionsByDay: pattern("11110"),
      dailyFloor: 1,
      restDays: [],
    });
    expect(result.atRisk).toBe(true);
  });

  it("does not flag a streak that today has already cleared", () => {
    const result = computeStreak({
      today: TODAY,
      actionsByDay: pattern("11111"),
      dailyFloor: 1,
      restDays: [],
    });
    expect(result.atRisk).toBe(false);
  });

  it("does not flag a streak of zero as at risk", () => {
    const result = computeStreak({
      today: TODAY,
      actionsByDay: {},
      dailyFloor: 1,
      restDays: [],
    });
    expect(result.atRisk).toBe(false);
  });
});

describe("computeStreak — rest days", () => {
  for (let day = 0; day <= 6; day++) {
    it(`does not break the streak on an unworked weekday ${day}`, () => {
      // 21 days where the rest day is always missed.
      const actions: Record<string, number> = {};
      for (let back = 0; back < 21; back++) {
        const key = shiftDayKey(TODAY, -back);
        actions[key] = weekdayOf(key) === day ? 0 : 1;
      }

      const result = computeStreak({
        today: TODAY,
        actionsByDay: actions,
        dailyFloor: 1,
        restDays: [day],
      });

      // Nothing broke it, so the run reaches back through the window.
      expect(result.days).toBeGreaterThanOrEqual(17);
    });
  }

  it("counts a rest day that was worked anyway", () => {
    const actions: Record<string, number> = {};
    for (let back = 0; back < 14; back++) {
      actions[shiftDayKey(TODAY, -back)] = 1;
    }
    const result = computeStreak({
      today: TODAY,
      actionsByDay: actions,
      dailyFloor: 1,
      restDays: [0, 6],
    });
    expect(result.days).toBe(14);
  });

  it("is never at risk on a rest day", () => {
    const restToday = weekdayOf(TODAY);
    const result = computeStreak({
      today: TODAY,
      actionsByDay: pattern("11110"),
      dailyFloor: 1,
      restDays: [restToday],
    });
    expect(result.atRisk).toBe(false);
  });

  it("still breaks on a worked-day gap even with rest days configured", () => {
    // A Tuesday gap, with Sunday and Saturday as the rest days.
    const actions: Record<string, number> = {};
    for (let back = 0; back < 14; back++) {
      const key = shiftDayKey(TODAY, -back);
      actions[key] = weekdayOf(key) === 2 ? 0 : 1;
    }
    const result = computeStreak({
      today: TODAY,
      actionsByDay: actions,
      dailyFloor: 1,
      restDays: [0, 6],
    });
    expect(result.days).toBeLessThan(14);
  });
});

describe("computeStreak — invariants across many patterns", () => {
  // Every 8-bit pattern: 256 different shapes of the last eight days.
  const patterns: string[] = [];
  for (let n = 0; n < 256; n++) {
    patterns.push(n.toString(2).padStart(8, "0"));
  }

  it("never reports a negative streak", () => {
    for (const bits of patterns) {
      const result = computeStreak({
        today: TODAY,
        actionsByDay: pattern(bits),
        dailyFloor: 1,
        restDays: [],
      });
      expect(result.days).toBeGreaterThanOrEqual(0);
    }
  });

  it("never reports more days than there are days", () => {
    for (const bits of patterns) {
      const result = computeStreak({
        today: TODAY,
        actionsByDay: pattern(bits),
        dailyFloor: 1,
        restDays: [],
      });
      expect(result.days).toBeLessThanOrEqual(8);
    }
  });

  it("reports clearedToday exactly when the last day is worked", () => {
    for (const bits of patterns) {
      const result = computeStreak({
        today: TODAY,
        actionsByDay: pattern(bits),
        dailyFloor: 1,
        restDays: [],
      });
      expect(result.clearedToday).toBe(bits.endsWith("1"));
    }
  });

  it("only flags at risk when there is a streak and today is unmet", () => {
    for (const bits of patterns) {
      const result = computeStreak({
        today: TODAY,
        actionsByDay: pattern(bits),
        dailyFloor: 1,
        restDays: [],
      });
      if (result.atRisk) {
        expect(result.days).toBeGreaterThan(0);
        expect(result.clearedToday).toBe(false);
      }
    }
  });

  it("raising the floor can never lengthen a streak", () => {
    for (const bits of patterns) {
      const actions = pattern(bits, 3);
      const low = computeStreak({
        today: TODAY,
        actionsByDay: actions,
        dailyFloor: 1,
        restDays: [],
      }).days;
      const high = computeStreak({
        today: TODAY,
        actionsByDay: actions,
        dailyFloor: 3,
        restDays: [],
      }).days;
      expect(high).toBeLessThanOrEqual(low);
    }
  });

  it("doing more work can never shorten a streak", () => {
    for (const bits of patterns) {
      const sparse = computeStreak({
        today: TODAY,
        actionsByDay: pattern(bits, 1),
        dailyFloor: 1,
        restDays: [],
      }).days;
      const dense = computeStreak({
        today: TODAY,
        actionsByDay: pattern(bits, 10),
        dailyFloor: 1,
        restDays: [],
      }).days;
      expect(dense).toBeGreaterThanOrEqual(sparse);
    }
  });
});
