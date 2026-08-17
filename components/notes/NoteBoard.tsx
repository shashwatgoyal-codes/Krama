"use client";

import { useState, useTransition } from "react";
import StickyNote from "./StickyNote";
import { createNote, tidyBoard } from "@/app/app/notes/actions";
import { NOTE_COLOURS, NOTE_TINT, type NoteItem } from "@/lib/notes";
import type { TagChip } from "@/lib/tags";

export default function NoteBoard({
  notes,
  allTags = [],
}: {
  notes: NoteItem[];
  allTags?: TagChip[];
}) {
  const [colour, setColour] = useState<string>("n1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(formData: FormData) {
    setError(null);
    formData.set("colour", colour);
    startTransition(async () => {
      const result = await createNote(formData);
      if (!result.ok) setError(result.error);
    });
  }

  // The board is as tall as the lowest note plus room to drag into.
  const lowest = notes.reduce((max, n) => Math.max(max, n.y), 0);
  const boardHeight = Math.max(560, lowest + 320);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ln bg-surf px-4 py-2.5">
        <form action={add} className="flex min-w-0 flex-1 gap-2">
          <input
            name="body"
            required
            maxLength={1000}
            disabled={pending}
            placeholder="Write a note…"
            aria-label="New note"
            className="min-w-0 flex-1 rounded-[9px] border border-ln2 bg-surf px-[11px] py-1.5 text-[13px] text-ink placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft"
          />
          <button
            type="submit"
            disabled={pending}
            className="cursor-pointer rounded-[9px] border border-ink bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper transition-colors hover:border-ink2 hover:bg-ink2 disabled:opacity-50"
          >
            Add
          </button>
        </form>

        <div className="flex items-center gap-1.5">
          {NOTE_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Use colour ${c}`}
              aria-pressed={colour === c}
              onClick={() => setColour(c)}
              className={`size-5 rounded-md border ${NOTE_TINT[c]} ${
                colour === c ? "ring-2 ring-ink ring-offset-1 ring-offset-surf" : ""
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={() => startTransition(() => tidyBoard().then(() => {}))}
          className="rounded-[9px] border border-ln2 bg-surf px-3 py-1.5 text-[12.5px] font-semibold text-ink2 transition-colors hover:border-acc hover:text-acc"
        >
          Tidy
        </button>

        <span className="label-xs tabular">{notes.length}</span>
      </div>

      {error && (
        <p role="alert" className="border-b border-bad bg-bad-soft px-4 py-2 text-[12px] text-ink">
          {error}
        </p>
      )}

      {/* board */}
      {notes.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6 py-16">
          <div className="max-w-[44ch] text-center">
            <p className="font-display text-[15px] font-semibold">
              An empty board
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
              This is for the thoughts that aren&rsquo;t tasks yet — half an
              idea, a question to ask someone, something to look at later.
              Write one above, then drag it wherever it belongs.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
              When a note turns out to be something you&rsquo;ll actually do,
              hover it and press <span className="font-semibold text-ink">→ Task</span>.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="relative flex-1 overflow-auto"
          style={{
            backgroundImage:
              "radial-gradient(var(--ln) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        >
          <div className="relative" style={{ height: boardHeight, minWidth: 1100 }}>
            {notes.map((n) => (
              <StickyNote key={n.id} note={n} allTags={allTags} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
