import { describe, it, expect } from "vitest";
import {
  isValidTimeZone,
  nameSchema,
  dayScheduleSchema,
  scoringSchema,
  changePasswordSchema,
  deleteAccountSchema,
  profileTabSchema,
} from "@/lib/validation";
import { describeZone } from "@/lib/timezones";

describe("isValidTimeZone", () => {
  it("accepts real IANA zones", () => {
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
  });

  it("rejects anything the platform doesn't know", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("Asia/Kolkatta")).toBe(false);
  });

  it("accepts legacy abbreviations, which resolve to real zones", () => {
    // Not reachable from the dropdown, which only lists canonical zones,
    // but a hand-crafted post can send one. Allowed on purpose: ICU maps
    // them to genuine zones, so the date maths still works.
    expect(isValidTimeZone("IST")).toBe(true);
  });
});

describe("nameSchema", () => {
  it("trims surrounding whitespace", () => {
    expect(nameSchema.parse({ name: "  Shashwat  " }).name).toBe("Shashwat");
  });

  it("rejects a name that is only whitespace", () => {
    expect(nameSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects a name over 80 characters", () => {
    expect(nameSchema.safeParse({ name: "a".repeat(81) }).success).toBe(false);
  });
});

describe("dayScheduleSchema", () => {
  it("accepts a valid zone and hour", () => {
    const r = dayScheduleSchema.parse({
      timezone: "Asia/Kolkata",
      dayEndsAtHour: "4",
      restDays: ["0", "6"],
    });
    expect(r).toEqual({
      timezone: "Asia/Kolkata",
      dayEndsAtHour: 4,
      restDays: [0, 6],
    });
  });

  it("rejects a bogus time zone rather than storing it", () => {
    // A bad zone here would misfile every task that follows, so this
    // must fail loudly at the boundary.
    const r = dayScheduleSchema.safeParse({
      timezone: "Nowhere/Nothing",
      dayEndsAtHour: "4",
      restDays: [],
    });
    expect(r.success).toBe(false);
  });

  it("allows midnight and noon at the edges", () => {
    for (const h of [0, 12]) {
      expect(
        dayScheduleSchema.safeParse({
          timezone: "UTC",
          dayEndsAtHour: h,
          restDays: [],
        }).success,
      ).toBe(true);
    }
  });

  it("rejects an evening 'day end', which would mean a different day", () => {
    expect(
      dayScheduleSchema.safeParse({
        timezone: "UTC",
        dayEndsAtHour: 20,
        restDays: [],
      }).success,
    ).toBe(false);
  });

  it("rejects a negative hour", () => {
    expect(
      dayScheduleSchema.safeParse({
        timezone: "UTC",
        dayEndsAtHour: -1,
        restDays: [],
      }).success,
    ).toBe(false);
  });
});

describe("rest days, which live with the rhythm", () => {
  const base = { timezone: "UTC", dayEndsAtHour: "4" };

  it("coerces the form's strings to numbers", () => {
    expect(dayScheduleSchema.parse({ ...base, restDays: ["0", "6"] }).restDays)
      .toEqual([0, 6]);
  });

  it("treats no rest days as a real answer, not a missing field", () => {
    // This is why rest days moved off the scoring form: an empty list is
    // valid, so a form that didn't include the field would have wiped it.
    expect(dayScheduleSchema.parse({ ...base, restDays: [] }).restDays)
      .toEqual([]);
  });

  it("de-duplicates and sorts them", () => {
    expect(
      dayScheduleSchema.parse({ ...base, restDays: ["6", "0", "6"] }).restDays,
    ).toEqual([0, 6]);
  });

  it("refuses to make every day a rest day", () => {
    // Seven rest days would mean nothing ever counts, which silently
    // turns the whole scoring system off rather than configuring it.
    expect(
      dayScheduleSchema.safeParse({
        ...base,
        restDays: ["0", "1", "2", "3", "4", "5", "6"],
      }).success,
    ).toBe(false);
  });

  it("rejects a day outside the week", () => {
    expect(
      dayScheduleSchema.safeParse({ ...base, restDays: ["7"] }).success,
    ).toBe(false);
  });

  it("requires the field rather than defaulting it", () => {
    // A missing restDays means the form forgot to send it, which must
    // fail loudly rather than quietly clearing every rest day.
    expect(dayScheduleSchema.safeParse(base).success).toBe(false);
  });
});

describe("scoringSchema", () => {
  const base = {
    dailyFloor: "3",
    dailyCap: "150",
    scoringVisibility: "normal",
  };

  it("coerces the form's strings to numbers", () => {
    const r = scoringSchema.parse(base);
    expect(r.dailyFloor).toBe(3);
    expect(r.dailyCap).toBe(150);
  });

  it("rejects a floor of zero", () => {
    expect(scoringSchema.safeParse({ ...base, dailyFloor: "0" }).success).toBe(
      false,
    );
  });

  it("rejects a cap low enough to throttle almost immediately", () => {
    expect(scoringSchema.safeParse({ ...base, dailyCap: "5" }).success).toBe(
      false,
    );
  });

  it("accepts each visibility mode and rejects anything else", () => {
    for (const v of ["hidden", "normal", "everywhere"]) {
      expect(
        scoringSchema.safeParse({ ...base, scoringVisibility: v }).success,
      ).toBe(true);
    }
    expect(
      scoringSchema.safeParse({ ...base, scoringVisibility: "loud" }).success,
    ).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("holds the new password to the length rule", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "whatever",
        newPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("does not hold the current password to it", () => {
    // An older account may predate the rule; rejecting its real password
    // here would make the form impossible to submit.
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "a-long-enough-passphrase",
      }).success,
    ).toBe(true);
  });
});

describe("deleteAccountSchema", () => {
  it("accepts the exact confirmation word", () => {
    expect(
      deleteAccountSchema.safeParse({ password: "pw", confirm: "DELETE" })
        .success,
    ).toBe(true);
  });

  it("rejects the wrong case, so it can't be cleared by autofill or habit", () => {
    for (const c of ["delete", "Delete", "DELETE ", "DEL"]) {
      expect(
        deleteAccountSchema.safeParse({ password: "pw", confirm: c }).success,
      ).toBe(false);
    }
  });

  it("still requires a password alongside the word", () => {
    expect(
      deleteAccountSchema.safeParse({ password: "", confirm: "DELETE" }).success,
    ).toBe(false);
  });
});

describe("profileTabSchema", () => {
  const base = {
    name: "Shashwat",
    timezone: "Asia/Kolkata",
    dayEndsAtHour: "4",
    weekStartsOn: "1",
    timeFormat: "24",
  };

  it("accepts what the Profile tab posts", () => {
    const r = profileTabSchema.parse(base);
    expect(r.weekStartsOn).toBe(1);
    expect(r.dayEndsAtHour).toBe(4);
    expect(r.timeFormat).toBe("24");
  });

  it("accepts Sunday as a week start", () => {
    expect(profileTabSchema.parse({ ...base, weekStartsOn: "0" }).weekStartsOn)
      .toBe(0);
  });

  it("rejects a week starting on any other day", () => {
    // The calendar only knows how to lead with Monday or Sunday; a 3
    // here would shift every column silently.
    for (const d of ["3", "7", "-1"]) {
      expect(profileTabSchema.safeParse({ ...base, weekStartsOn: d }).success)
        .toBe(false);
    }
  });

  it("rejects a time format it doesn't render", () => {
    expect(profileTabSchema.safeParse({ ...base, timeFormat: "military" })
      .success).toBe(false);
  });

  it("still refuses an evening day-end", () => {
    expect(profileTabSchema.safeParse({ ...base, dayEndsAtHour: "20" })
      .success).toBe(false);
  });

  it("still refuses a bogus time zone", () => {
    expect(profileTabSchema.safeParse({ ...base, timezone: "Nowhere/None" })
      .success).toBe(false);
  });
});

describe("describeZone", () => {
  it("labels a zone with its offset, as the design shows", () => {
    expect(describeZone("Asia/Kolkata", new Date("2026-08-16T00:00:00Z")))
      .toBe("Asia/Kolkata · GMT+5:30");
  });

  it("handles a whole-hour offset", () => {
    expect(describeZone("UTC", new Date("2026-08-16T00:00:00Z")))
      .toContain("UTC");
  });
});
