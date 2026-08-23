"use client";

import { useState, useTransition } from "react";
import {
  NOTE_COLOURS,
  NOTE_TINT,
  ageLabel,
  tiltOf,
  type NoteItem,
} from "@/lib/notes";
import type { TagChip } from "@/lib/tags";
import TagField from "@/components/tags/TagField";
import TagChips from "@/components/tags/TagChips";
import {
  editNote,
  recolourNote,
  removeNote,
  noteToTask,
} from "@/app/app/notes/actions";

/**
 * One note.
 *
 * Click the text and you are editing it — there is no edit button and no
 * mode to enter, because a sticky note you have to unlock is not a
 * sticky note. Everything else lives behind hover so the board reads as
 * paper rather than as a toolbar.
 *
 * The slight tilt is fixed per note, derived from its id, so the board
 * looks handmade without anything moving when it re-renders.
 */
export default function StickyNote({
  note,
  areas = [],
  allTags = [],
}: {
  note: NoteItem;
  areas?: { id: string; name: string }[];
  allTags?: TagChip[];
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [pending, startTransition] = useTransition();

  function act(
    action: (data: FormData) => Promise<{ ok: boolean }>,
    extra: [string, string][] = [],
    onDone?: () => void,
  ) {
    const data = new FormData();
    data.set("id", note.id);
    for (const [k, v] of extra) data.set(k, v);
    startTransition(async () => {
      await action(data);
      onDone?.();
    });
  }

  return (
    <div
      style={{ rotate: `${tiltOf(note.id)}deg` }}
      className={
        // Short on a phone, where a note spans the width and a fixed
        // height leaves a hole under one line of text. Taller once the
        // notes sit in columns and need to look like a board.
        "group relative flex min-h-[104px] flex-col rounded-[3px] border p-3 shadow-md transition-transform hover:z-10 hover:rotate-0 sm:min-h-[168px] " +
        (NOTE_TINT[note.colour] ?? NOTE_TINT.n1) +
        (pending ? " opacity-60" : "")
      }
    >
      {editing ? (
        <form
          action={(f) => {
            f.set("id", note.id);
            startTransition(async () => {
              await editNote(f);
              setEditing(false);
            });
          }}
          className="flex flex-1 flex-col"
        >
          <textarea
            name="body"
            defaultValue={note.body}
            autoFocus
            rows={5}
            maxLength={1000}
            className="w-full flex-1 resize-none rounded-sm border border-ln2/40 bg-surf/60 p-1.5 text-[12.5px] leading-snug text-ink focus:outline-none"
          />

          <div className="mt-1.5">
            <select
              name="areaId"
              defaultValue={note.areaId ?? ""}
              className="w-full rounded-sm border border-ln2/40 bg-surf/60 px-1.5 py-1 text-[11px] text-ink focus:outline-none"
            >
              <option value="">Unfiled</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-1.5">
            <TagField selected={note.tags} available={allTags} />
          </div>

          <div className="mt-1.5 flex gap-1.5">
            <button
              type="submit"
              className="cursor-pointer rounded border border-ink bg-ink px-2 py-1 text-[10.5px] font-semibold text-paper"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="cursor-pointer rounded border border-ln2 px-2 py-1 text-[10.5px] font-semibold text-mut"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* The body is the control. Clicking it starts editing. */}
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Edit this note"
            className="flex-1 cursor-text text-left"
          >
            <p className="whitespace-pre-wrap break-words text-[12.5px] leading-snug text-ink">
              {note.body}
            </p>
          </button>

          {note.tags.length > 0 && (
            <div className="mt-1.5">
              <TagChips tags={note.tags} max={3} size="xs" />
            </div>
          )}

          {/* Where it belongs and how long it has been sitting there. */}
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="label-xs truncate">
              {note.areaName ?? "Unfiled"}
              <span className="text-fai"> · {ageLabel(note.ageDays)}</span>
            </span>
            {note.taskId && (
              <span className="label-xs flex-none text-ok">is a task</span>
            )}
          </div>

          {/* Controls stay out of the way until you want them. */}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 flex items-center gap-1 opacity-0 transition-opacity focus-within:pointer-events-auto focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
            {NOTE_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => act(recolourNote, [["colour", c]])}
                className={`size-3 rounded-full border ${NOTE_TINT[c]} ${
                  note.colour === c ? "ring-1 ring-ink" : ""
                }`}
              />
            ))}

            <span className="ml-auto flex items-center gap-1">
              {!note.taskId && (
                <button
                  type="button"
                  title="Make this a task"
                  onClick={() => act(noteToTask)}
                  className="rounded border border-ln2 bg-surf/70 px-1.5 py-0.5 text-[9.5px] font-semibold text-mut hover:border-acc hover:text-acc"
                >
                  → task
                </button>
              )}
              {confirmingRemove ? (
                <>
                  <button
                    type="button"
                    onClick={() => act(removeNote)}
                    className="rounded border border-bad bg-bad px-1.5 py-0.5 text-[9.5px] font-semibold text-paper"
                  >
                    Sure?
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingRemove(false)}
                    className="rounded border border-ln2 bg-surf/70 px-1.5 py-0.5 text-[9.5px] font-semibold text-mut"
                  >
                    No
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  title="Remove"
                  onClick={() => setConfirmingRemove(true)}
                  className="rounded border border-ln2 bg-surf/70 px-1.5 py-0.5 text-[9.5px] font-semibold text-mut hover:border-bad hover:text-bad"
                >
                  ×
                </button>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
