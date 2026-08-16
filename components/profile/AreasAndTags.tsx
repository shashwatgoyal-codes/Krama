"use client";

import { useState, useTransition, useRef } from "react";
import Button from "@/components/ui/Button";
import { inputClass } from "./Row";
import SettingRow from "./SettingRow";
import { AREA_COLOURS, AREA_DOT } from "@/lib/areas";
import { addArea, editArea, removeArea } from "@/app/app/profile/areas-actions";
import { addTag, removeTag, setDefaultArea } from "@/app/app/profile/tags-actions";

export type AreaRow = {
  id: string;
  name: string;
  colour: string;
  items: number;
  minutesThisWeek: number;
  totalTasks: number;
};

export type TagView = { id: string; name: string; stale: boolean };

/**
 * One panel, as drawn: areas and tags are the same idea at two scales —
 * a few big buckets, and free-form labels that cut across them — and
 * splitting them into separate cards made them look unrelated.
 *
 * Reordering is gone. The design shows one control per area, Edit, and
 * an order you have to operate two arrows to change is a feature for
 * the five minutes a year you care about it. Areas sort by name.
 */
export default function AreasAndTags({
  areas,
  tags,
  defaultAreaId,
  staleCount,
}: {
  areas: AreaRow[];
  tags: TagView[];
  defaultAreaId: string | null;
  staleCount: number;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [addingArea, setAddingArea] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showStale, setShowStale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const tagForm = useRef<HTMLFormElement>(null);

  function run(
    action: (d: FormData) => Promise<{ ok: boolean; error?: string }>,
    data: FormData,
    onOk?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (result.ok) onOk?.();
      else if (result.error) setError(result.error);
    });
  }

  const shown = showStale ? tags.filter((t) => t.stale) : tags;

  const thisWeek = (m: number) =>
    m >= 60 ? `${Math.round(m / 60)}h this week` : `${m}m this week`;

  return (
    <div>
      {/* ---------------------------------------------------- areas */}
      <Heading label="Areas" count={`${areas.length} active`} />

      {areas.length === 0 && (
        <p className="border-b border-ln py-2.5 text-[11.5px] text-mut">
          No areas yet. Everything sits under &ldquo;Unfiled&rdquo;.
        </p>
      )}

      {areas.map((area) => (
        <div key={area.id} className="border-b border-ln">
          <div className="flex items-center gap-2.5 py-2.5">
            <span
              aria-hidden
              className={`size-2.5 flex-none rounded-full ${AREA_DOT[area.colour] ?? "bg-mut"}`}
            />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
              {area.name}
            </span>
            <span className="label-xs tabular hidden flex-none sm:block">
              {area.items} {area.items === 1 ? "item" : "items"}
            </span>
            <span className="label-xs tabular w-[92px] flex-none text-right">
              {thisWeek(area.minutesThisWeek)}
            </span>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setEditing(editing === area.id ? null : area.id);
                setConfirming(null);
              }}
            >
              {editing === area.id ? "Done" : "Edit"}
            </Button>
          </div>

          {editing === area.id && (
            <form
              action={(d) => run(editArea, d, () => setEditing(null))}
              className="mb-2.5 flex flex-wrap items-end gap-3 rounded-lg border border-ln bg-surf2 p-3"
            >
              <input type="hidden" name="id" value={area.id} />
              <div className="min-w-[140px] flex-1">
                <label className="label-xs mb-1 block">Name</label>
                <input
                  name="name"
                  defaultValue={area.name}
                  required
                  maxLength={40}
                  className={inputClass}
                />
              </div>
              <Colours defaultValue={area.colour} />
              <Button type="submit" variant="primary" size="sm" disabled={pending}>
                Save
              </Button>

              {confirming === area.id ? (
                <span className="flex w-full flex-wrap items-center gap-2 border-t border-ln pt-2.5 text-[11px] text-mut">
                  {area.totalTasks > 0
                    ? `Its ${area.totalTasks} ${area.totalTasks === 1 ? "task stays" : "tasks stay"}, unfiled.`
                    : "Nothing is filed under it."}
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const d = new FormData();
                      d.set("id", area.id);
                      run(removeArea, d, () => {
                        setConfirming(null);
                        setEditing(null);
                      });
                    }}
                    className="cursor-pointer rounded-[9px] border border-bad bg-bad px-2.5 py-1 text-[11.5px] font-semibold text-paper disabled:opacity-50"
                  >
                    Delete it
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming(null)}
                    className="cursor-pointer text-[11.5px] font-semibold text-mut hover:text-ink"
                  >
                    Keep
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirming(area.id)}
                  className="w-full cursor-pointer border-t border-ln pt-2.5 text-left text-[11.5px] font-semibold text-bad hover:underline"
                >
                  Delete this area
                </button>
              )}
            </form>
          )}
        </div>
      ))}

      {addingArea ? (
        <form
          action={(d) => run(addArea, d, () => setAddingArea(false))}
          className="mt-2.5 flex flex-wrap items-end gap-3 rounded-lg border border-ln bg-surf2 p-3"
        >
          <div className="min-w-[140px] flex-1">
            <label htmlFor="new-area" className="label-xs mb-1 block">
              Name
            </label>
            <input
              id="new-area"
              name="name"
              required
              autoFocus
              maxLength={40}
              placeholder="Office, Research, Health…"
              className={inputClass}
            />
          </div>
          <Colours defaultValue="acc" />
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            Add
          </Button>
          <Button type="button" size="sm" onClick={() => setAddingArea(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Add label="+ New area" onClick={() => setAddingArea(true)} />
      )}

      {/* ----------------------------------------------------- tags */}
      <Heading label="Tags" count={`${tags.length} used`} top />

      {/* Chips exactly as drawn: mono, small, uppercase, and quiet.
          They are labels, not controls — which is why there is no x on
          them. Removing one happens under Review, where tidying is
          what you came to do. */}
      <div className="flex flex-wrap items-center gap-1.5 py-2">
        {shown.length === 0 ? (
          <span className="text-[11.5px] text-mut">
            {showStale
              ? "Nothing stale — everything here is in use."
              : "No tags yet."}
          </span>
        ) : (
          shown.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-[4px] border border-ln bg-surf2 px-[7px] py-[3px] font-mono text-[10px] uppercase tracking-[0.05em] text-mut"
            >
              {tag.name}
              {showStale && (
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Remove ${tag.name}`}
                  onClick={() => {
                    const d = new FormData();
                    d.set("id", tag.id);
                    run(removeTag, d);
                  }}
                  className="cursor-pointer text-fai hover:text-bad"
                >
                  ×
                </button>
              )}
            </span>
          ))
        )}

        {addingTag ? (
          <form
            ref={tagForm}
            action={(d) => run(addTag, d, () => tagForm.current?.reset())}
            className="flex items-center gap-1.5"
          >
            <input
              name="name"
              required
              autoFocus
              maxLength={32}
              placeholder="new tag"
              aria-label="New tag"
              className="w-[140px] rounded-[4px] border border-ln2 bg-surf px-[7px] py-[3px] font-mono text-[10px] uppercase tracking-[0.05em] text-ink placeholder:text-fai focus:border-acc focus:outline-none"
            />
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer rounded-[4px] border border-acc bg-acc-soft px-[7px] py-[3px] font-mono text-[10px] uppercase tracking-[0.05em] text-acc"
            >
              add
            </button>
            <button
              type="button"
              onClick={() => setAddingTag(false)}
              className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.05em] text-fai hover:text-ink"
            >
              done
            </button>
          </form>
        ) : (
          // The design makes "+ add" a chip of the same size with a
          // dashed edge, sitting at the end of the row — so adding one
          // reads as the next item rather than a control below the list.
          <button
            type="button"
            onClick={() => setAddingTag(true)}
            className="cursor-pointer rounded-[4px] border border-dashed border-ln2 px-[7px] py-[3px] font-mono text-[10px] uppercase tracking-[0.05em] text-fai transition-colors hover:border-acc hover:text-acc"
          >
            + add
          </button>
        )}
      </div>

      {/* --------------------------------------------------- settings */}
      <div className="mt-4 border-t border-ln">
        <SettingRow
          label="Where quick notes go"
          description="When you capture something fast and don't pick an area, it lands here."
          help="Anything created without an area — a note turned into a task, a saved link made into one — is filed here instead of sitting unfiled forever."
          htmlFor="defaultAreaId"
        >
          <form action={(d) => run(setDefaultArea, d)} className="flex gap-2">
            <select
              id="defaultAreaId"
              name="defaultAreaId"
              defaultValue={defaultAreaId ?? ""}
              className={`w-[150px] ${inputClass}`}
            >
              <option value="">Unfiled</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <Button type="submit" size="sm" disabled={pending}>
              Save
            </Button>
          </form>
        </SettingRow>

        {staleCount > 0 && (
          <SettingRow
            label="Tidy up unused tags"
            description={`${staleCount} ${staleCount === 1 ? "tag hasn't" : "tags haven't"} been used in 90 days.`}
          >
            <Button type="button" size="sm" onClick={() => setShowStale((v) => !v)}>
              {showStale ? "Show all" : "Review"}
            </Button>
          </SettingRow>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function Heading({
  label,
  count,
  top,
}: {
  label: string;
  count: string;
  top?: boolean;
}) {
  return (
    <div
      className={
        "flex items-baseline justify-between gap-3 border-b border-ln pb-1.5 " +
        (top ? "mt-6" : "")
      }
    >
      <span className="font-display text-[13px] font-semibold tracking-[-0.01em]">
        {label}
      </span>
      <span className="label-xs tabular">{count}</span>
    </div>
  );
}

function Add({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-2.5 cursor-pointer text-[12.5px] font-semibold text-acc hover:underline"
    >
      {label}
    </button>
  );
}

function Colours({ defaultValue }: { defaultValue: string }) {
  return (
    <div>
      <span className="label-xs mb-1 block">Colour</span>
      <div className="flex gap-1.5">
        {AREA_COLOURS.map((colour) => (
          <label
            key={colour}
            title={colour}
            className="cursor-pointer rounded-md border border-transparent p-0.5 has-[:checked]:border-ink"
          >
            <input
              type="radio"
              name="colour"
              value={colour}
              defaultChecked={colour === defaultValue}
              className="sr-only"
            />
            <span
              className={`block size-[18px] rounded ${AREA_DOT[colour]}`}
              aria-label={colour}
            />
          </label>
        ))}
      </div>
    </div>
  );
}
