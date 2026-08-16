"use client";

import { useState, useTransition, useRef } from "react";
import Button from "@/components/ui/Button";
import { inputClass } from "./Row";
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
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="label-xs">
            {tags.length} {tags.length === 1 ? "tag" : "tags"}
          </span>
          {staleCount > 0 && (
            <button
              type="button"
              onClick={() => setShowStale((v) => !v)}
              className="cursor-pointer text-[11.5px] font-semibold text-acc hover:underline"
            >
              {showStale
                ? "Show all"
                : `${staleCount} unused in 90 days — review`}
            </button>
          )}
        </div>

        {shown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-ln2 px-3 py-3 text-center text-[11.5px] text-mut">
            {showStale
              ? "Nothing stale. Everything here is in use."
              : "No tags yet. They're free-form, and they mean the same thing on a task, a note or a saved link."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {shown.map((tag) => (
              <span
                key={tag.id}
                className={
                  "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11.5px] " +
                  (tag.stale
                    ? "border-ln2 text-fai"
                    : "border-ln2 bg-surf text-mut")
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

        <form
          ref={form}
          action={(data) => run(addTag, data, () => form.current?.reset())}
          className="mt-2.5 flex gap-2"
        >
          <input
            name="name"
            required
            maxLength={32}
            placeholder="career, deep-work, reading…"
            aria-label="New tag"
            className={`max-w-[240px] ${inputClass}`}
          />
          <Button type="submit" size="sm" disabled={pending}>
            Add
          </Button>
        </form>
      </div>

      <div className="border-t border-ln pt-3">
        <form action={(data) => run(setDefaultArea, data)}>
          <label htmlFor="defaultAreaId" className="label-xs mb-1 block">
            Where quick notes go
          </label>
          <p className="mb-2 max-w-[52ch] text-[11.5px] leading-relaxed text-mut">
            When you capture something fast and don&rsquo;t pick an area, it
            lands here.
          </p>
          <div className="flex gap-2">
            <select
              id="defaultAreaId"
              name="defaultAreaId"
              defaultValue={defaultAreaId ?? ""}
              className={`max-w-[220px] ${inputClass}`}
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
          </div>
        </form>
      </div>

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
