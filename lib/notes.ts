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
};

/** Tailwind classes per tint, so the mapping lives in one place. */
export const NOTE_TINT: Record<string, string> = {
  n1: "bg-n1 border-n1b",
  n2: "bg-n2 border-n2b",
  n3: "bg-n3 border-n3b",
  n4: "bg-n4 border-n4b",
  n5: "bg-n5 border-n5b",
};
