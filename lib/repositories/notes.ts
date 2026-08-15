import { db } from "@/lib/db";
import type { Note } from "@prisma/client";
import { NOTE_WIDTH, NOTE_HEIGHT, type NoteColour, type NoteItem } from "@/lib/notes";

/** Same rule as everywhere else: userId is required and always filtered on. */

const FIELDS = {
  id: true,
  body: true,
  colour: true,
  x: true,
  y: true,
  z: true,
  taskId: true,
} as const;

export async function listNotes(userId: string): Promise<NoteItem[]> {
  return db.note.findMany({
    where: { userId, archivedAt: null },
    select: FIELDS,
    orderBy: { z: "asc" },
  });
}

/**
 * New notes are placed in the first free slot of a loose grid rather
 * than all at the origin, so adding several in a row doesn't bury them
 * in a single stack.
 */
export async function createNote(
  userId: string,
  body: string,
  colour: NoteColour,
): Promise<NoteItem> {
  const existing = await db.note.findMany({
    where: { userId, archivedAt: null },
    select: { x: true, y: true, z: true },
  });

  const taken = new Set(existing.map((n) => `${n.x},${n.y}`));
  const COLS = 5;
  const GAP_X = NOTE_WIDTH + 16;
  const GAP_Y = NOTE_HEIGHT + 16;

  let x = 16;
  let y = 16;
  for (let i = 0; i < 200; i++) {
    const cx = 16 + (i % COLS) * GAP_X;
    const cy = 16 + Math.floor(i / COLS) * GAP_Y;
    if (!taken.has(`${cx},${cy}`)) {
      x = cx;
      y = cy;
      break;
    }
  }

  const topZ = existing.reduce((max, n) => Math.max(max, n.z), 0);

  return db.note.create({
    data: { userId, body, colour, x, y, z: topZ + 1 },
    select: FIELDS,
  });
}

export async function updateNote(
  userId: string,
  noteId: string,
  data: Partial<Pick<Note, "body" | "colour" | "x" | "y" | "z">>,
): Promise<boolean> {
  const result = await db.note.updateMany({
    where: { id: noteId, userId },
    data,
  });
  return result.count > 0;
}

/** Brings a note to the front. Called when you pick one up. */
export async function raiseNote(userId: string, noteId: string): Promise<number> {
  const top = await db.note.aggregate({
    where: { userId, archivedAt: null },
    _max: { z: true },
  });
  const z = (top._max.z ?? 0) + 1;
  await db.note.updateMany({ where: { id: noteId, userId }, data: { z } });
  return z;
}

/**
 * Archived rather than deleted. A note is usually a thought you had
 * once, and losing it to a stray click is worse than keeping a row.
 */
export async function archiveNote(
  userId: string,
  noteId: string,
): Promise<boolean> {
  const result = await db.note.updateMany({
    where: { id: noteId, userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  return result.count > 0;
}

export async function getNote(
  userId: string,
  noteId: string,
): Promise<Note | null> {
  return db.note.findFirst({ where: { id: noteId, userId } });
}

/** Snaps everything back to a grid, in reading order. */
export async function tidyNotes(userId: string): Promise<number> {
  const notes = await db.note.findMany({
    where: { userId, archivedAt: null },
    select: { id: true },
    orderBy: [{ y: "asc" }, { x: "asc" }],
  });

  const COLS = 5;
  await Promise.all(
    notes.map((n, i) =>
      db.note.updateMany({
        where: { id: n.id, userId },
        data: {
          x: 16 + (i % COLS) * (NOTE_WIDTH + 16),
          y: 16 + Math.floor(i / COLS) * (NOTE_HEIGHT + 16),
        },
      }),
    ),
  );

  return notes.length;
}

/** Links a note to the task it became. */
export async function setNoteTaskId(
  userId: string,
  noteId: string,
  taskId: string,
): Promise<boolean> {
  const result = await db.note.updateMany({
    where: { id: noteId, userId },
    data: { taskId },
  });
  return result.count > 0;
}
