import { describe, it, expect } from "vitest";
import { rhythmSchema, appearanceSchema } from "@/lib/validation";
import { ACCENTS, ACCENT_TOKENS, isAccent } from "@/lib/appearance";
import { DEFAULT_TINTS } from "@/lib/notes";

const RHYTHM = {
  dailyFloor: "3",
  restDays: ["0", "6"],
  morningReminder: "08:30",
  eveningReminder: "21:00",
  backdateLimitDays: "2",
  rolloverUnfinished: true,
  catchUpRoutines: false,
};

describe("rhythmSchema", () => {
  it("accepts what the Rhythm tab posts", () => {
    const r = rhythmSchema.parse(RHYTHM);
    expect(r.dailyFloor).toBe(3);
    expect(r.restDays).toEqual([0, 6]);
    expect(r.morningReminder).toBe("08:30");
    expect(r.backdateLimitDays).toBe(2);
  });

  it("treats an empty reminder as no reminder, not an error", () => {
    const r = rhythmSchema.parse({ ...RHYTHM, morningReminder: "" });
    expect(r.morningReminder).toBeNull();
  });

  it("rejects a time that isn't one", () => {
    for (const t of ["8:30", "25:00", "08:60", "half eight"]) {
      expect(rhythmSchema.safeParse({ ...RHYTHM, morningReminder: t }).success)
        .toBe(false);
    }
  });

  it("allows a backdate limit of zero, meaning today only", () => {
    expect(rhythmSchema.parse({ ...RHYTHM, backdateLimitDays: "0" })
      .backdateLimitDays).toBe(0);
  });

  it("caps how far back you can log", () => {
    // Past a month a streak stops describing anything.
    expect(rhythmSchema.safeParse({ ...RHYTHM, backdateLimitDays: "365" })
      .success).toBe(false);
  });

  it("still refuses to make every day a rest day", () => {
    expect(
      rhythmSchema.safeParse({
        ...RHYTHM,
        restDays: ["0", "1", "2", "3", "4", "5", "6"],
      }).success,
    ).toBe(false);
  });
});

describe("appearanceSchema", () => {
  const base = {
    accent: "amber",
    interfaceFont: "krama",
    density: "comfortable",
    reduceMotion: false,
    showPointsOnTasks: true,
    noteTints: DEFAULT_TINTS,
  };

  it("accepts every accent offered", () => {
    for (const a of ACCENTS) {
      expect(appearanceSchema.safeParse({ ...base, accent: a.value }).success)
        .toBe(true);
    }
  });

  it("rejects a colour that isn't in the palette", () => {
    // Otherwise a crafted post writes a value the stylesheet has no
    // token for, and the accent silently disappears.
    expect(appearanceSchema.safeParse({ ...base, accent: "#ff0000" }).success)
      .toBe(false);
  });

  it("rejects a density the layout doesn't implement", () => {
    expect(appearanceSchema.safeParse({ ...base, density: "tiny" }).success)
      .toBe(false);
  });

  it("accepts both interface fonts and nothing else", () => {
    for (const f of ["krama", "system"]) {
      expect(appearanceSchema.safeParse({ ...base, interfaceFont: f }).success)
        .toBe(true);
    }
    expect(appearanceSchema.safeParse({ ...base, interfaceFont: "comic" })
      .success).toBe(false);
  });

  it("requires the font rather than defaulting it", () => {
    // A form that forgets the field would otherwise silently reset
    // someone back to the app's own pairing.
    const without: Record<string, unknown> = { ...base };
    delete without.interfaceFont;
    expect(appearanceSchema.safeParse(without).success).toBe(false);
  });
});

describe("accent tokens", () => {
  it("gives every accent a light and a dark pair", () => {
    for (const a of ACCENTS) {
      const tokens = ACCENT_TOKENS[a.value];
      expect(tokens, a.value).toBeTruthy();
      expect(tokens.light).toHaveLength(2);
      expect(tokens.dark).toHaveLength(2);
    }
  });

  it("uses real hex colours, not names the browser may not know", () => {
    for (const a of ACCENTS) {
      for (const pair of [ACCENT_TOKENS[a.value].light, ACCENT_TOKENS[a.value].dark]) {
        for (const c of pair) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("recognises its own values and nothing else", () => {
    expect(isAccent("amber")).toBe(true);
    expect(isAccent("chartreuse")).toBe(false);
  });
});
