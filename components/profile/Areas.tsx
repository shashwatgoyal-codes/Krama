"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { inputClass } from "./Row";
import { addArea, editArea, removeArea, moveArea } from "@/app/app/profile/areas-actions";
import { AREA_COLOURS, AREA_DOT } from "@/lib/areas";

export type AreaRow = {
  id: string;
  name: string;
  colour: string;
  items: number;
  minutesThisWeek: number;
  totalTasks: number;
};

/**
 * Areas as plain rows, as drawn: a dot, the name, what is filed under it
 * and how long it took this week, then Edit.
 *
 * Colour, order and delete all live inside Edit rather than on the row.
 * A row carrying its own delete link and two reorder arrows is four
 * controls for something you read far more often than you change.
 */
export default function Areas({ areas }: { areas: AreaRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function move(id: string, direction: "up" | "down") {
    const data = new FormData();
    data.set("id", id);
    data.set("direction", direction);
    run(moveArea, data);
  }

  const thisWeek = (minutes: number) =>
    minutes >= 60
      ? `${Math.round(minutes / 60)}h this week`
      : `${minutes}m this week`;

  return (
    <div>
      {areas.length === 0 && (
        <p className="border-b border-ln py-3 text-[11.5px] text-mut">
          No areas yet. Everything sits under &ldquo;Unfiled&rdquo; until you
          add one.
        </p>
      )}

      {areas.map((area, index) => (
        <div key={area.id} className="border-b border-ln last:border-b-0">
          <div className="flex flex-wrap items-center gap-3 py-3">
            <span
              aria-hidden
              className={`size-2.5 flex-none rounded-full ${AREA_DOT[area.colour] ?? "bg-mut"}`}
            />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
              {area.name}
            </span>
            <span className="label-xs tabular flex-none">
              {area.items} {area.items === 1 ? "item" : "items"} ·{" "}
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
            <div className="mb-3 rounded-lg border border-ln bg-surf2 p-3">
              <form
                action={(data) => run(editArea, data, () => setEditing(null))}
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="id" value={area.id} />
                <div className="min-w-[150px] flex-1">
                  <label className="label-xs mb-1 block">Name</label>
                  <input
                    name="name"
                    defaultValue={area.name}
                    required
                    maxLength={40}
                    className={inputClass}
                  />
                </div>
                <ColourPicker defaultValue={area.colour} />
                <Button type="submit" variant="primary" size="sm" disabled={pending}>
                  Save
                </Button>
              </form>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-ln pt-3">
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || index === 0}
                    onClick={() => move(area.id, "up")}
                  >
                    Move up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || index === areas.length - 1}
                    onClick={() => move(area.id, "down")}
                  >
                    Move down
                  </Button>
                </div>

                {confirming === area.id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-mut">
                      {area.totalTasks > 0
                        ? `Its ${area.totalTasks} ${
                            area.totalTasks === 1
                              ? "task stays, unfiled"
                              : "tasks stay, unfiled"
                          }.`
                        : "Nothing is filed under it."}
                    </span>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => {
                        const data = new FormData();
                        data.set("id", area.id);
                        run(removeArea, data, () => {
                          setConfirming(null);
                          setEditing(null);
                        });
                      }}
                      className="cursor-pointer rounded-[9px] border border-bad bg-bad px-[11px] py-1 text-[11.5px] font-semibold text-paper disabled:opacity-50"
                    >
                      Delete it
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setConfirming(null)}
                    >
                      Keep
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(area.id)}
                    className="cursor-pointer text-[11.5px] font-semibold text-bad hover:underline"
                  >
                    Delete this area
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <form
          action={(data) => run(addArea, data, () => setAdding(false))}
          className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-ln bg-surf2 p-3"
        >
          <div className="min-w-[150px] flex-1">
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
          <ColourPicker defaultValue="acc" />
          <Button type="submit" variant="primary" size="sm" disabled={pending}>
            Add
          </Button>
          <Button type="button" size="sm" onClick={() => setAdding(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 cursor-pointer text-[12.5px] font-semibold text-acc hover:underline"
        >
          + New area
        </button>
      )}

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

function ColourPicker({ defaultValue }: { defaultValue: string }) {
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
