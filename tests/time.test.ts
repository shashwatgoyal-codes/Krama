import { describe, it, expect } from "vitest";
import {
  zoneOffsetMs,
  zonedTimeToInstant,
  dayWindow,
  formatClock,
  formatDuration,
  minutesBetween,
  totalCommitted,
  nextFreeSlot,
  hourIn,
} from "@/lib/time";

const IST = "Asia/Kolkata";
const NY = "America/New_York";
const HOUR = 3600_000;

describe("zoneOffsetMs", () => {
  it("gets India's half-hour offset right", () => {
    const at = new Date("2026-08-15T00:00:00.000Z");
    expect(zoneOffsetMs(at, IST)).toBe(5.5 * HOUR);
  });

  it("follows New York across a daylight-saving change", () => {
    expect(zoneOffsetMs(new Date("2026-01-15T12:00:00.000Z"), NY)).toBe(-5 * HOUR);
    expect(zoneOffsetMs(new Date("2026-07-15T12:00:00.000Z"), NY)).toBe(-4 * HOUR);
  });

  it("is zero for UTC", () => {
    expect(zoneOffsetMs(new Date("2026-08-15T00:00:00.000Z"), "UTC")).toBe(0);
  });
});

describe("zonedTimeToInstant", () => {
  it("maps 10:00 in India to the right instant", () => {
    const at = zonedTimeToInstant("2026-08-15", 10, 0, IST);
    expect(at.toISOString()).toBe("2026-08-15T04:30:00.000Z");
  });

  it("maps 10:00 in New York in summer and in winter", () => {
    expect(zonedTimeToInstant("2026-07-15", 10, 0, NY).toISOString()).toBe(
      "2026-07-15T14:00:00.000Z",
    );
    expect(zonedTimeToInstant("2026-01-15", 10, 0, NY).toISOString()).toBe(
      "2026-01-15T15:00:00.000Z",
    );
  });

  it("round-trips through formatClock", () => {
    for (const zone of [IST, NY, "UTC", "Australia/Sydney"]) {
      for (const hour of [0, 6, 13, 23]) {
        const at = zonedTimeToInstant("2026-08-15", hour, 30, zone);
        expect(formatClock(at, zone)).toBe(
          `${String(hour).padStart(2, "0")}:30`,
        );
      }
    }
  });

  it("survives the day New York springs forward", () => {
    // 02:00 doesn't exist on 8 March 2026 in New York. The important
    // thing is that it resolves to a real instant rather than NaN.
    const at = zonedTimeToInstant("2026-03-08", 2, 0, NY);
    expect(Number.isNaN(at.getTime())).toBe(false);
  });
});

describe("dayWindow", () => {
  it("runs from the day-end hour to the same hour tomorrow", () => {
    const { start, end } = dayWindow("2026-08-15", IST, 4);
    expect(formatClock(start, IST)).toBe("04:00");
    expect(formatClock(end, IST)).toBe("04:00");
    expect(end.getTime() - start.getTime()).toBe(24 * HOUR);
  });

  it("puts a 01:00 block on the night before, matching the scoring", () => {
    // The whole reason the boundary exists: work finished at 1am belongs
    // to the day you were still awake for.
    const { start, end } = dayWindow("2026-08-15", IST, 4);
    const lateNight = zonedTimeToInstant("2026-08-16", 1, 0, IST);
    expect(lateNight >= start && lateNight < end).toBe(true);
  });

  it("handles a midnight boundary as an ordinary calendar day", () => {
    const { start, end } = dayWindow("2026-08-15", IST, 0);
    expect(formatClock(start, IST)).toBe("00:00");
    expect(end.getTime() - start.getTime()).toBe(24 * HOUR);
  });

  it("crosses a month end without losing a day", () => {
    const { start, end } = dayWindow("2026-08-31", IST, 4);
    expect(end.getTime() - start.getTime()).toBe(24 * HOUR);
  });
});

describe("formatDuration", () => {
  it("matches the shorthand the design uses", () => {
    expect(formatDuration(30)).toBe("30m");
    expect(formatDuration(45)).toBe("45m");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
    expect(formatDuration(135)).toBe("2h 15m");
  });

  it("does not render a negative or empty span as time", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(-10)).toBe("0m");
  });
});

describe("totalCommitted", () => {
  it("reproduces the design's own figure", () => {
    // The design's Today screen shows four blocks — 30m, 1h, 2h, 45m —
    // and a header reading "4h 15m committed".
    const at = (h: number, m = 0) => zonedTimeToInstant("2026-08-15", h, m, IST);
    const blocks = [
      { startsAt: at(10), endsAt: at(10, 30) },
      { startsAt: at(11), endsAt: at(12) },
      { startsAt: at(14), endsAt: at(16) },
      { startsAt: at(20), endsAt: at(20, 45) },
    ];
    expect(totalCommitted(blocks)).toBe("4h 15m");
  });

  it("is zero for an empty plan", () => {
    expect(totalCommitted([])).toBe("0m");
  });
});

describe("minutesBetween and hourIn", () => {
  it("measures a span in minutes", () => {
    const a = new Date("2026-08-15T10:00:00.000Z");
    const b = new Date("2026-08-15T11:30:00.000Z");
    expect(minutesBetween(a, b)).toBe(90);
  });

  it("reads the wall-clock hour in the user's zone, not UTC", () => {
    const at = new Date("2026-08-15T04:30:00.000Z");
    expect(hourIn(at, IST)).toBe(10);
    expect(hourIn(at, "UTC")).toBe(4);
  });
});

describe("nextFreeSlot", () => {
  const at = (h: number, m = 0) => zonedTimeToInstant("2026-08-15", h, m, IST);
  const base = {
    dayKey: "2026-08-15",
    timeZone: IST,
    durationMinutes: 60,
  };

  it("starts at the next half hour on an empty day", () => {
    const slot = nextFreeSlot([], { ...base, now: at(10, 12) });
    expect(formatClock(slot.start, IST)).toBe("10:30");
    expect(formatClock(slot.end, IST)).toBe("11:30");
  });

  it("waits for the working day when asked early in the morning", () => {
    const slot = nextFreeSlot([], { ...base, now: at(6, 0) });
    expect(formatClock(slot.start, IST)).toBe("09:00");
  });

  it("does not stack a block on top of an existing one", () => {
    const booked = [{ startsAt: at(10, 30), endsAt: at(12, 0) }];
    const slot = nextFreeSlot(booked, { ...base, now: at(10, 10) });
    expect(formatClock(slot.start, IST)).toBe("12:00");
  });

  it("steps over a run of back-to-back blocks", () => {
    const booked = [
      { startsAt: at(9, 0), endsAt: at(10, 0) },
      { startsAt: at(10, 0), endsAt: at(11, 0) },
      { startsAt: at(11, 0), endsAt: at(12, 30) },
    ];
    const slot = nextFreeSlot(booked, { ...base, now: at(9, 0) });
    expect(formatClock(slot.start, IST)).toBe("12:30");
  });

  it("uses a gap that is big enough rather than going to the end", () => {
    const booked = [
      { startsAt: at(9, 0), endsAt: at(10, 0) },
      { startsAt: at(14, 0), endsAt: at(15, 0) },
    ];
    const slot = nextFreeSlot(booked, { ...base, now: at(9, 30) });
    expect(formatClock(slot.start, IST)).toBe("10:00");
  });

  it("still places a block when the day is already full", () => {
    // Refusing would mean a drag that silently does nothing, which reads
    // as a bug however correct it is.
    const booked = [{ startsAt: at(9, 0), endsAt: at(22, 0) }];
    const slot = nextFreeSlot(booked, { ...base, now: at(9, 0) });
    expect(slot.end.getTime()).toBeGreaterThan(slot.start.getTime());
    expect(formatClock(slot.start, IST)).toBe("21:00");
  });

  it("gives a longer task a longer block", () => {
    const slot = nextFreeSlot([], {
      ...base,
      now: at(10, 0),
      durationMinutes: 120,
    });
    expect(minutesBetween(slot.start, slot.end)).toBe(120);
  });
});
