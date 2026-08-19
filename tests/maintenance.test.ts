import { describe, it, expect } from "vitest";
import { reminderDue } from "@/lib/repositories/maintenance";

/**
 * Reminders are shown when you next open the app after the time you set,
 * because there is no scheduler to push them. That makes "is it due?" a
 * plain string comparison on HH:MM — which only works because both sides
 * are zero-padded 24-hour, so it is worth pinning.
 */
describe("reminderDue", () => {
  it("is not due before the time", () => {
    expect(reminderDue("08:30", "07:59")).toBe(false);
  });

  it("is due at the time and after it", () => {
    expect(reminderDue("08:30", "08:30")).toBe(true);
    expect(reminderDue("08:30", "21:00")).toBe(true);
  });

  it("compares correctly across the 09/10 boundary", () => {
    // The classic string-comparison trap: "9:30" > "10:00" is true.
    // Zero-padding is what keeps this honest.
    expect(reminderDue("09:30", "10:00")).toBe(true);
    expect(reminderDue("10:00", "09:30")).toBe(false);
  });

  it("is never due when no reminder is set", () => {
    expect(reminderDue(null, "23:59")).toBe(false);
  });

  it("handles midnight without wrapping", () => {
    expect(reminderDue("00:00", "00:00")).toBe(true);
    expect(reminderDue("23:00", "00:30")).toBe(false);
  });
});
