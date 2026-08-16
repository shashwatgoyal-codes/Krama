"use client";

import { useState, useTransition, useRef } from "react";
import Button from "@/components/ui/Button";
import { inputClass } from "./Row";
import SettingRow from "./SettingRow";
import { addTag, removeTag, setDefaultArea } from "@/app/app/profile/tags-actions";

export type TagView = { id: string; name: string; stale: boolean };

export default function Tags({
  tags,
  areas,
  defaultAreaId,
  staleCount,
}: {
  tags: TagView[];
  areas: { id: string; name: string }[];
  defaultAreaId: string | null;
  staleCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [showStale, setShowStale] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

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

  return (
    <div>
      <div className="border-b border-ln pb-3">
        {shown.length === 0 ? (
          <p className="text-[11.5px] text-mut">
            {showStale
              ? "Nothing stale — everything here is in use."
              : "No tags yet. They're free-form, and they mean the same thing on a task, a note or a saved link."}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5">
            {shown.map((tag) => (
              <span
                key={tag.id}
                className={
                  "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11.5px] " +
                  (tag.stale ? "border-ln2 text-fai" : "border-ln2 bg-surf text-mut")
                }
              >
                {tag.name}
                <button
                  type="button"
                  disabled={pending}
                  aria-label={`Remove ${tag.name}`}
                  onClick={() => {
                    const data = new FormData();
                    data.set("id", tag.id);
                    run(removeTag, data);
                  }}
                  className="cursor-pointer text-fai hover:text-bad"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {adding ? (
          <form
            ref={form}
            action={(data) => run(addTag, data, () => form.current?.reset())}
            className="mt-2.5 flex gap-2"
          >
            <input
              name="name"
              required
              autoFocus
              maxLength={32}
              placeholder="career, deep-work, reading…"
              aria-label="New tag"
              className={`max-w-[220px] ${inputClass}`}
            />
            <Button type="submit" size="sm" disabled={pending}>
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
            className="mt-2.5 cursor-pointer text-[12.5px] font-semibold text-acc hover:underline"
          >
            + add
          </button>
        )}
      </div>

      <SettingRow
        label="Where quick notes go"
        description="When you capture something fast and don't pick an area, it lands here."
        help="Anything created without an area — a note turned into a task, a saved link made into one — is filed here instead of sitting unfiled forever."
        htmlFor="defaultAreaId"
      >
        <form action={(data) => run(setDefaultArea, data)} className="flex gap-2">
          <select
            id="defaultAreaId"
            name="defaultAreaId"
            defaultValue={defaultAreaId ?? ""}
            className={`w-[160px] ${inputClass}`}
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
