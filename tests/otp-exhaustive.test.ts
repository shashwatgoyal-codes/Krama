import { describe, it, expect, beforeAll } from "vitest";
import {
  generateCode,
  hashCode,
  codesMatch,
  codeExpiry,
  normaliseCode,
  isWellFormed,
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  MAX_CODE_ATTEMPTS,
} from "@/lib/otp/code";
import { renderCodeImage } from "@/lib/otp/image";
import {
  timeZoneOptions,
  offsetLabel,
  zoneGroups,
  formatZone,
  describeZone,
} from "@/lib/timezones";
import { reminderDue } from "@/lib/repositories/maintenance";

/**
 * One-time codes, the image they arrive in, and the zone picker.
 *
 * The codes are the thing standing between a stranger and someone's
 * account, so what matters is that they are unguessable, that comparing
 * them leaks nothing through timing, and that a code for one purpose is
 * useless for another.
 */

beforeAll(() => {
  // hashCode is keyed with the session secret; tests need one present.
  process.env.SESSION_SECRET ??= "test-secret-for-hashing-only";
});

describe("generateCode", () => {
  it("is always the stated length", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toHaveLength(CODE_LENGTH);
    }
  });

  it("is always digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateCode()).toMatch(/^\d+$/);
    }
  });

  it("uses the whole range, including leading zeros", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) seen.add(generateCode());
    // With a million possibilities, 3000 draws should almost never
    // repeat much; a generator stuck in a corner would show up here.
    expect(seen.size).toBeGreaterThan(2900);
  });

  it("does not repeat itself in a short run", () => {
    const first = generateCode();
    let different = 0;
    for (let i = 0; i < 50; i++) if (generateCode() !== first) different++;
    expect(different).toBeGreaterThan(40);
  });
});

describe("normaliseCode", () => {
  const cases: [string, string][] = [
    ["123456", "123456"],
    ["123 456", "123456"],
    ["123-456", "123456"],
    [" 123456 ", "123456"],
    ["1 2 3 4 5 6", "123456"],
    ["12-34-56", "123456"],
    ["", ""],
    ["abc", ""],
    ["1a2b3c", "123"],
    ["  ", ""],
  ];

  for (const [input, expected] of cases) {
    it(`${JSON.stringify(input)} → ${JSON.stringify(expected)}`, () => {
      expect(normaliseCode(input)).toBe(expected);
    });
  }

  it("forgives however someone pastes a code", () => {
    const messy = ["123456", "123 456", "123-456", "  123456  ", "1-2-3-4-5-6"];
    for (const form of messy) {
      expect(normaliseCode(form)).toBe("123456");
    }
  });
});

describe("isWellFormed", () => {
  it("accepts any six digits", () => {
    for (let n = 0; n < 300; n++) {
      const code = String(n).padStart(6, "0");
      expect(isWellFormed(code)).toBe(true);
    }
  });

  const malformed = ["", "1", "12345", "1234567", "abcdef", "12345a", "      "];
  for (const code of malformed) {
    it(`rejects ${JSON.stringify(code)}`, () => {
      expect(isWellFormed(code)).toBe(false);
    });
  }
});

describe("hashCode", () => {
  it("never returns the code itself", () => {
    for (let i = 0; i < 20; i++) {
      const code = generateCode();
      expect(hashCode(code, "user-1", "password_reset")).not.toContain(code);
    }
  });

  it("is stable for the same inputs", () => {
    const code = "123456";
    expect(hashCode(code, "user-1", "password_reset")).toBe(
      hashCode(code, "user-1", "password_reset"),
    );
  });

  it("differs for a different code", () => {
    expect(hashCode("123456", "user-1", "password_reset")).not.toBe(
      hashCode("123457", "user-1", "password_reset"),
    );
  });

  it("differs for a different user, so a code cannot be replayed elsewhere", () => {
    expect(hashCode("123456", "user-1", "password_reset")).not.toBe(
      hashCode("123456", "user-2", "password_reset"),
    );
  });

  it("differs by purpose, so a verify code cannot reset a password", () => {
    expect(hashCode("123456", "user-1", "password_reset")).not.toBe(
      hashCode("123456", "user-1", "email_verify"),
    );
  });

  it("returns a fixed-width hex digest whatever the input", () => {
    const lengths = new Set<number>();
    for (const code of ["000000", "999999", "123456"]) {
      const hash = hashCode(code, "user-1", "email_verify");
      lengths.add(hash.length);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    }
    expect(lengths.size).toBe(1);
  });
});

describe("codesMatch", () => {
  it("matches identical codes", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(codesMatch(code, code)).toBe(true);
    }
  });

  it("rejects codes differing in any one position", () => {
    const base = "123456";
    for (let i = 0; i < 6; i++) {
      const changed =
        base.slice(0, i) + (base[i] === "9" ? "0" : "9") + base.slice(i + 1);
      expect(codesMatch(base, changed)).toBe(false);
    }
  });

  it("rejects codes of different lengths without throwing", () => {
    expect(() => codesMatch("123456", "12345")).not.toThrow();
    expect(codesMatch("123456", "12345")).toBe(false);
    expect(codesMatch("123456", "1234567")).toBe(false);
    expect(codesMatch("", "123456")).toBe(false);
  });
});

describe("codeExpiry", () => {
  it("is the stated number of minutes ahead", () => {
    const from = new Date("2026-08-17T12:00:00Z");
    const expiry = codeExpiry(from);
    expect(expiry.getTime() - from.getTime()).toBe(CODE_TTL_MINUTES * 60_000);
  });

  it("is always in the future relative to its base", () => {
    for (let i = 0; i < 50; i++) {
      const from = new Date(Date.UTC(2026, 0, 1 + i));
      expect(codeExpiry(from).getTime()).toBeGreaterThan(from.getTime());
    }
  });

  it("caps the attempts at something a person can survive but a script cannot", () => {
    expect(MAX_CODE_ATTEMPTS).toBeGreaterThanOrEqual(3);
    expect(MAX_CODE_ATTEMPTS).toBeLessThanOrEqual(10);
  });
});

describe("renderCodeImage", () => {
  it("produces a real PNG for any six digits", () => {
    for (const code of ["000000", "123456", "999999", "010101"]) {
      const png = renderCodeImage(code);
      // The PNG signature, so this is an image rather than a buffer of
      // hope. The whole point is that the code is never text anywhere.
      expect(png[0]).toBe(0x89);
      expect(png[1]).toBe(0x50);
      expect(png[2]).toBe(0x4e);
      expect(png[3]).toBe(0x47);
    }
  });

  it("produces different bytes for different codes", () => {
    const a = renderCodeImage("111111");
    const b = renderCodeImage("222222");
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(false);
  });

  it("produces the same bytes for the same code", () => {
    expect(
      Buffer.from(renderCodeImage("123456")).equals(
        Buffer.from(renderCodeImage("123456")),
      ),
    ).toBe(true);
  });

  it("never contains the code as readable text", () => {
    const png = renderCodeImage("123456");
    expect(Buffer.from(png).toString("latin1")).not.toContain("123456");
  });

  it("stays a sensible size for an email attachment", () => {
    for (const code of ["000000", "888888"]) {
      const png = renderCodeImage(code);
      expect(png.length).toBeGreaterThan(50);
      expect(png.length).toBeLessThan(200_000);
    }
  });
});

describe("timeZoneOptions", () => {
  it("always contains the zone it was given", () => {
    const zones = [
      "Asia/Kolkata",
      "Asia/Calcutta",
      "UTC",
      "America/New_York",
      "Africa/Abidjan",
      "Pacific/Auckland",
    ];
    for (const zone of zones) {
      expect(timeZoneOptions(zone)).toContain(zone);
    }
  });

  it("includes an alias the canonical list omits", () => {
    // This is the bug that silently reset a stored timezone: the picker
    // filtered by Intl.supportedValuesOf, which does not list aliases,
    // so the select fell back to its first option.
    expect(timeZoneOptions("Asia/Calcutta")).toContain("Asia/Calcutta");
  });

  it("never contains duplicates", () => {
    for (const zone of ["Asia/Kolkata", "Asia/Calcutta", "UTC"]) {
      const options = timeZoneOptions(zone);
      expect(new Set(options).size).toBe(options.length);
    }
  });

  it("offers a substantial list", () => {
    expect(timeZoneOptions("UTC").length).toBeGreaterThan(100);
  });
});

describe("offsetLabel", () => {
  const at = new Date("2026-08-17T12:00:00Z");

  const cases: [string, string][] = [
    ["UTC", "GMT"],
    ["Asia/Kolkata", "GMT+5:30"],
    ["Asia/Kathmandu", "GMT+5:45"],
    ["Asia/Tokyo", "GMT+9"],
  ];

  for (const [zone, expected] of cases) {
    it(`labels ${zone} as ${expected}`, () => {
      expect(offsetLabel(zone, at)).toBe(expected);
    });
  }

  it("produces a label for every offered zone without throwing", () => {
    for (const zone of timeZoneOptions("UTC").slice(0, 120)) {
      expect(() => offsetLabel(zone, at)).not.toThrow();
      expect(offsetLabel(zone, at).length).toBeGreaterThan(0);
    }
  });
});

describe("zoneGroups", () => {
  it("puts the current zone first, so it is never hunted for", () => {
    const groups = zoneGroups("Asia/Kolkata");
    expect(groups[0]!.zones.some((z) => z.value === "Asia/Kolkata")).toBe(true);
  });

  it("groups without losing any zone", () => {
    const groups = zoneGroups("UTC");
    const flat = groups.flatMap((g) => g.zones.map((z) => z.value));
    expect(flat.length).toBeGreaterThan(100);
  });

  it("gives every group a region name", () => {
    for (const group of zoneGroups("UTC")) {
      expect(group.region.length).toBeGreaterThan(0);
    }
  });

  it("labels every zone it offers", () => {
    for (const group of zoneGroups("Asia/Kolkata")) {
      for (const zone of group.zones) {
        expect(zone.label.length).toBeGreaterThan(0);
        expect(zone.value.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("formatZone and describeZone", () => {
  const zones = ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London"];

  for (const zone of zones) {
    it(`formats ${zone} without throwing`, () => {
      expect(() => formatZone(zone)).not.toThrow();
      expect(formatZone(zone).length).toBeGreaterThan(0);
    });
  }

  for (const zone of zones) {
    it(`describes ${zone} without throwing`, () => {
      expect(() => describeZone(zone)).not.toThrow();
    });
  }
});

describe("reminderDue", () => {
  it("is due at the exact minute", () => {
    expect(reminderDue("08:30", "08:30")).toBe(true);
  });

  it("is not yet due a minute before", () => {
    expect(reminderDue("08:30", "08:29")).toBe(false);
  });

  it("stays due afterwards, because the nudge waits for you to open the app", () => {
    // Deliberately "at or after" rather than an exact match: there is no
    // scheduler, so a reminder that only fired during its own minute
    // would be missed by anyone not already looking at the screen.
    for (const now of ["08:31", "09:00", "14:00", "23:59"]) {
      expect(reminderDue("08:30", now)).toBe(true);
    }
  });

  it("is never due when no reminder is set", () => {
    for (const now of ["00:00", "08:30", "12:00", "23:59"]) {
      expect(reminderDue(null, now)).toBe(false);
    }
  });

  it("is due for every minute from its time to the end of the day", () => {
    let fired = 0;
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        const now = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (reminderDue("08:30", now)) fired++;
      }
    }
    // 08:30 through 23:59 inclusive.
    expect(fired).toBe(24 * 60 - (8 * 60 + 30));
  });

  it("is due for no minute of the day when set to the last minute plus one", () => {
    let fired = 0;
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m++) {
        const now = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        if (reminderDue("24:00", now)) fired++;
      }
    }
    expect(fired).toBe(0);
  });

  it("works at both ends of the day", () => {
    expect(reminderDue("00:00", "00:00")).toBe(true);
    expect(reminderDue("23:59", "23:59")).toBe(true);
  });
});
