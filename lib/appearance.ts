/**
 * Appearance choices, safe for the browser.
 *
 * Same rule as lib/areas.ts and lib/notes.ts: anything a "use client"
 * file imports lives in lib/, never lib/repositories/, or Prisma ends up
 * in the browser bundle.
 */

export const ACCENTS = [
  { value: "amber", label: "Amber", dot: "bg-[#B45309]" },
  { value: "teal", label: "Teal", dot: "bg-[#0E7490]" },
  { value: "indigo", label: "Indigo", dot: "bg-[#4338CA]" },
  { value: "rose", label: "Rose", dot: "bg-[#BE123C]" },
  { value: "moss", label: "Moss", dot: "bg-[#3F6212]" },
] as const;

export type Accent = (typeof ACCENTS)[number]["value"];

export const ACCENT_VALUES = ACCENTS.map((a) => a.value) as [Accent, ...Accent[]];

export const DENSITIES = ["comfortable", "compact"] as const;
export type Density = (typeof DENSITIES)[number];

export const THEMES = ["light", "dark", "system"] as const;

/**
 * The accent as CSS custom properties, light and dark.
 *
 * Written as a style attribute on <html> rather than as a class, because
 * the tokens are already custom properties — overriding them is a
 * one-line assignment, and no Tailwind class has to exist per colour.
 */
export const ACCENT_TOKENS: Record<
  Accent,
  { light: [string, string]; dark: [string, string] }
> = {
  amber: { light: ["#B45309", "#FDF1E3"], dark: ["#EFA850", "#241A0E"] },
  teal: { light: ["#0E7490", "#E0F2F7"], dark: ["#3AC7E0", "#0C2831"] },
  indigo: { light: ["#4338CA", "#EAE8FB"], dark: ["#A5B4FC", "#191A3A"] },
  rose: { light: ["#BE123C", "#FCE7EC"], dark: ["#FDA4AF", "#33121C"] },
  moss: { light: ["#3F6212", "#EAF2DC"], dark: ["#A3C46B", "#1A2410"] },
};

export function isAccent(value: string): value is Accent {
  return ACCENT_VALUES.includes(value as Accent);
}
