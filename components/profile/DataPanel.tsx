"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { inputClass } from "./Row";
import { recountScore, eraseAllContent } from "@/app/app/profile/actions";

/**
 * Getting your data out is one click and complete. Putting a file back
 * in is deliberately not offered — the reasoning is on the panel itself,
 * because a refusal without a reason just reads as a missing feature.
 */
export default function DataPanel({
  counts,
  memberSince,
}: {
  counts: { tasks: number; notes: number; events: number; links: number };
  memberSince: string;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [erasing, setErasing] = useState(false);
  const [pending, startTransition] = useTransition();

  const stats = [
    { label: "Tasks", value: counts.tasks },
    { label: "Notes", value: counts.notes },
    { label: "Events", value: counts.events },
    { label: "Saved links", value: counts.links },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="label-xs mb-2">since {memberSince}</p>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-ln bg-ln sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-surf px-3 py-2.5">
              <p className="label-xs">{s.label}</p>
              <p className="tabular mt-0.5 font-display text-[17px] font-semibold">
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[12px] font-semibold text-ink">
          Download a copy of everything
        </p>
        <p className="mb-2 mt-1 max-w-[52ch] text-[11.5px] leading-relaxed text-mut">
          One file with all your tasks, notes, events and links — and your
          points history.
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Plain links, not fetches: the browser handles the download,
              and the route sets Content-Disposition. */}
          <a
            href="/api/export"
            download
            className="inline-flex cursor-pointer items-center rounded-[9px] border border-ink bg-ink px-[13px] py-[7px] text-[12.5px] font-semibold text-paper transition-colors hover:border-ink2 hover:bg-ink2"
          >
            Download
          </a>
          <a
            href="/api/export?format=csv"
            download
            className="inline-flex cursor-pointer items-center rounded-[9px] border border-ln2 bg-surf px-[13px] py-[7px] text-[12.5px] font-semibold text-ink2 transition-colors hover:border-acc hover:text-acc"
          >
            As spreadsheet
          </a>
        </div>
      </div>

      <div className="border-t border-ln pt-4">
        <p className="text-[12px] font-semibold text-ink">Lost something?</p>
        <p className="mb-2 mt-1 max-w-[52ch] text-[11.5px] leading-relaxed text-mut">
          Deleted something by accident, or your data looks wrong? Krama keeps
          its own backups — nothing is restored from a file you upload, for the
          reasons below. Get in touch and it can be brought back.
        </p>
        <a
          href="mailto:support@krama.app?subject=Krama%20%E2%80%94%20help%20recovering%20data"
          className="inline-flex cursor-pointer items-center rounded-[9px] border border-ln2 bg-surf px-[13px] py-[7px] text-[12.5px] font-semibold text-ink2 transition-colors hover:border-acc hover:text-acc"
        >
          Ask for help
        </a>
      </div>

      <div className="border-t border-ln pt-4">
        <p className="text-[12px] font-semibold text-ink">Fix my score</p>
        <p className="mb-2 mt-1 max-w-[52ch] text-[11.5px] leading-relaxed text-mut">
          If your level or streak looks wrong, this recounts it from your
          actual history. It can only move the number toward the record.
        </p>
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
        {notice && (
          <p className="mt-2 text-[11.5px] font-semibold text-ok">{notice}</p>
        )}
      </div>

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
            Your account stays and you can start fresh. Download a copy first
            if you might want it.
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

      <details className="rounded-lg border border-ln bg-surf2 px-3 py-2.5">
        <summary className="cursor-pointer text-[11.5px] font-semibold text-ink">
          Why you can download but not upload
        </summary>
        <p className="mt-2 max-w-[62ch] text-[11.5px] leading-relaxed text-mut">
          Taking your data out is yours by right and carries no risk. Putting a
          file back in is a different thing entirely — a downloaded file can be
          edited before it&rsquo;s returned, and the export contains your points
          history. Anyone could set themselves to level 90 in a text editor and
          upload it, which would make every score in the app meaningless. There
          are quieter risks too: a crafted file can carry text that becomes
          harmful when the app later displays it, or enough rows to exhaust
          storage. So restoring is done from the server&rsquo;s own backups on
          request, never from a file you supply.
        </p>
      </details>
    </div>
  );
}
