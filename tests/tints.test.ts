import { describe, it, expect } from "vitest";
import { TINT_PRESETS, DEFAULT_TINTS, tintPreset, tintCss, NOTE_COLOURS,
  ageLabel,
  tiltOf,
} from "@/lib/notes";
import { appearanceSchema } from "@/lib/validation";

describe("tint presets", () => {
  it("gives every preset a light and a dark pair", () => {
    for (const p of TINT_PRESETS) {
      expect(p.light, p.value).toHaveLength(2);
      expect(p.dark, p.value).toHaveLength(2);
      for (const c of [...p.light, ...p.dark]) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("ships exactly one default per sticky colour", () => {
    expect(DEFAULT_TINTS).toHaveLength(NOTE_COLOURS.length);
    for (const d of DEFAULT_TINTS) {
      expect(TINT_PRESETS.some((p) => p.value === d), d).toBe(true);
    }
  });

  it("falls back rather than throwing on an unknown name", () => {
    // A preset removed in a later version must not break a board that
    // still refers to it.
    expect(tintPreset("chartreuse").value).toBe(TINT_PRESETS[0].value);
  });
});

describe("tintCss", () => {
  it("defines all five tints and their borders", () => {
    const css = tintCss(DEFAULT_TINTS);
    for (let i = 1; i <= 5; i++) {
      expect(css).toContain(`--n${i}:`);
      expect(css).toContain(`--n${i}b:`);
    }
  });

  it("covers both themes and the explicit override", () => {
    const css = tintCss(DEFAULT_TINTS);
    expect(css).toContain("prefers-color-scheme: dark");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('[data-theme="light"]');
  });

  it("fills a short list from the defaults instead of leaving a gap", () => {
    // A profile saved before a preset was added must still render five.
    const css = tintCss(["amber"]);
    for (let i = 1; i <= 5; i++) expect(css).toContain(`--n${i}:`);
  });

  it("uses the chosen preset, not always the default", () => {
    expect(tintCss(["moss", "moss", "moss", "moss", "moss"]))
      .toContain(tintPreset("moss").light[0]);
  });
});

describe("appearanceSchema and tints", () => {
  const base = {
    accent: "amber",
    interfaceFont: "krama",
    density: "comfortable",
    reduceMotion: false,
    showPointsOnTasks: true,
    noteTints: DEFAULT_TINTS,
  };

  it("accepts five known presets", () => {
    expect(appearanceSchema.safeParse(base).success).toBe(true);
  });

  it("allows the same preset in two slots", () => {
    // Their board. Forbidding it would be a rule to explain for no gain.
    expect(appearanceSchema.safeParse({
      ...base, noteTints: ["moss", "moss", "rose", "sky", "clay"],
    }).success).toBe(true);
  });

  it("rejects a count other than five", () => {
    for (const t of [["amber"], [...DEFAULT_TINTS, "moss"]]) {
      expect(appearanceSchema.safeParse({ ...base, noteTints: t }).success).toBe(false);
    }
  });

  it("rejects a colour that isn't a preset", () => {
    expect(appearanceSchema.safeParse({
      ...base, noteTints: ["#ff0000", "sky", "rose", "violet", "slate"],
    }).success).toBe(false);
  });
});

describe("how old a note is", () => {
  const cases: [number, string][] = [
    [0, "TODAY"],
    [1, "1D"],
    [2, "2D"],
    [14, "14D"],
    [99, "99D"],
    [100, "99D+"],
    [999, "99D+"],
  ];

  for (const [days, expected] of cases) {
    it(`${days} days reads as ${expected}`, () => {
      expect(ageLabel(days)).toBe(expected);
    });
  }

  it("treats a negative age as today rather than showing nonsense", () => {
    expect(ageLabel(-1)).toBe("TODAY");
  });

  it("never returns an empty label across three years", () => {
    for (let d = 0; d < 1100; d++) {
      expect(ageLabel(d).length).toBeGreaterThan(0);
    }
  });
});

describe("the tilt on a note", () => {
  it("is the same every time for the same note", () => {
    // Random would re-tilt on every render, which is charming once and
    // maddening after that.
    for (const id of ["abc", "cmsxyz001", "n1", ""]) {
      expect(tiltOf(id)).toBe(tiltOf(id));
    }
  });

  it("stays small enough to still read as text", () => {
    for (let i = 0; i < 500; i++) {
      const t = tiltOf(`note-${i}`);
      expect(Math.abs(t)).toBeLessThanOrEqual(2);
    }
  });

  it("does not give every note the same angle", () => {
    const angles = new Set(
      Array.from({ length: 200 }, (_, i) => tiltOf(`note-${i}`)),
    );
    expect(angles.size).toBeGreaterThan(5);
  });

  it("tilts both ways", () => {
    const angles = Array.from({ length: 200 }, (_, i) => tiltOf(`n${i}`));
    expect(angles.some((a) => a > 0)).toBe(true);
    expect(angles.some((a) => a < 0)).toBe(true);
  });
});
