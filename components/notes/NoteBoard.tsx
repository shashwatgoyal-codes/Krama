"use client";

import { useMemo, useState, useTransition } from "react";
import { NOTE_COLOURS, NOTE_TINT, type NoteItem } from "@/lib/notes";
import type { TagChip } from "@/lib/tags";
import StickyNote from "./StickyNote";
import { createNote } from "@/app/app/notes/actions";

/**
 * The board.
 *
 * Notes flow into a grid rather than sitting where they were dropped.
 * Dragging was the original idea and it is the wrong primary gesture:
 * arranging a board is work, and the one screen that exists to catch a
 * thought quickly should not ask you to do any. Newest first, so the
 * thing you just wrote is where you left it.
 *
 * The positions are still stored. Nothing is lost if scattering ever
 * comes back as a view.
 *
 * Tidy is gone with the mess it existed to clean up. A button that
 * squares up a board which is never crooked is a button that does
 * nothing, and the app has had enough of those.
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
  const [colour, setColour] = useState<string>(NOTE_COLOURS[0]);
  const [draft, setDraft] = useState("");
  const [byColour, setByColour] = useState<string | null>(null);
  const [byTag, setByTag] = useState<string | null>(null);
  const [byArea, setByArea] = useState<string | null>(null);
  const [filtering, setFiltering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const shown = useMemo(
    () =>
      notes.filter((n) => {
        if (byColour && n.colour !== byColour) return false;
        if (byArea && n.areaId !== byArea) return false;
        if (byTag && !n.tags.some((t) => t.id === byTag)) return false;
        return true;
      }),
    [notes, byColour, byArea, byTag],
  );

  const filtered = Boolean(byColour || byTag || byArea);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    const data = new FormData();
    data.set("body", body);
    data.set("colour", colour);
    startTransition(async () => {
      const result = await createNote(data);
      if (result.ok) setDraft("");
      else setError(result.error);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ln bg-surf px-4 py-2.5">
        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <input
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Write a note…"
            aria-label="New note"
            className="min-w-0 flex-1 rounded-[9px] border border-ln2 bg-surf px-[11px] py-1.5 text-[13px] text-ink placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft disabled:opacity-60"
          />
          <button
            type="button"
            disabled={pending || !draft.trim()}
            onClick={submit}
            className="flex-none cursor-pointer rounded-[9px] border border-ink bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper transition-colors hover:border-ink2 hover:bg-ink2 disabled:cursor-not-allowed disabled:opacity-40"
          >
            + Note
          </button>
        </div>

        {/* the colour it will be written on */}
        <div className="flex flex-none items-center gap-1">
          {NOTE_COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Write on the ${c} note`}
              aria-pressed={colour === c}
              onClick={() => setColour(c)}
              className={
                `size-[18px] rounded-[4px] border ${NOTE_TINT[c]} cursor-pointer transition-transform ` +
                (colour === c ? "ring-2 ring-ink" : "hover:scale-110")
              }
            />
          ))}
        </div>

        <span className="label-xs tabular flex-none">
          {filtered ? `${shown.length} of ${notes.length}` : `${notes.length}`}{" "}
          {notes.length === 1 && !filtered ? "NOTE" : "NOTES"}
        </span>

        <div className="ml-auto flex flex-none items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFiltering((f) => !f)}
            aria-pressed={filtering || filtered}
            className={
              "cursor-pointer rounded-[9px] border px-3 py-1.5 text-[12px] font-semibold transition-colors " +
              (filtered
                ? "border-acc bg-acc-soft text-acc"
                : "border-ln2 text-mut hover:border-acc hover:text-acc")
            }
          >
            Filter
          </button>
        </div>
      </div>

      {/* filters */}
      {(filtering || filtered) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-ln bg-surf2 px-4 py-2">
          <Row label="Colour">
            {NOTE_COLOURS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Only ${c} notes`}
                aria-pressed={byColour === c}
                onClick={() => setByColour(byColour === c ? null : c)}
                className={
                  `size-[16px] rounded-[4px] border ${NOTE_TINT[c]} cursor-pointer ` +
                  (byColour === c ? "ring-2 ring-ink" : "opacity-70 hover:opacity-100")
                }
              />
            ))}
          </Row>

          {areas.length > 0 && (
            <Row label="Area">
              {areas.map((a) => (
                <Chip
                  key={a.id}
                  on={byArea === a.id}
                  onClick={() => setByArea(byArea === a.id ? null : a.id)}
                >
                  {a.name}
                </Chip>
              ))}
            </Row>
          )}

          {allTags.length > 0 && (
            <Row label="Tag">
              {allTags.slice(0, 10).map((t) => (
                <Chip
                  key={t.id}
                  on={byTag === t.id}
                  onClick={() => setByTag(byTag === t.id ? null : t.id)}
                >
                  {t.name}
                </Chip>
              ))}
            </Row>
          )}

          {filtered && (
            <button
              type="button"
              onClick={() => {
                setByColour(null);
                setByTag(null);
                setByArea(null);
              }}
              className="ml-auto cursor-pointer text-[11.5px] font-semibold text-mut underline-offset-2 hover:text-ink hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="px-4 py-1.5 text-[11.5px] text-bad">
          {error}
        </p>
      )}

      {/* the notes */}
      <div className="board-paper min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {shown.length === 0 ? (
          <p className="mx-auto mt-16 max-w-[38ch] text-center text-[12.5px] leading-relaxed text-mut">
            {notes.length === 0
              ? "Nothing here yet. Write the thought down before you lose it — sorting it out can wait."
              : "No notes match that filter."}
          </p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">
            {shown.map((note) => (
              <StickyNote
                key={note.id}
                note={note}
                areas={areas}
                allTags={allTags}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="label-xs">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={
        "cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors " +
        (on
          ? "border-acc bg-acc-soft text-acc"
          : "border-ln2 text-mut hover:border-acc hover:text-acc")
      }
    >
      {children}
    </button>
  );
}
