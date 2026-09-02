"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/validation";
import { SUGGESTION_LABEL, type Suggestion } from "@/lib/capture";

/**
 * One captured line, and the three things it could become.
 *
 * All three are always offered — the suggestion only decides which one
 * is emphasised. A guess that removes options is a guess you have to be
 * right about; a guess that reorders them is one you can be wrong about
 * cheaply, which is the only kind worth making here.
 *
 * The text stays editable. Half the value of triage is fixing what you
 * typed in four seconds while walking.
 */
export default function TriageRow({
  id,
  text,
  suggested,
  capturedAt,
  triage,
  discard,
}: {
  id: string;
  text: string;
  suggested: Suggestion;
  capturedAt: string;
  triage: (fd: FormData) => Promise<ActionResult>;
  discard: (fd: FormData) => Promise<ActionResult>;
}) {
  const [value, setValue] = useState(text);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const file = (as: Suggestion) => () =>
    start(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("id", id);
      fd.set("text", value);
      fd.set("as", as);
      const result = await triage(fd);
      if (!result.ok) setError(result.error);
    });

  const order: Suggestion[] = [
    suggested,
    ...(["task", "note", "link"] as Suggestion[]).filter((s) => s !== suggested),
  ];

  return (
    <div className="rounded-xl border border-ln bg-surf p-3.5">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={value.length > 90 ? 3 : 1}
        className="w-full resize-none bg-transparent text-[13px] focus:outline-none"
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {order.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={file(s)}
            disabled={pending || value.trim().length === 0}
            className={
              "rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-40 " +
              (i === 0
                ? "bg-ink text-paper"
                : "border border-ln2 text-mut hover:bg-surf2 hover:text-ink")
            }
          >
            {SUGGESTION_LABEL[s]}
          </button>
        ))}

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const fd = new FormData();
              fd.set("id", id);
              const result = await discard(fd);
              if (!result.ok) setError(result.error);
            })
          }
          className="ml-auto rounded-md px-2 py-1 text-[11.5px] font-medium text-fai transition-colors hover:text-bad"
        >
          Discard
        </button>
      </div>
      <p className="mt-1.5 text-[10.5px] text-fai">Captured {capturedAt}</p>
      {error && <p className="mt-1 text-[11.5px] text-bad">{error}</p>}
    </div>
  );
}
