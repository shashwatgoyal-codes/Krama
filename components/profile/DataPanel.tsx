"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { inputClass } from "./Row";
import SettingRow from "./SettingRow";
import { recountScore, eraseAllContent } from "@/app/app/profile/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * What the account contains, and the two ways to empty it.
 *
 * There is no export and no import. Export was built and then taken out
 * deliberately: it handed over a file containing the points history,
 * which is the one thing in here worth tampering with, and it invited an
 * import that could never safely accept one back. What this page is for
 * is telling you how much you have actually done.
 */
export default function DataPanel({
  counts,
  memberSince,
}: {
  counts: {
    tasksDone: number;
    tasks: number;
    notes: number;
    events: number;
    links: number;
  };
  memberSince: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);
  const [pending, startTransition] = useTransition();

  const open = Math.max(0, counts.tasks - counts.tasksDone);

  return (
    <div className="flex flex-col gap-5">
      {/* The headline is what you finished, not how many rows exist. */}
      <div className="rounded-xl border border-ln bg-surf2 px-4 py-5 text-center">
        <p className="tabular font-display text-[34px] font-semibold leading-none text-ink">
          {counts.tasksDone}
        </p>
        <p className="mt-2 text-[12.5px] text-mut">
          {counts.tasksDone === 1 ? "task finished" : "tasks finished"} since{" "}
          {memberSince}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ln bg-ln sm:grid-cols-4">
        {[
          { label: "Still open", value: open },
          { label: "Notes", value: counts.notes },
          { label: "Events", value: counts.events },
          { label: "Saved links", value: counts.links },
        ].map((s) => (
          <div key={s.label} className="bg-surf px-3 py-2.5">
            <p className="label-xs">{s.label}</p>
            <p className="tabular mt-0.5 font-display text-[17px] font-semibold">
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-ln">
        <SettingRow
          label="Fix my score"
          description="If your level or streak looks wrong, this recounts it from your actual history. It can only move the number toward the record."
        >
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => {
              setError(null);
              setNotice(null);
              startTransition(async () => {
                const result = await recountScore();
                if (result.ok && typeof result.data === "string")
                  setNotice(result.data);
                else if (!result.ok) setError(result.error);
              });
            }}
          >
            {pending ? "Counting…" : "Recount"}
          </Button>
        </SettingRow>
      </div>

      {notice && <p className="text-[11.5px] font-semibold text-ok">{notice}</p>}

      <div className="rounded-lg border border-bad">
        <div className="border-b border-bad/40 bg-bad-soft px-3 py-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-bad">
            Danger zone
          </p>
          <p className="mt-0.5 text-[11px] text-mut">These cannot be undone</p>
        </div>

        <div className="px-3 py-3">
          <p className="text-[12px] font-semibold text-ink">
            Erase all my content
          </p>
          <p className="mt-1 max-w-[52ch] text-[11.5px] leading-relaxed text-mut">
            Deletes every task, note, event and link, and resets your score.
            Your account, areas and tags stay, so you can start fresh. There is
            no export, so none of it comes back.
          </p>

          {erasing ? (
            <form
              action={(data) => {
                setError(null);
                startTransition(async () => {
                  const result = await eraseAllContent(data);
                  if (result.ok) {
                    setErasing(false);
                    setNotice("Everything erased. Your account is untouched.");
                    // Erasing empties every other screen, so the
                    // confirmation should not be buried in this panel.
                    toast.success("Everything erased.");
                  } else setError(result.error);
                });
              }}
              className="mt-2.5"
            >
              <label htmlFor="erase-confirm" className="label-xs mb-1 block">
                Type <span className="font-mono text-bad">delete</span> to
                confirm
              </label>
              <div className="flex flex-wrap gap-2">
                <input
                  id="erase-confirm"
                  name="confirm"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  className={`max-w-[180px] ${inputClass}`}
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="cursor-pointer rounded-[9px] border border-bad bg-bad px-[13px] py-[7px] text-[12px] font-semibold text-paper disabled:opacity-45"
                >
                  {pending ? "Erasing…" : "Erase content"}
                </button>
                <Button type="button" size="sm" onClick={() => setErasing(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setErasing(true)}
              className="mt-2.5 cursor-pointer rounded-[9px] border border-bad px-[13px] py-[7px] text-[12px] font-semibold text-bad transition-colors hover:bg-bad-soft"
            >
              Erase content
            </button>
          )}
        </div>
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
