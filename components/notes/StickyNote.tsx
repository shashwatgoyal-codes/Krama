"use client";

import { useRef, useState, useTransition } from "react";
import {
  moveNote,
  recolourNote,
  editNote,
  removeNote,
  noteToTask,
} from "@/app/app/notes/actions";
import { NOTE_COLOURS, NOTE_TINT, type NoteItem } from "@/lib/notes";

export default function StickyNote({ note }: { note: NoteItem }) {
  const [pos, setPos] = useState({ x: note.x, y: note.y });
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();
  const dragging = useRef<{ dx: number; dy: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function onPointerDown(e: React.PointerEvent) {
    // Only the note body drags; buttons and the textarea handle their own.
    if ((e.target as HTMLElement).closest("[data-no-drag]")) return;
    if (editing) return;

    const rect = ref.current!.getBoundingClientRect();
    dragging.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    ref.current!.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const board = ref.current!.parentElement!.getBoundingClientRect();
    setPos({
      x: Math.max(0, Math.round(e.clientX - board.left - dragging.current.dx)),
      y: Math.max(0, Math.round(e.clientY - board.top - dragging.current.dy)),
    });
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = null;
    ref.current!.releasePointerCapture(e.pointerId);

    // Saved on drop, not on every move — one write per gesture.
    startTransition(async () => {
      const data = new FormData();
      data.set("id", note.id);
      data.set("x", String(pos.x));
      data.set("y", String(pos.y));
      await moveNote(data);
    });
  }

  function act(fn: (f: FormData) => Promise<unknown>, extra?: [string, string]) {
    startTransition(async () => {
      const data = new FormData();
      data.set("id", note.id);
      if (extra) data.set(extra[0], extra[1]);
      await fn(data);
    });
  }

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ left: pos.x, top: pos.y, zIndex: note.z }}
      className={
        "group absolute w-[190px] cursor-grab touch-none rounded-[3px] border p-3 shadow-md active:cursor-grabbing " +
        (NOTE_TINT[note.colour] ?? NOTE_TINT.n1)
      }
    >
      {editing ? (
        <form
          data-no-drag
          action={(f) => {
            f.set("id", note.id);
            startTransition(async () => {
              await editNote(f);
              setEditing(false);
            });
          }}
        >
          <textarea
            name="body"
            defaultValue={note.body}
            autoFocus
            rows={5}
            maxLength={1000}
            className="w-full resize-none rounded-sm border border-ln2/40 bg-surf/60 p-1.5 text-[12.5px] leading-snug text-ink focus:outline-none"
          />
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="submit"
              className="rounded border border-ink bg-ink px-2 py-1 text-[10.5px] font-semibold text-paper"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded border border-ln2 px-2 py-1 text-[10.5px] font-semibold text-mut"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="min-h-[72px] whitespace-pre-wrap break-words text-[12.5px] leading-snug text-ink">
            {note.body}
          </p>

          {note.taskId && (
            <span className="mt-1.5 inline-block rounded border border-ok px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-ok">
              is a task
            </span>
          )}

          {/* Controls stay hidden until hover so the board reads as notes,
              not as a toolbar. Always available to keyboard users. */}
          <div
            data-no-drag
            className="mt-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100"
          >
            {NOTE_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => act(recolourNote, ["colour", c])}
                className={`size-3 rounded-full border ${NOTE_TINT[c]} ${
                  note.colour === c ? "ring-1 ring-ink" : ""
                }`}
              />
            ))}

            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-auto rounded px-1 text-[10px] font-semibold text-ink/70 hover:text-ink"
            >
              Edit
            </button>
            {!note.taskId && (
              <button
                type="button"
                onClick={() => act(noteToTask)}
                title="Make this a task"
                className="rounded px-1 text-[10px] font-semibold text-ink/70 hover:text-ink"
              >
                → Task
              </button>
            )}
            <button
              type="button"
              onClick={() => act(removeNote)}
              aria-label="Remove note"
              className="rounded px-1 text-[10px] font-semibold text-ink/70 hover:text-bad"
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}
