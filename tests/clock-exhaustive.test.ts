import { describe, it, expect } from "vitest";
import { clockLabel, clockSpan, formatClock, blockTimes } from "@/lib/time";
import { minuteLabel } from "@/lib/projection";

/**
 * Every minute of the day, in both clocks.
 *
 * The bug this guards was not a wrong label — it was two formatters
 * disagreeing. Blocks went through Intl and honoured the reader's
 * setting; the hour gutter, the routines and the time dropdowns built
 * their strings by hand and always said 24-hour. Both were "correct" in
 * isolation, and together they printed the same instant two ways on one
 * screen.
 *
 * So the assertion that matters is agreement, checked for all 1,440
 * minutes rather than the handful anyone would think to pick.
 */

const MINUTES = Array.from({ length: 1440 }, (_, i) => i);

/** The same instant formatClock would be given for that many minutes. */
function instant(minutes: number): Date {
  return new Date(Date.UTC(2026, 0, 1, Math.floor(minutes / 60), minutes % 60));
}

describe("clockLabel agrees with formatClock, minute by minute", () => {
  it.each(MINUTES)("minute %i, 24-hour", (m) => {
    expect(clockLabel(m, "24")).toBe(formatClock(instant(m), "UTC", "24"));
  });

  it.each(MINUTES)("minute %i, 12-hour", (m) => {
    expect(clockLabel(m, "12")).toBe(formatClock(instant(m), "UTC", "12"));
  });
});

describe("the shape of a 24-hour label", () => {
  it.each(MINUTES)("minute %i reads HH:MM", (m) => {
    const label = clockLabel(m, "24");
    expect(label).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    expect(Number(label.slice(0, 2)) * 60 + Number(label.slice(3))).toBe(m);
  });
});

describe("the shape of a 12-hour label", () => {
  it.each(MINUTES)("minute %i reads hh:mm am/pm", (m) => {
    const label = clockLabel(m, "12");
    expect(label).toMatch(/^(0[1-9]|1[0-2]):[0-5]\d (am|pm)$/);
    // Noon and midnight are the two everyone gets wrong.
    const half = m < 720 ? "am" : "pm";
    expect(label.endsWith(half)).toBe(true);
  });
});

describe("minuteLabel is the same function", () => {
  it.each(MINUTES.filter((m) => m % 7 === 0))("minute %i matches", (m) => {
    expect(minuteLabel(m, "24")).toBe(clockLabel(m, "24"));
    expect(minuteLabel(m, "12")).toBe(clockLabel(m, "12"));
  });
});

describe("labels never repeat within a day", () => {
  it("24-hour gives 1,440 distinct labels", () => {
    expect(new Set(MINUTES.map((m) => clockLabel(m, "24"))).size).toBe(1440);
  });

  it("12-hour gives 1,440 distinct labels", () => {
    expect(new Set(MINUTES.map((m) => clockLabel(m, "12"))).size).toBe(1440);
  });
});

describe("wrapping past the end of the day", () => {
  it.each(MINUTES.filter((m) => m % 11 === 0))(
    "minute %i and the same minute a day later read alike",
    (m) => {
      expect(clockLabel(m + 1440, "24")).toBe(clockLabel(m, "24"));
      expect(clockLabel(m - 1440, "12")).toBe(clockLabel(m, "12"));
    },
  );
});

describe("spans", () => {
  it.each(MINUTES.filter((m) => m % 13 === 0))(
    "a 90-minute block from minute %i reads as its two ends",
    (m) => {
      expect(clockSpan(m, 90, "24")).toBe(
        `${clockLabel(m, "24")} – ${clockLabel(m + 90, "24")}`,
      );
    },
  );
});

describe("the Start-time list", () => {
  const list24 = blockTimes("24");
  const list12 = blockTimes("12");

  it.each(list24.map((t, i) => [i, t] as const))(
    "option %i labels the value it posts",
    (i, t) => {
      expect(t.label).toBe(clockLabel(t.hour * 60 + t.minute, "24"));
      expect(list12[i].hour).toBe(t.hour);
      expect(list12[i].minute).toBe(t.minute);
    },
  );
});
