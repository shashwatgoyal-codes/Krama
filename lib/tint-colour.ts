/**
 * Turning one chosen colour into a note tint.
 *
 * A sticky note needs four values, not one: a paper and an edge, in
 * light and in dark. Asking somebody to pick four would be asking them
 * to do colour theory to choose a yellow — so they pick the paper they
 * want in daylight and the rest is derived from it.
 *
 * Derivation happens in HSL because that is where "the same colour,
 * darker" is a single number. Doing it in RGB gives muddy, desaturated
 * results, which is exactly what a hand-picked colour should not become.
 */

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

/** Accepts #abc and #aabbcc, with or without the hash. */
export function parseHex(input: string): Rgb | null {
  const hex = input.trim().replace(/^#/, "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return null;

  const full =
    hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex;

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const two = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${two(r)}${two(g)}${two(b)}`;
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;

  if (max === min) return { h: 0, s: 0, l };

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;

  return { h, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return {
    r: channel(h + 1 / 3) * 255,
    g: channel(h) * 255,
    b: channel(h - 1 / 3) * 255,
  };
}

function at(rgb: Rgb, lightness: number, saturationScale = 1): string {
  const hsl = rgbToHsl(rgb);
  return toHex(
    hslToRgb({
      h: hsl.h,
      s: Math.min(1, hsl.s * saturationScale),
      l: Math.max(0, Math.min(1, lightness)),
    }),
  );
}

export type DerivedTint = { light: [string, string]; dark: [string, string] };

/**
 * The four values, from one.
 *
 * Fixed target lightnesses rather than relative shifts. A relative
 * "20% darker" gives a nearly-white paper from a pale pick and a muddy
 * one from a dark pick; pinning the targets means every colour lands as
 * a usable sticky note, whatever was typed.
 */
export function deriveTint(hex: string): DerivedTint | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;

  return {
    // Paper stays pale in daylight; the edge is the same hue, committed.
    light: [at(rgb, 0.92), at(rgb, 0.66, 1.1)],
    // At night the paper is barely lit and the edge carries the colour.
    dark: [at(rgb, 0.11, 0.9), at(rgb, 0.34, 1.05)],
  };
}

/** Is this slot a hand-picked colour rather than a preset name? */
export function isHexTint(value: string): boolean {
  return parseHex(value) !== null;
}

/** What the colour input should show for a slot. */
export function normaliseHex(input: string): string | null {
  const rgb = parseHex(input);
  return rgb ? toHex(rgb) : null;
}
