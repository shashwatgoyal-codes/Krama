import { describe, it, expect } from "vitest";
import {
  emailSchema,
  passwordSchema,
  signUpSchema,
  signInSchema,
  createTaskSchema,
  taskIdSchema,
  scheduleAtSchema,
  nameSchema,
  profileTabSchema,
  rhythmSchema,
  appearanceSchema,
  scoringSchema,
  isValidTimeZone,
} from "@/lib/validation";
import { BLOCK_MINUTES } from "@/lib/time";

/**
 * Every boundary of every schema that guards a write.
 *
 * These are the only thing standing between a crafted form post and the
 * database, so the cases that matter are the ones just over each edge:
 * one character too long, one minute past the hour, a duration nobody
 * offered. A schema that accepts the boundary but not the value beyond
 * it is doing its job; one that is lenient by a single unit is not.
 */

describe("emailSchema", () => {
  const valid = [
    "a@b.co",
    "user@example.com",
    "user.name@example.com",
    "user+tag@example.com",
    "user_name@example.co.uk",
    "user-name@sub.example.com",
    "123@example.com",
    "UPPER@EXAMPLE.COM",
    "  spaced@example.com  ",
  ];

  for (const email of valid) {
    it(`accepts ${JSON.stringify(email)}`, () => {
      expect(emailSchema.safeParse(email).success).toBe(true);
    });
  }

  const invalid = [
    "",
    " ",
    "no-at-sign",
    "@example.com",
    "user@",
    "user@@example.com",
    "user example@test.com",
    "a@b",
    "ab",
  ];

  for (const email of invalid) {
    it(`rejects ${JSON.stringify(email)}`, () => {
      expect(emailSchema.safeParse(email).success).toBe(false);
    });
  }

  it("lowercases, so one address is one account", () => {
    expect(emailSchema.parse("USER@EXAMPLE.COM")).toBe("user@example.com");
  });

  it("trims, because people paste with whitespace", () => {
    expect(emailSchema.parse("  user@example.com  ")).toBe("user@example.com");
  });

  it("rejects an address past the length limit", () => {
    expect(
      emailSchema.safeParse(`${"a".repeat(250)}@example.com`).success,
    ).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("rejects everything shorter than the minimum", () => {
    for (let length = 0; length < 10; length++) {
      expect(passwordSchema.safeParse("x".repeat(length)).success).toBe(false);
    }
  });

  it("accepts a range of sensible lengths", () => {
    for (const length of [10, 11, 20, 50, 100, 128]) {
      expect(passwordSchema.safeParse("x".repeat(length)).success).toBe(true);
    }
  });

  it("values length over symbols, as the hint says", () => {
    expect(passwordSchema.safeParse("correct horse battery").success).toBe(
      true,
    );
  });

  it("rejects an absurdly long password", () => {
    expect(passwordSchema.safeParse("x".repeat(5000)).success).toBe(false);
  });
});

describe("signUpSchema", () => {
  const base = {
    name: "Someone",
    email: "user@example.com",
    password: "a long enough passphrase",
  };

  it("accepts a complete form", () => {
    expect(signUpSchema.safeParse(base).success).toBe(true);
  });

  for (const field of ["name", "email", "password"] as const) {
    it(`rejects a form with no ${field}`, () => {
      const copy = { ...base, [field]: "" };
      expect(signUpSchema.safeParse(copy).success).toBe(false);
    });
  }

  it("accepts a name at the limit and rejects one past it", () => {
    expect(
      signUpSchema.safeParse({ ...base, name: "n".repeat(80) }).success,
    ).toBe(true);
    expect(
      signUpSchema.safeParse({ ...base, name: "n".repeat(81) }).success,
    ).toBe(false);
  });

  it("trims the name", () => {
    expect(signUpSchema.parse({ ...base, name: "  Someone  " }).name).toBe(
      "Someone",
    );
  });

  it("rejects a whitespace-only name", () => {
    expect(signUpSchema.safeParse({ ...base, name: "   " }).success).toBe(
      false,
    );
  });
});

describe("signInSchema", () => {
  it("accepts any non-empty password, since old accounts predate the rules", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.co", password: "x" }).success,
    ).toBe(true);
  });

  it("still rejects an empty password", () => {
    expect(
      signInSchema.safeParse({ email: "a@b.co", password: "" }).success,
    ).toBe(false);
  });

  it("still validates the email", () => {
    expect(
      signInSchema.safeParse({ email: "nope", password: "x" }).success,
    ).toBe(false);
  });
});

describe("createTaskSchema — title", () => {
  const base = { title: "Something", recurrence: "none" as const };

  it("accepts a title at the limit", () => {
    expect(
      createTaskSchema.safeParse({ ...base, title: "t".repeat(200) }).success,
    ).toBe(true);
  });

  it("rejects a title one character past the limit", () => {
    expect(
      createTaskSchema.safeParse({ ...base, title: "t".repeat(201) }).success,
    ).toBe(false);
  });

  for (const title of ["", " ", "   ", "\t", "\n"]) {
    it(`rejects a blank title ${JSON.stringify(title)}`, () => {
      expect(createTaskSchema.safeParse({ ...base, title }).success).toBe(
        false,
      );
    });
  }

  it("trims the title", () => {
    expect(createTaskSchema.parse({ ...base, title: "  x  " }).title).toBe("x");
  });
});

describe("createTaskSchema — points", () => {
  const base = { title: "Something", recurrence: "none" as const };

  for (let points = 1; points <= 30; points++) {
    it(`accepts ${points}`, () => {
      expect(createTaskSchema.safeParse({ ...base, points }).success).toBe(
        true,
      );
    });
  }

  for (const points of [0, -1, -20, 31, 50, 100, 1000]) {
    it(`rejects ${points}`, () => {
      expect(createTaskSchema.safeParse({ ...base, points }).success).toBe(
        false,
      );
    });
  }

  for (const points of [1.5, 20.1, 29.99]) {
    it(`rejects the fraction ${points}`, () => {
      expect(createTaskSchema.safeParse({ ...base, points }).success).toBe(
        false,
      );
    });
  }

  it("is optional, so the repository default stands", () => {
    expect(createTaskSchema.parse(base).points).toBeUndefined();
  });
});

describe("createTaskSchema — recurrence", () => {
  const base = { title: "Something" };

  for (const recurrence of ["none", "daily", "weekdays", "weekly", "monthly"]) {
    it(`accepts ${recurrence}`, () => {
      expect(createTaskSchema.safeParse({ ...base, recurrence }).success).toBe(
        true,
      );
    });
  }

  for (const recurrence of ["yearly", "hourly", "NONE", "", "every day"]) {
    it(`rejects ${JSON.stringify(recurrence)}`, () => {
      expect(createTaskSchema.safeParse({ ...base, recurrence }).success).toBe(
        false,
      );
    });
  }

  it("defaults to not repeating", () => {
    expect(createTaskSchema.parse(base).recurrence).toBe("none");
  });

  for (let value = 0; value <= 31; value++) {
    it(`accepts a recurrence value of ${value}`, () => {
      expect(
        createTaskSchema.safeParse({ ...base, recurrenceValue: value }).success,
      ).toBe(true);
    });
  }

  for (const value of [-1, 32, 100]) {
    it(`rejects a recurrence value of ${value}`, () => {
      expect(
        createTaskSchema.safeParse({ ...base, recurrenceValue: value }).success,
      ).toBe(false);
    });
  }
});

describe("taskIdSchema", () => {
  it("rejects an id that is not a cuid", () => {
    for (const id of ["", "123", "not-a-cuid", "../etc/passwd", "<script>"]) {
      expect(taskIdSchema.safeParse({ id }).success).toBe(false);
    }
  });
});

describe("scheduleAtSchema", () => {
  const base = {
    id: "clbbbbbbbbbbbbbbbbbbbbbbb",
    dayKey: "2026-08-17",
    hour: "9",
    minute: "0",
    durationMinutes: "60",
  };

  for (let hour = 0; hour <= 23; hour++) {
    it(`accepts hour ${hour}`, () => {
      expect(
        scheduleAtSchema.safeParse({ ...base, hour: String(hour) }).success,
      ).toBe(true);
    });
  }

  for (const hour of [-1, 24, 25, 99]) {
    it(`rejects hour ${hour}`, () => {
      expect(
        scheduleAtSchema.safeParse({ ...base, hour: String(hour) }).success,
      ).toBe(false);
    });
  }

  for (const minute of [0, 1, 15, 30, 45, 59]) {
    it(`accepts minute ${minute}`, () => {
      expect(
        scheduleAtSchema.safeParse({ ...base, minute: String(minute) }).success,
      ).toBe(true);
    });
  }

  for (const minute of [-1, 60, 61, 100]) {
    it(`rejects minute ${minute}`, () => {
      expect(
        scheduleAtSchema.safeParse({ ...base, minute: String(minute) }).success,
      ).toBe(false);
    });
  }

  for (const length of BLOCK_MINUTES) {
    it(`accepts the offered length of ${length} minutes`, () => {
      expect(
        scheduleAtSchema.safeParse({
          ...base,
          durationMinutes: String(length),
        }).success,
      ).toBe(true);
    });
  }

  for (const length of [1, 5, 10, 20, 25, 55, 61, 300, 1000, 0, -60]) {
    it(`rejects the unoffered length of ${length} minutes`, () => {
      expect(
        scheduleAtSchema.safeParse({
          ...base,
          durationMinutes: String(length),
        }).success,
      ).toBe(false);
    });
  }

  const badDates = ["", "2026-8-17", "17-08-2026", "2026/08/17", "tomorrow"];
  for (const dayKey of badDates) {
    it(`rejects the date ${JSON.stringify(dayKey)}`, () => {
      expect(scheduleAtSchema.safeParse({ ...base, dayKey }).success).toBe(
        false,
      );
    });
  }
});

describe("isValidTimeZone", () => {
  const real = [
    "UTC",
    "Asia/Kolkata",
    "Asia/Calcutta",
    "America/New_York",
    "Europe/London",
    "Australia/Sydney",
    "Africa/Abidjan",
    "Pacific/Auckland",
    "America/Argentina/Buenos_Aires",
  ];

  for (const zone of real) {
    it(`accepts ${zone}`, () => {
      expect(isValidTimeZone(zone)).toBe(true);
    });
  }

  // "IST" is deliberately absent: Node's Intl accepts it as a legacy
  // abbreviation, so treating it as invalid would be testing a rule the
  // platform does not actually enforce.
  const fake = ["", "Nowhere/Nothing", "Mars/Olympus", "Not A Zone"];
  for (const zone of fake) {
    it(`rejects ${JSON.stringify(zone)}`, () => {
      expect(isValidTimeZone(zone)).toBe(false);
    });
  }

  it("accepts an alias, which is why the picker must not filter by the canonical list", () => {
    // Asia/Calcutta is a real alias that Intl.supportedValuesOf omits.
    // Filtering the dropdown by that list is what silently reset a
    // stored timezone to the first option in the list.
    expect(isValidTimeZone("Asia/Calcutta")).toBe(true);
  });
});

describe("profileTabSchema", () => {
  const base = {
    name: "Someone",
    timezone: "Asia/Kolkata",
    dayEndsAtHour: "4",
    weekStartsOn: "1",
    timeFormat: "24",
  };

  for (let hour = 0; hour <= 12; hour++) {
    it(`accepts a day ending at ${hour}:00`, () => {
      expect(
        profileTabSchema.safeParse({ ...base, dayEndsAtHour: String(hour) })
          .success,
      ).toBe(true);
    });
  }

  for (const hour of [13, 18, 23, 24, -1]) {
    it(`rejects a day ending at ${hour}:00`, () => {
      expect(
        profileTabSchema.safeParse({ ...base, dayEndsAtHour: String(hour) })
          .success,
      ).toBe(false);
    });
  }

  for (const day of ["0", "1"]) {
    it(`accepts a week starting on ${day}`, () => {
      expect(
        profileTabSchema.safeParse({ ...base, weekStartsOn: day }).success,
      ).toBe(true);
    });
  }

  for (const day of ["2", "3", "6", "7", "-1"]) {
    it(`rejects a week starting on ${day}`, () => {
      expect(
        profileTabSchema.safeParse({ ...base, weekStartsOn: day }).success,
      ).toBe(false);
    });
  }

  for (const format of ["12", "24"]) {
    it(`accepts the ${format}-hour clock`, () => {
      expect(
        profileTabSchema.safeParse({ ...base, timeFormat: format }).success,
      ).toBe(true);
    });
  }

  for (const format of ["", "6", "am/pm", "military"]) {
    it(`rejects the clock ${JSON.stringify(format)}`, () => {
      expect(
        profileTabSchema.safeParse({ ...base, timeFormat: format }).success,
      ).toBe(false);
    });
  }
});

describe("rhythmSchema", () => {
  const base = {
    dailyFloor: "1",
    dailyTargetPoints: "60",
    restDays: ["0", "6"],
    morningReminder: "08:30",
    eveningReminder: "21:00",
    backdateLimitDays: "2",
    rolloverUnfinished: true,
    catchUpRoutines: false,
  };

  for (let floor = 1; floor <= 20; floor++) {
    it(`accepts a floor of ${floor}`, () => {
      expect(
        rhythmSchema.safeParse({ ...base, dailyFloor: String(floor) }).success,
      ).toBe(true);
    });
  }

  for (const floor of [0, -1, 21, 100]) {
    it(`rejects a floor of ${floor}`, () => {
      expect(
        rhythmSchema.safeParse({ ...base, dailyFloor: String(floor) }).success,
      ).toBe(false);
    });
  }

  for (const target of [1, 20, 60, 100, 250, 500]) {
    it(`accepts a daily target of ${target}`, () => {
      expect(
        rhythmSchema.safeParse({ ...base, dailyTargetPoints: String(target) })
          .success,
      ).toBe(true);
    });
  }

  for (const target of [0, -1, 501, 10_000]) {
    it(`rejects a daily target of ${target}`, () => {
      expect(
        rhythmSchema.safeParse({ ...base, dailyTargetPoints: String(target) })
          .success,
      ).toBe(false);
    });
  }

  it("de-duplicates rest days, so a doubled post is not a doubled row", () => {
    const parsed = rhythmSchema.parse({ ...base, restDays: ["0", "0", "6"] });
    expect(parsed.restDays).toEqual([0, 6]);
  });

  it("sorts rest days", () => {
    expect(rhythmSchema.parse({ ...base, restDays: ["6", "0"] }).restDays).toEqual(
      [0, 6],
    );
  });

  it("accepts no rest days at all", () => {
    expect(rhythmSchema.parse({ ...base, restDays: [] }).restDays).toEqual([]);
  });

  it("refuses to let every day be a rest day", () => {
    expect(
      rhythmSchema.safeParse({
        ...base,
        restDays: ["0", "1", "2", "3", "4", "5", "6"],
      }).success,
    ).toBe(false);
  });

  for (const day of ["7", "-1", "10"]) {
    it(`rejects the rest day ${day}`, () => {
      expect(rhythmSchema.safeParse({ ...base, restDays: [day] }).success).toBe(
        false,
      );
    });
  }
});

describe("scoringSchema", () => {
  const base = {
    dailyFloor: "3",
    dailyCap: "150",
    dailyTargetPoints: "60",
    scoringVisibility: "normal",
  };

  for (const mode of ["hidden", "normal", "everywhere"]) {
    it(`accepts the visibility mode ${mode}`, () => {
      expect(
        scoringSchema.safeParse({ ...base, scoringVisibility: mode }).success,
      ).toBe(true);
    });
  }

  for (const mode of ["", "loud", "quiet", "NORMAL"]) {
    it(`rejects the visibility mode ${JSON.stringify(mode)}`, () => {
      expect(
        scoringSchema.safeParse({ ...base, scoringVisibility: mode }).success,
      ).toBe(false);
    });
  }

  for (const cap of [20, 50, 150, 500, 1000]) {
    it(`accepts a cap of ${cap}`, () => {
      expect(
        scoringSchema.safeParse({ ...base, dailyCap: String(cap) }).success,
      ).toBe(true);
    });
  }

  for (const cap of [0, 5, 19, -100]) {
    it(`rejects a cap of ${cap}, which would throttle immediately`, () => {
      expect(
        scoringSchema.safeParse({ ...base, dailyCap: String(cap) }).success,
      ).toBe(false);
    });
  }
});

describe("appearanceSchema", () => {
  it("rejects an unknown accent", () => {
    const parsed = appearanceSchema.safeParse({
      accent: "chartreuse",
      density: "comfortable",
      reduceMotion: false,
      showPointsOnTasks: true,
      interfaceFont: "krama",
      noteTints: ["amber", "sky", "rose", "violet", "slate"],
    });
    expect(parsed.success).toBe(false);
  });

  for (const density of ["comfortable", "compact"]) {
    it(`accepts the density ${density}`, () => {
      const parsed = appearanceSchema.safeParse({
        accent: "amber",
        density,
        reduceMotion: false,
        showPointsOnTasks: true,
        interfaceFont: "krama",
        noteTints: ["amber", "sky", "rose", "violet", "slate"],
      });
      expect(parsed.success).toBe(true);
    });
  }

  for (const density of ["cosy", "", "spacious"]) {
    it(`rejects the density ${JSON.stringify(density)}`, () => {
      const parsed = appearanceSchema.safeParse({
        accent: "amber",
        density,
        reduceMotion: false,
        showPointsOnTasks: true,
        interfaceFont: "krama",
        noteTints: ["amber", "sky", "rose", "violet", "slate"],
      });
      expect(parsed.success).toBe(false);
    });
  }
});

describe("nameSchema", () => {
  it("accepts a name at the limit and rejects one past it", () => {
    expect(nameSchema.safeParse({ name: "n".repeat(80) }).success).toBe(true);
    expect(nameSchema.safeParse({ name: "n".repeat(81) }).success).toBe(false);
  });

  for (const name of ["", " ", "\t", "\n", "   "]) {
    it(`rejects the blank name ${JSON.stringify(name)}`, () => {
      expect(nameSchema.safeParse({ name }).success).toBe(false);
    });
  }

  const realNames = ["Shashwat", "Ana María", "李雷", "O'Brien", "Jean-Luc"];
  for (const name of realNames) {
    it(`accepts ${name}`, () => {
      expect(nameSchema.safeParse({ name }).success).toBe(true);
    });
  }
});
