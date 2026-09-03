"use client";

import { useState, useTransition } from "react";
import { updateFlag } from "./actions";
import type { ActionResult } from "@/lib/validation";
import { useToast } from "@/components/ui/Toast";

type Props = {
  flag: {
    key: string;
    description: string;
    enabled: boolean;
    rollout: number;
    updatedAt: Date;
    updatedBy: string | null;
  };
  canEdit: boolean;
};

/**
 * One switch.
 *
 * Save is only offered once something has actually changed, and the
 * reason field only appears then — asking why before there is anything
 * to explain is a form that trains you to type "update" into it.
 */
export default function FlagRow({ flag, canEdit }: Props) {
  const [enabled, setEnabled] = useState(flag.enabled);
  const [rollout, setRollout] = useState(flag.rollout);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const dirty = enabled !== flag.enabled || rollout !== flag.rollout;

  return (
    <div className="border-b border-ln p-4 last:border-0">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12.5px] font-semibold">{flag.key}</p>
          <p className="mt-0.5 max-w-[62ch] text-[11.5px] leading-relaxed text-mut">
            {flag.description}
          </p>
          <p className="mt-1 text-[10.5px] text-fai">
            {flag.updatedBy
              ? `Last changed by ${flag.updatedBy} on ${flag.updatedAt.toISOString().slice(0, 10)}`
              : "Never changed"}
          </p>
        </div>

        <div className="flex flex-none items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px]">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!canEdit}
              onChange={(e) => {
                setEnabled(e.target.checked);
                setSaved(false);
              }}
              className="accent-acc"
            />
            {enabled ? "On" : "Off"}
          </label>

          <label className="flex items-center gap-1.5 text-[12px] text-mut">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={rollout}
              disabled={!canEdit || !enabled}
              onChange={(e) => {
                setRollout(Number(e.target.value));
                setSaved(false);
              }}
              className="w-[110px] accent-acc disabled:opacity-40"
            />
            <span className="w-[34px] text-right tabular-nums">{rollout}%</span>
          </label>
        </div>
      </div>

      {canEdit && dirty && (
        <form
          action={(fd) =>
            start(async () => {
              setError(null);
              const result: ActionResult = await updateFlag(fd);
              if (!result.ok) setError(result.error);
              else {
                setSaved(true);
                setReason("");
                toast.success(
                  `${flag.key} — ${enabled ? `on at ${rollout}%` : "off"}.`,
                );
              }
            })
          }
          className="mt-3 flex flex-wrap items-center gap-2"
        >
          <input type="hidden" name="key" value={flag.key} />
          <input type="hidden" name="enabled" value={enabled ? "on" : "off"} />
          <input type="hidden" name="rollout" value={rollout} />
          <input
            name="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why — this goes in the audit log"
            className="min-w-[240px] flex-1 rounded-md border border-ln2 bg-surf px-2 py-1 text-[11.5px] placeholder:text-fai focus:border-acc focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || reason.trim().length < 3}
            className="rounded-md bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-paper disabled:opacity-45"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      )}

      {saved && <p className="mt-2 text-[11.5px] text-ok">Saved.</p>}
      {error && <p className="mt-2 text-[11.5px] text-bad">{error}</p>}
    </div>
  );
}
