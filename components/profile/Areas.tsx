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

export default function Areas({ areas }: { areas: AreaRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
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

  return (
    <div className="flex flex-col gap-3">
      {areas.length === 0 && (
        <p className="rounded-lg border border-dashed border-ln2 px-3 py-4 text-center text-[11.5px] text-mut">
          No areas yet. Everything will sit under &ldquo;Unfiled&rdquo; until
          you add one.
        </p>
      )}

      {areas.map((area, index) => (
        <div key={area.id} className="rounded-lg border border-ln bg-surf">
          {editing === area.id ? (
            <form
              action={(data) => run(editArea, data, () => setEditing(null))}
              className="flex flex-wrap items-end gap-2 p-2.5"
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

              <ColourPicker defaultValue={area.colour} />

              <div className="flex gap-1.5">
                <Button type="submit" variant="primary" size="sm" disabled={pending}>
                  Save
                </Button>
                <Button type="button" size="sm" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5 px-3 py-2.5">
              <span
                aria-hidden
                className={`size-3 flex-none rounded-full ${AREA_DOT[area.colour] ?? "bg-mut"}`}
              />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                {area.name}
              </span>

              <span className="label-xs tabular flex-none">
                {area.items} {area.items === 1 ? "item" : "items"}
                {" · "}
                {area.minutesThisWeek >= 60
                  ? `${Math.round(area.minutesThisWeek / 60)}h this week`
                  : `${area.minutesThisWeek}m this week`}
              </span>

              <div className="flex flex-none gap-1">
                <IconButton
                  label={`Move ${area.name} up`}
                  disabled={pending || index === 0}
                  onClick={() => move(area.id, "up")}
                >
                  ↑
                </IconButton>
                <IconButton
                  label={`Move ${area.name} down`}
                  disabled={pending || index === areas.length - 1}
                  onClick={() => move(area.id, "down")}
                >
                  ↓
                </IconButton>
                <Button type="button" size="sm" onClick={() => setEditing(area.id)}>
                  Edit
                </Button>
              </div>
            </div>
          )}

          {confirming === area.id ? (
            <div className="border-t border-ln bg-bad-soft px-3 py-2.5">
              <p className="text-[11.5px] leading-relaxed text-ink">
                Delete <span className="font-semibold">{area.name}</span>?{" "}
                {area.totalTasks > 0 ? (
                  <>
                    Its {area.totalTasks}{" "}
                    {area.totalTasks === 1
                      ? "task stays — it just becomes unfiled."
                      : "tasks stay — they just become unfiled."}
                  </>
                ) : (
                  "Nothing is filed under it."
                )}
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", area.id);
                    run(removeArea, data, () => setConfirming(null));
                  }}
                  className="cursor-pointer rounded-[9px] border border-bad bg-bad px-[11px] py-1 text-[11.5px] font-semibold text-paper disabled:opacity-50"
                >
                  Delete it
                </button>
                <Button type="button" size="sm" onClick={() => setConfirming(null)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            editing !== area.id && (
              <button
                type="button"
                onClick={() => setConfirming(area.id)}
                className="cursor-pointer border-t border-ln px-3 py-1.5 text-[11px] text-fai hover:text-bad"
              >
                Delete
              </button>
            )
          )}
        </div>
      ))}

      <form
        action={(data) => run(addArea, data)}
        className="flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-ln2 p-2.5"
      >
        <div className="min-w-[140px] flex-1">
          <label htmlFor="new-area" className="label-xs mb-1 block">
            New area
          </label>
          <input
            id="new-area"
            name="name"
            required
            maxLength={40}
            placeholder="Office, Research, Health…"
            className={inputClass}
          />
        </div>
        <ColourPicker defaultValue="acc" />
        <Button type="submit" size="sm" disabled={pending}>
          Add
        </Button>
      </form>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
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

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-[26px] cursor-pointer place-items-center rounded-md border border-ln2 text-[12px] text-ink2 transition-colors hover:border-acc hover:text-acc disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
