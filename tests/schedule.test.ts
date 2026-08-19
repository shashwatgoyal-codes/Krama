import { describe, it, expect } from "vitest";
import { scheduleAtSchema } from "@/lib/validation";
import { BLOCK_MINUTES } from "@/lib/time";

const VALID = {
  id: "cmsupsrv50000nvit7rmxdryh",
  dayKey: "2026-08-18",
  hour: "14",
  minute: "30",
  durationMinutes: "120",
};

describe("scheduleAtSchema", () => {
  it("accepts a date, time and length chosen from the form", () => {
    const parsed = scheduleAtSchema.parse(VALID);
    expect(parsed).toMatchObject({
      dayKey: "2026-08-18",
      hour: 14,
      minute: 30,
      durationMinutes: 120,
    });
  });

  it("coerces the form's strings to numbers", () => {
    const parsed = scheduleAtSchema.parse(VALID);
    expect(typeof parsed.hour).toBe("number");
    expect(typeof parsed.minute).toBe("number");
  });

  it("accepts every length the picker offers", () => {
    for (const m of BLOCK_MINUTES) {
      expect(
        scheduleAtSchema.safeParse({ ...VALID, durationMinutes: String(m) })
          .success,
      ).toBe(true);
    }
  });

  it("rejects a length the picker never offered", () => {
    // A hand-crafted post could otherwise create a 7-minute or 40-hour
    // block, neither of which the grid can draw honestly.
    for (const m of ["7", "1000", "0", "-30"]) {
      expect(
        scheduleAtSchema.safeParse({ ...VALID, durationMinutes: m }).success,
      ).toBe(false);
    }
  });

  it("rejects a malformed date", () => {
    for (const d of ["18-08-2026", "2026/08/18", "tomorrow", ""]) {
      expect(scheduleAtSchema.safeParse({ ...VALID, dayKey: d }).success).toBe(
        false,
      );
    }
  });

  it("accepts the edges of the clock and rejects what's past them", () => {
    expect(
      scheduleAtSchema.safeParse({ ...VALID, hour: "0", minute: "0" }).success,
    ).toBe(true);
    expect(
      scheduleAtSchema.safeParse({ ...VALID, hour: "23", minute: "59" }).success,
    ).toBe(true);
    expect(scheduleAtSchema.safeParse({ ...VALID, hour: "24" }).success).toBe(
      false,
    );
    expect(scheduleAtSchema.safeParse({ ...VALID, minute: "60" }).success).toBe(
      false,
    );
  });

  it("rejects an id that isn't one of ours", () => {
    expect(scheduleAtSchema.safeParse({ ...VALID, id: "1 OR 1=1" }).success).toBe(
      false,
    );
  });
});
