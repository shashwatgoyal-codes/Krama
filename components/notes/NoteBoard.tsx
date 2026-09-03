"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  NOTE_COLOURS,
  NOTE_TINT,
  ageLabel,
  noteTitle,
  notePreview,
  type NoteItem,
} from "@/lib/notes";
import type { TagChip } from "@/lib/tags";
import TagField from "@/components/tags/TagField";
import {
  createNote,
  editNote,
  recolourNote,
  removeNote,
  noteToTask,
} from "@/app/app/notes/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * Notes: a list of what you have written, and the one you are reading.
 *
 * The board came first and was the wrong shape. A wall of sticky notes
 * looks like note-taking without supporting it: everything is truncated
 * to fit a square, nothing is comfortable to write more than a line in,
 * and finding an old one means scanning a mosaic. The apps people
 * actually keep notes in all settled on the same arrangement, and it is
 * this one.
 *
 * Selection is local rather than in the URL, because switching notes
 * should be instant and a round trip to the server is not.
 */
export default function NoteBoard({
  notes,
  areas = [],
  allTags = [],
}: {
  notes: NoteItem[];
  areas: { id: string; name: string }[];
  allTags?: TagChip[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    notes[0]?.id ?? null,
  );
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const editor = useRef<HTMLTextAreaElement>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => n.body.toLowerCase().includes(q));
  }, [notes, query]);

  /**
   * The selection, resolved at render rather than synced in an effect.
   *
   * Deleting the open note or filtering it away should land you on
   * something rather than on nothing, and falling back here means the
   * list is never briefly pointing at a note that is not in it.
   */
  const selected = shown.find((n) => n.id === selectedId) ?? shown[0] ?? null;

  function act(
    action: (data: FormData) => Promise<{ ok: boolean; error?: string }>,
    extra: [string, string][],
  ) {
    const data = new FormData();
    for (const [k, v] of extra) data.set(k, v);
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok && result.error) setError(result.error);
    });
  }

  function newNote() {
    // Pressing + twice should not leave a trail of blank notes. If there
    // is already an empty one, that is the new note — open it instead of
    // making a second identical nothing.
    const blank = notes.find((n) => n.body.trim() === "");
    if (blank) {
      setQuery("");
      setSelectedId(blank.id);
      setTimeout(() => editor.current?.focus(), 60);
      return;
    }

    const data = new FormData();
    data.set("body", "");
    data.set("colour", NOTE_COLOURS[0]);
    setError(null);
    startTransition(async () => {
      const result = await createNote(data);
      if (!result.ok) {
        setError(result.error ?? "Couldn't add that.");
        return;
      }
      if (result.data) setSelectedId(result.data);
      setQuery("");
      setTimeout(() => editor.current?.focus(), 60);
      toast.success("Note added.");
    });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] md:grid-cols-[minmax(240px,300px)_1fr] md:grid-rows-1">
      {/* the list */}
      <aside className="flex min-h-0 flex-col border-b border-ln md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 border-b border-ln px-3 py-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
            className="field min-w-0 flex-1"
          />
          <button
            type="button"
            onClick={newNote}
            disabled={pending}
            className="flex-none cursor-pointer whitespace-nowrap rounded-[9px] border border-ink bg-ink px-3 py-1.5 text-[12.5px] font-semibold leading-none text-paper transition-colors hover:border-ink2 hover:bg-ink2 disabled:opacity-50"
          >
            New note
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {shown.length === 0 ? (
            <p className="px-3 py-8 text-center text-[12px] leading-relaxed text-mut">
              {notes.length === 0
                ? "No notes yet. Press New note and start writing."
                : "Nothing matches that."}
            </p>
          ) : (
            <ul className="divide-y divide-ln">
              {shown.map((note) => {
                const on = note.id === selectedId;
                return (
                  <li key={note.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(note.id)}
                      aria-current={on ? "true" : undefined}
                      className={
                        "w-full cursor-pointer px-3 py-2.5 text-left transition-colors " +
                        (on ? "bg-acc-soft" : "hover:bg-surf2")
                      }
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className={`size-2 flex-none rounded-full border ${NOTE_TINT[note.colour] ?? NOTE_TINT.n1}`}
                        />
                        <span
                          className={
                            "min-w-0 flex-1 truncate text-[12.5px] " +
                            (on
                              ? "font-semibold text-acc"
                              : "font-semibold text-ink")
                          }
                        >
                          {noteTitle(note.body)}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-baseline gap-1.5 pl-3.5">
                        <span className="label-xs flex-none">
                          {ageLabel(note.ageDays)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[11.5px] text-mut">
                          {notePreview(note.body) || "No additional text"}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* the note */}
      <section className="flex min-h-0 flex-col">
        {!selected ? (
          <p className="mx-auto mt-20 max-w-[34ch] px-4 text-center text-[12.5px] leading-relaxed text-mut">
            Nothing selected. Press New note to write something down.
          </p>
        ) : (
          <form
            key={selected.id}
            action={(f) => {
              f.set("id", selected.id);
              setError(null);
              startTransition(async () => {
                const result = await editNote(f);
                if (!result.ok && result.error) setError(result.error);
              });
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <textarea
              ref={editor}
              name="body"
              defaultValue={selected.body}
              maxLength={1000}
              placeholder="Write here. The first line becomes the title."
              className="min-h-0 flex-1 resize-none bg-transparent px-5 py-4 text-[13.5px] leading-relaxed text-ink placeholder:text-fai focus:outline-none"
            />

            <div className="flex flex-wrap items-center gap-3 border-t border-ln px-4 py-2.5">
              <select
                name="areaId"
                defaultValue={selected.areaId ?? ""}
                className="field field-sm"
              >
                <option value="">Unfiled</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                {NOTE_COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Colour ${c}`}
                    aria-pressed={selected.colour === c}
                    onClick={() =>
                      act(recolourNote, [
                        ["id", selected.id],
                        ["colour", c],
                      ])
                    }
                    className={
                      `size-4 rounded-full border ${NOTE_TINT[c]} cursor-pointer ` +
                      (selected.colour === c
                        ? "ring-2 ring-ink"
                        : "opacity-70 hover:opacity-100")
                    }
                  />
                ))}
              </div>

              <div className="min-w-[160px] flex-1">
                <TagField selected={selected.tags} available={allTags} />
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <button
                  type="submit"
                  disabled={pending}
                  className="cursor-pointer rounded-[9px] border border-ink bg-ink px-3 py-1.5 text-[12px] font-semibold text-paper transition-colors hover:border-ink2 hover:bg-ink2 disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save"}
                </button>
                {!selected.taskId && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => act(noteToTask, [["id", selected.id]])}
                    className="cursor-pointer rounded-[9px] border border-ln2 px-3 py-1.5 text-[12px] font-semibold text-mut transition-colors hover:border-acc hover:text-acc disabled:opacity-50"
                  >
                    Make a task
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  aria-label="Delete this note"
                  onClick={() => act(removeNote, [["id", selected.id]])}
                  className="cursor-pointer rounded-[9px] border border-ln2 px-3 py-1.5 text-[12px] font-semibold text-mut transition-colors hover:border-bad hover:text-bad disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="px-4 pb-2 text-[11.5px] text-bad">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
