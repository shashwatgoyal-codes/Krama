import { describe, it, expect } from "vitest";
import {
  parseHex, toHex, rgbToHsl, hslToRgb, deriveTint, isHexTint, normaliseHex,
} from "@/lib/tint-colour";
import { tintPreset } from "@/lib/notes";

/**
 * Turning one chosen colour into a usable sticky note.
 *
 * The property that matters is that *any* colour someone picks comes
 * out usable — pale paper in daylight, dark paper at night, an edge you
 * can see in both. A relative "20% darker" would give a near-white note
 * from a pale pick and a muddy one from a dark pick, so the targets are
 * fixed and this checks the extremes rather than a convenient middle.
 */

describe("parseHex", () => {
  it("takes the forms people actually type", () => {
    for (const input of ["#FDF0DC", "FDF0DC", "#fdf0dc", "  #FDF0DC  "]) {
      expect(parseHex(input)).toEqual({ r: 253, g: 240, b: 220 });
    }
  });

  it("expands three digits the way CSS does", () => {
    expect(parseHex("#abc")).toEqual(parseHex("#aabbcc"));
  });

  it("refuses anything else", () => {
    for (const bad of ["", "#", "#12", "#12345", "#GGGGGG", "red", "rgb(1,2,3)", "#1234567"]) {
      expect(parseHex(bad)).toBeNull();
    }
  });
});

describe("hsl round trip", () => {
  it("returns the colour it was given", () => {
    for (const hex of ["#FDF0DC", "#000000", "#FFFFFF", "#3366CC", "#7A5C2A"]) {
      const back = toHex(hslToRgb(rgbToHsl(parseHex(hex)!)));
      expect(back.toLowerCase()).toBe(hex.toLowerCase());
    }
  });

  it("handles grey, which has no hue to preserve", () => {
    expect(toHex(hslToRgb(rgbToHsl({ r: 128, g: 128, b: 128 })))).toBe("#808080");
  });
});

describe("deriveTint", () => {
  const samples = ["#FDF0DC", "#000000", "#FFFFFF", "#FF0000", "#123456", "#7f7f7f"];

  it("produces four colours for any valid input", () => {
    for (const hex of samples) {
      const t = deriveTint(hex)!;
      expect(t).not.toBeNull();
      for (const v of [...t.light, ...t.dark]) {
        expect(v).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("always gives pale paper in daylight, even from black", () => {
    // The failure this prevents: picking a dark colour and getting a
    // note you cannot read your own writing on.
    for (const hex of samples) {
      const { l } = rgbToHsl(parseHex(deriveTint(hex)!.light[0])!);
      expect(l).toBeGreaterThan(0.85);
    }
  });

  it("always gives dark paper at night, even from white", () => {
    for (const hex of samples) {
      const { l } = rgbToHsl(parseHex(deriveTint(hex)!.dark[0])!);
      expect(l).toBeLessThan(0.2);
    }
  });

  it("keeps the edge darker than the paper in light, lighter in dark", () => {
    for (const hex of samples) {
      const t = deriveTint(hex)!;
      expect(rgbToHsl(parseHex(t.light[1])!).l).toBeLessThan(rgbToHsl(parseHex(t.light[0])!).l);
      expect(rgbToHsl(parseHex(t.dark[1])!).l).toBeGreaterThan(rgbToHsl(parseHex(t.dark[0])!).l);
    }
  });

  it("keeps the hue that was chosen", () => {
    const chosen = rgbToHsl(parseHex("#3366CC")!);
    const t = deriveTint("#3366CC")!;
    for (const v of [...t.light, ...t.dark]) {
      expect(Math.abs(rgbToHsl(parseHex(v)!).h - chosen.h)).toBeLessThan(0.02);
    }
  });

  it("returns nothing for something that is not a colour", () => {
    expect(deriveTint("nope")).toBeNull();
  });
});

describe("tintPreset accepts either kind", () => {
  it("still resolves the named presets", () => {
    expect(tintPreset("amber").label).toBe("Amber");
  });

  it("resolves a hand-picked colour", () => {
    const t = tintPreset("#3366CC");
    expect(t.value).toBe("#3366CC");
    expect(t.light[0]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("falls back rather than throwing on nonsense", () => {
    expect(tintPreset("chartreuse").label).toBe("Amber");
  });
});

describe("isHexTint and normaliseHex", () => {
  it("tells a colour from a preset name", () => {
    expect(isHexTint("#FDF0DC")).toBe(true);
    expect(isHexTint("amber")).toBe(false);
  });

  it("normalises to a form the colour input accepts", () => {
    expect(normaliseHex("#abc")).toBe("#aabbcc");
    expect(normaliseHex("FDF0DC")).toBe("#fdf0dc");
    expect(normaliseHex("amber")).toBeNull();
  });
});
