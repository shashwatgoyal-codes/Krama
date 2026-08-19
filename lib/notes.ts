import type { TagChip } from "./tags";
/**
 * Values and types shared between the server and the board UI.
 *
 * Kept apart from lib/repositories/notes.ts on purpose: that module
 * imports Prisma, and a client component importing a runtime value from
 * it would pull the database driver — and with it `fs`, `net` and `tls`
 * — into the browser bundle.
 */

export const NOTE_COLOURS = ["n1", "n2", "n3", "n4", "n5"] as const;
export type NoteColour = (typeof NOTE_COLOURS)[number];

export const NOTE_WIDTH = 190;
export const NOTE_HEIGHT = 150;

export type NoteItem = {
  id: string;
  body: string;
  colour: string;
  x: number;
  y: number;
  z: number;
  taskId: string | null;
  tags: TagChip[];
  areaId: string | null;
  /** Shown on the note's face, as "OFFICE". Null when unfiled. */
  areaName: string | null;
  /** Days since it was written, for the "2D" beside the area. */
  ageDays: number;
};

/**
 * "2D", "14D", "TODAY" — how old a note is, in the shortest form that
 * still says something.
 *
 * A date on a sticky is noise; what you actually want to know is whether
 * this is something you scribbled this morning or something that has
 * been sitting there a fortnight.
 */
export function ageLabel(days: number): string {
  if (days <= 0) return "TODAY";
  if (days === 1) return "1D";
  if (days < 100) return `${days}D`;
  return "99D+";
}

/**
 * A small, fixed tilt per note.
 *
 * Derived from the id rather than random, so a note does not jump to a
 * new angle every time the board re-renders — which would be charming
 * once and maddening thereafter.
 */
export function tiltOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  // Between -2 and 2 degrees. Enough to read as paper, little enough to
  // still read as text.
  return ((Math.abs(hash) % 41) - 20) / 10;
}

/** Tailwind classes per tint, so the mapping lives in one place. */
export const NOTE_TINT: Record<string, string> = {
  n1: "bg-n1 border-n1b",
  n2: "bg-n2 border-n2b",
  n3: "bg-n3 border-n3b",
  n4: "bg-n4 border-n4b",
  n5: "bg-n5 border-n5b",
};

/**
 * The tints a sticky note can be, and the ones a user may swap them for.
 *
 * The design says "click one to recolour it", which needs a palette to
 * pick from — a full colour picker would let someone choose a tint that
 * black text can't be read on, which is a worse outcome than a smaller
 * choice. Every preset here is desaturated on purpose, so a board full
 * of them doesn't fight the interface.
 */
export type TintPreset = {
  value: string;
  label: string;
  light: [string, string];
  dark: [string, string];
};

export const TINT_PRESETS: TintPreset[] = [
  { value: "amber",  label: "Amber",  light: ["#FDF0DC", "#E0B268"], dark: ["#2B2011", "#7A5C2A"] },
  { value: "sky",    label: "Sky",    light: ["#E2F4F8", "#8FC5D4"], dark: ["#0F2830", "#2F6E80"] },
  { value: "rose",   label: "Rose",   light: ["#FBE8EC", "#DFA1AF"], dark: ["#2C1620", "#7A4457"] },
  { value: "violet", label: "Violet", light: ["#E8EBF4", "#A8B0CA"], dark: ["#171B29", "#454F73"] },
  { value: "slate",  label: "Slate",  light: ["#F1F2F4", "#C3C7CE"], dark: ["#1A1C21", "#3A3F49"] },
  { value: "moss",   label: "Moss",   light: ["#E9F1DF", "#A9C185"], dark: ["#18220F", "#4C6329"] },
  { value: "clay",   label: "Clay",   light: ["#F5EBE3", "#CBAE97"], dark: ["#241B15", "#6B5142"] },
  { value: "mint",   label: "Mint",   light: ["#E3F4EC", "#93CBB2"], dark: ["#0F2620", "#2F6B55"] },
];

/** What a new account gets — the five the app has always shipped. */
export const DEFAULT_TINTS = ["amber", "sky", "rose", "violet", "slate"];

export function tintPreset(value: string): TintPreset {
  return TINT_PRESETS.find((t) => t.value === value) ?? TINT_PRESETS[0];
}

/** Five chosen presets as the --n1..--n5 overrides, light and dark. */
export function tintCss(chosen: string[]): string {
  const five = NOTE_COLOURS.map((_, i) => tintPreset(chosen[i] ?? DEFAULT_TINTS[i]));
  const vars = (mode: "light" | "dark") =>
    five
      .map((t, i) => `--n${i + 1}: ${t[mode][0]}; --n${i + 1}b: ${t[mode][1]};`)
      .join(" ");

  return `
    [data-tints] { ${vars("light")} }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) [data-tints] { ${vars("dark")} }
    }
    :root[data-theme="dark"] [data-tints] { ${vars("dark")} }
    :root[data-theme="light"] [data-tints] { ${vars("light")} }
  `;
}
