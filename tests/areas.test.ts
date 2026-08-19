import { describe, it, expect } from "vitest";
import { AREA_COLOURS, AREA_DOT, AREA_CHIP } from "@/lib/areas";

/**
 * The area constants are shared between server and client, which is the
 * whole reason they live outside the repository. These tests guard the
 * two things that break silently: a colour with no class, and a class
 * string Tailwind can't see.
 */

describe("AREA_COLOURS", () => {
  it("has no duplicates", () => {
    expect(new Set(AREA_COLOURS).size).toBe(AREA_COLOURS.length);
  });

  it("gives every colour a dot class and a chip class", () => {
    for (const colour of AREA_COLOURS) {
      expect(AREA_DOT[colour], `dot for ${colour}`).toBeTruthy();
      expect(AREA_CHIP[colour], `chip for ${colour}`).toBeTruthy();
    }
  });

  it("uses literal class names, not ones built from a variable", () => {
    // Tailwind reads the source; `bg-${colour}` would compile to nothing
    // and the swatch would render transparent.
    for (const colour of AREA_COLOURS) {
      expect(AREA_DOT[colour]).toMatch(/^bg-[a-z]+$/);
      expect(AREA_DOT[colour]).not.toContain("${");
    }
  });

  it("maps each colour to a distinct swatch", () => {
    const classes = AREA_COLOURS.map((c) => AREA_DOT[c]);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it("only uses palette tokens the theme actually defines", () => {
    const allowed = new Set(["acc", "ok", "warn", "bad", "mut"]);
    for (const colour of AREA_COLOURS) {
      expect(allowed.has(colour), colour).toBe(true);
    }
  });
});
