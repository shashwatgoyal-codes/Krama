import { describe, it, expect } from "vitest";
import {
  zoneOffsetMs,
  zonedTimeToInstant,
  dayWindow,
  formatClock,
  hourIn,
  minutesBetween,
  formatDuration,
  BLOCK_MINUTES,
} from "@/lib/time";

/**
 * Time zones and daylight saving, across a wide spread of both.
 *
 * The hard part of this module is that a wall-clock time does not
 * identify an instant until you know the offset, and the offset depends
 * on the instant — which is why zonedTimeToInstant makes two passes.
 * Testing it in one zone with no DST proves nothing, so this sweeps
 * zones on both sides of the equator, ones with half-hour and
 * three-quarter-hour offsets, and the two days a year when the naive
 * implementation is wrong by an hour.
 */

const ZONES = [
  "UTC",
  "Asia/Kolkata", // +05:30, no DST
  "Asia/Kathmandu", // +05:45, the awkward one
  "America/New_York", // DST, northern
  "Europe/London", // DST, near the meridian
  "Europe/Berlin",
  "Australia/Sydney", // DST, southern — shifts the other way
  "Pacific/Auckland",
  "America/Los_Angeles",
  "Asia/Tokyo", // no DST
  "Africa/Nairobi",
  "America/Sao_Paulo",
  "Pacific/Kiritimati", // +14, the far edge
  "Pacific/Niue", // -11, the other far edge
];

describe("zoneOffsetMs", () => {
  for (const zone of ZONES) {
    it(`returns a whole number of minutes for ${zone}`, () => {
      const offset = zoneOffsetMs(new Date("2026-08-17T12:00:00Z"), zone);
      // `|| 0` normalises negative zero: a west-of-Greenwich offset
      // divides to -0, which Object.is treats as a different value.
      expect(offset % 60_000 || 0).toBe(0);
    });
  }

  for (const zone of ZONES) {
    it(`stays within ±14 hours for ${zone}`, () => {
      for (const month of [0, 3, 6, 9]) {
        const at = new Date(Date.UTC(2026, month, 15, 12));
        const hours = zoneOffsetMs(at, zone) / 3_600_000;
        expect(hours).toBeGreaterThanOrEqual(-12);
        expect(hours).toBeLessThanOrEqual(14);
      }
    });
  }

  it("is zero for UTC all year round", () => {
    for (let month = 0; month < 12; month++) {
      expect(zoneOffsetMs(new Date(Date.UTC(2026, month, 15)), "UTC")).toBe(0);
    }
  });

  it("is exactly five and a half hours for Kolkata, which has no DST", () => {
    for (let month = 0; month < 12; month++) {
      expect(
        zoneOffsetMs(new Date(Date.UTC(2026, month, 15)), "Asia/Kolkata"),
      ).toBe(5.5 * 3_600_000);
    }
  });

  it("changes across the year in a zone that observes DST", () => {
    const winter = zoneOffsetMs(
      new Date("2026-01-15T12:00:00Z"),
      "America/New_York",
    );
    const summer = zoneOffsetMs(
      new Date("2026-07-15T12:00:00Z"),
      "America/New_York",
    );
    expect(winter).not.toBe(summer);
  });

  it("changes the opposite way in the southern hemisphere", () => {
    const january = zoneOffsetMs(
      new Date("2026-01-15T12:00:00Z"),
      "Australia/Sydney",
    );
    const july = zoneOffsetMs(
      new Date("2026-07-15T12:00:00Z"),
      "Australia/Sydney",
    );
    expect(january).toBeGreaterThan(july);
  });
});

describe("zonedTimeToInstant", () => {
  for (const zone of ZONES) {
    it(`round-trips every hour of a day in ${zone}`, () => {
      for (let hour = 0; hour < 24; hour++) {
        const instant = zonedTimeToInstant("2026-08-17", hour, 0, zone);
        expect(hourIn(instant, zone)).toBe(hour);
      }
    });
  }

  for (const zone of ZONES) {
    it(`round-trips assorted minutes in ${zone}`, () => {
      for (const minute of [0, 1, 15, 30, 45, 59]) {
        const instant = zonedTimeToInstant("2026-08-17", 9, minute, zone);
        const clock = formatClock(instant, zone);
        expect(clock.slice(3, 5)).toBe(String(minute).padStart(2, "0"));
      }
    });
  }

  for (const zone of ZONES) {
    it(`produces a valid instant on every month boundary in ${zone}`, () => {
      for (let month = 1; month <= 12; month++) {
        const key = `2026-${String(month).padStart(2, "0")}-01`;
        const at = zonedTimeToInstant(key, 12, 0, zone);
        expect(Number.isNaN(at.getTime())).toBe(false);
      }
    });
  }

  it("is monotonic: a later wall clock is a later instant", () => {
    for (const zone of ZONES) {
      let previous = -Infinity;
      for (let hour = 0; hour < 24; hour++) {
        const at = zonedTimeToInstant("2026-06-15", hour, 0, zone).getTime();
        expect(at).toBeGreaterThan(previous);
        previous = at;
      }
    }
  });

  // The spring-forward and autumn-back days, when the offset changes
  // mid-day and a single-pass conversion is an hour out.
  const dstDays: [string, string][] = [
    ["America/New_York", "2026-03-08"],
    ["America/New_York", "2026-11-01"],
    ["Europe/London", "2026-03-29"],
    ["Europe/London", "2026-10-25"],
    ["Australia/Sydney", "2026-04-05"],
    ["Australia/Sydney", "2026-10-04"],
    ["Europe/Berlin", "2026-03-29"],
    ["America/Los_Angeles", "2026-03-08"],
  ];

  for (const [zone, day] of dstDays) {
    it(`survives the clock change in ${zone} on ${day}`, () => {
      for (let hour = 0; hour < 24; hour++) {
        const at = zonedTimeToInstant(day, hour, 0, zone);
        expect(Number.isNaN(at.getTime())).toBe(false);
      }
    });
  }

  for (const [zone, day] of dstDays) {
    it(`keeps the day 23, 24 or 25 hours long in ${zone} on ${day}`, () => {
      const start = zonedTimeToInstant(day, 0, 0, zone);
      const [y, m, d] = day.split("-").map(Number);
      const nextKey = new Date(Date.UTC(y, m - 1, d + 1))
        .toISOString()
        .slice(0, 10);
      const end = zonedTimeToInstant(nextKey, 0, 0, zone);
      const hours = (end.getTime() - start.getTime()) / 3_600_000;
      expect([23, 24, 25]).toContain(hours);
    });
  }
});

describe("dayWindow", () => {
  for (const zone of ZONES) {
    it(`opens before it closes in ${zone}`, () => {
      for (const hour of [0, 4, 6, 12]) {
        const { start, end } = dayWindow("2026-08-17", zone, hour);
        expect(end.getTime()).toBeGreaterThan(start.getTime());
      }
    });
  }

  for (const zone of ZONES) {
    it(`spans roughly one day in ${zone}`, () => {
      const { start, end } = dayWindow("2026-08-17", zone, 4);
      const hours = (end.getTime() - start.getTime()) / 3_600_000;
      expect(hours).toBeGreaterThanOrEqual(23);
      expect(hours).toBeLessThanOrEqual(25);
    });
  }

  it("makes consecutive windows meet exactly, leaving no gap and no overlap", () => {
    for (const zone of ZONES) {
      const first = dayWindow("2026-08-17", zone, 4);
      const second = dayWindow("2026-08-18", zone, 4);
      expect(second.start.getTime()).toBe(first.end.getTime());
    }
  });
});

describe("formatClock", () => {
  it("is always five characters in 24-hour form", () => {
    for (const zone of ZONES) {
      for (let hour = 0; hour < 24; hour++) {
        const at = zonedTimeToInstant("2026-08-17", hour, 30, zone);
        expect(formatClock(at, zone)).toMatch(/^\d{2}:\d{2}$/);
      }
    }
  });

  it("pads the hour, so the grid lines up", () => {
    const at = zonedTimeToInstant("2026-08-17", 9, 5, "UTC");
    expect(formatClock(at, "UTC")).toBe("09:05");
  });

  it("differs between the 12- and 24-hour forms in the afternoon", () => {
    const at = zonedTimeToInstant("2026-08-17", 15, 0, "UTC");
    expect(formatClock(at, "UTC", "24")).not.toBe(formatClock(at, "UTC", "12"));
  });
});

describe("hourIn", () => {
  it("agrees with what was asked for, in every zone and hour", () => {
    for (const zone of ZONES) {
      for (let hour = 0; hour < 24; hour++) {
        const at = zonedTimeToInstant("2026-08-17", hour, 0, zone);
        expect(hourIn(at, zone)).toBe(hour);
      }
    }
  });
});

describe("minutesBetween", () => {
  it("counts whole minutes", () => {
    for (const minutes of [0, 1, 15, 30, 60, 90, 240, 1440]) {
      const start = new Date("2026-08-17T00:00:00Z");
      const end = new Date(start.getTime() + minutes * 60_000);
      expect(minutesBetween(start, end)).toBe(minutes);
    }
  });

  it("never returns a negative span", () => {
    const later = new Date("2026-08-17T12:00:00Z");
    const earlier = new Date("2026-08-17T09:00:00Z");
    expect(minutesBetween(later, earlier)).toBe(0);
  });

  it("is zero for the same instant", () => {
    const at = new Date("2026-08-17T12:00:00Z");
    expect(minutesBetween(at, at)).toBe(0);
  });
});

describe("formatDuration", () => {
  const cases: [number, string][] = [
    [0, "0m"],
    [-10, "0m"],
    [1, "1m"],
    [15, "15m"],
    [30, "30m"],
    [45, "45m"],
    [59, "59m"],
    [60, "1h"],
    [61, "1h 1m"],
    [90, "1h 30m"],
    [120, "2h"],
    [125, "2h 5m"],
    [180, "3h"],
    [240, "4h"],
    [255, "4h 15m"],
    [1440, "24h"],
  ];

  for (const [minutes, expected] of cases) {
    it(`${minutes} → ${expected}`, () => {
      expect(formatDuration(minutes)).toBe(expected);
    });
  }

  it("never returns an empty string, for any input up to a week", () => {
    for (let minutes = -100; minutes <= 10_080; minutes += 7) {
      expect(formatDuration(minutes).length).toBeGreaterThan(0);
    }
  });

  it("formats every offered block length", () => {
    for (const minutes of BLOCK_MINUTES) {
      expect(formatDuration(minutes)).toMatch(/^(\d+h( \d+m)?|\d+m)$/);
    }
  });
});
