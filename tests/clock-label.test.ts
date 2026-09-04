import { describe, it, expect } from "vitest";
import { clockLabel, clockSpan, formatClock, blockTimes } from "@/lib/time";
import { minuteLabel, spanLabel } from "@/lib/projection";

/**
 * One clock, printed one way.
 *
 * Every label built from a number used to be 24-hour regardless of the
 * setting, so a reader on a 12-hour clock saw their scheduled blocks as
 * "01:30 pm" and everything else — the hour gutter, the routines, the
 * time dropdowns — as "13:30". These tests pin the two together.
 */
describe("clockLabel", () => {
  it("prints a 24-hour clock by default", () => {
    expect(clockLabel(0)).toBe("00:00");
    expect(clockLabel(9 * 60)).toBe("09:00");
    expect(clockLabel(13 * 60 + 30)).toBe("13:30");
    expect(clockLabel(23 * 60 + 30)).toBe("23:30");
  });

  it("prints a 12-hour clock when asked", () => {
    expect(clockLabel(0, "12")).toBe("12:00 am");
    expect(clockLabel(9 * 60, "12")).toBe("09:00 am");
    expect(clockLabel(12 * 60, "12")).toBe("12:00 pm");
    expect(clockLabel(13 * 60 + 30, "12")).toBe("01:30 pm");
  });

  it("agrees with formatClock for the same moment", () => {
    for (const minutes of [
      0,
      1,
      60,
      9 * 60 + 45,
      12 * 60,
      13 * 60 + 30,
      23 * 60 + 59,
    ]) {
      const at = new Date(
        Date.UTC(2026, 0, 1, Math.floor(minutes / 60), minutes % 60),
      );
      for (const format of ["12", "24"] as const) {
        expect(clockLabel(minutes, format)).toBe(
          formatClock(at, "UTC", format),
        );
      }
    }
  });

  it("wraps rather than printing an impossible hour", () => {
    expect(clockLabel(1440)).toBe("00:00");
    expect(clockLabel(1470)).toBe("00:30");
    expect(clockLabel(-30)).toBe("23:30");
  });
});

describe("clockSpan", () => {
  it("reads as a range in either clock", () => {
    expect(clockSpan(14 * 60, 120)).toBe("14:00 – 16:00");
    expect(clockSpan(14 * 60, 120, "12")).toBe("02:00 pm – 04:00 pm");
  });

  it("wraps past midnight rather than reaching hour 25", () => {
    expect(clockSpan(23 * 60, 120)).toBe("23:00 – 01:00");
  });
});

describe("the calendar's own labels", () => {
  it("still default to 24-hour, so nothing that parses them breaks", () => {
    expect(minuteLabel(13 * 60 + 30)).toBe("13:30");
    expect(spanLabel(8 * 60, 90)).toBe("08:00 – 09:30");
  });

  it("follow the reader when given a format", () => {
    expect(minuteLabel(13 * 60 + 30, "12")).toBe("01:30 pm");
    expect(spanLabel(8 * 60, 90, "12")).toBe("08:00 am – 09:30 am");
  });
});

/**
 * The Schedule panel's Start list.
 *
 * This is the dropdown the setting was reported broken on. It only
 * renders after pressing Schedule, so it never appears in the page's
 * first HTML and cannot be checked with a request — which is exactly why
 * it went wrong unnoticed. Checked here instead, at the source the
 * component renders from.
 */
describe("the Start-time list", () => {
  it("labels every option in 24-hour by default", () => {
    const times = blockTimes();
    expect(times[0].label).toBe("06:00");
    expect(times[1].label).toBe("06:30");
    expect(times.at(-1)!.label).toBe("23:30");
  });

  it("labels every option in 12-hour when asked", () => {
    const times = blockTimes("12");
    expect(times[0].label).toBe("06:00 am");
    expect(times.find((t) => t.hour === 13 && t.minute === 30)!.label).toBe(
      "01:30 pm",
    );
    expect(times.find((t) => t.hour === 12 && t.minute === 0)!.label).toBe(
      "12:00 pm",
    );
    expect(times.at(-1)!.label).toBe("11:30 pm");
  });

  /**
   * The label is what someone reads; hour and minute are what gets
   * posted. Changing the clock must move the first and never the second,
   * or picking a time in the afternoon would save it in the morning.
   */
  it("keeps the posted values identical whatever the clock says", () => {
    const a = blockTimes("24");
    const b = blockTimes("12");
    expect(a.map((t) => [t.hour, t.minute])).toEqual(
      b.map((t) => [t.hour, t.minute]),
    );
    expect(a.map((t) => t.label)).not.toEqual(b.map((t) => t.label));
  });

  it("covers a plausible day in half hours, and no more", () => {
    const times = blockTimes();
    expect(times).toHaveLength(36);
    expect(times.every((t) => t.minute === 0 || t.minute === 30)).toBe(true);
    expect(Math.min(...times.map((t) => t.hour))).toBe(6);
    expect(Math.max(...times.map((t) => t.hour))).toBe(23);
  });
});
