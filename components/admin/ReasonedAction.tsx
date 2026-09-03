"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/validation";
import { useToast } from "@/components/ui/Toast";

/**
 * A destructive action that cannot be taken without saying why.
 *
 * The reason is not decoration — it is the difference between an audit
 * log that records that something happened and one that records why. So
 * it is a required field in front of the action rather than an optional
 * note after it, and the button stays disabled until it is filled in.
 *
 * Expanding in place rather than opening a dialog keeps what you are
 * acting on visible while you type the justification for acting on it.
 */
export default function ReasonedAction({
  action,
  hidden,
  label,
  title,
  confirm,
  tone = "danger",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  hidden: Record<string, string>;
  label: string;
  title: string;
  confirm: string;
  /** "safe" for reversible actions — restoring access, ending sessions. */
  tone?: "danger" | "safe";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          "rounded-md border border-ln2 px-2 py-1 text-[11.5px] font-semibold text-mut transition-colors " +
          (tone === "danger" ? "hover:border-bad hover:text-bad" : "hover:border-ink hover:text-ink")
        }
      >
        {label}
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const result = await action(fd);
          if (!result.ok) {
            setError(result.error);
            return;
          }
          setOpen(false);
          setReason("");
          toast.success(`${confirm} — done, and recorded in the audit log.`);
        })
      }
      className="flex flex-col items-end gap-1.5"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label className="sr-only" htmlFor={`reason-${label}`}>
        {title}
      </label>
      <input
        id={`reason-${label}`}
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why? Recorded in the audit log"
        autoFocus
        className="w-[240px] rounded-md border border-ln2 bg-surf px-2 py-1 text-[11.5px] placeholder:text-fai focus:border-acc focus:outline-none"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-md px-2 py-1 text-[11.5px] font-medium text-mut"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || reason.trim().length < 3}
          className={
            "rounded-md px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-45 " +
            (tone === "danger" ? "bg-bad" : "bg-ink")
          }
        >
          {pending ? "…" : confirm}
        </button>
      </div>
      {error && <p className="max-w-[240px] text-right text-[11px] text-bad">{error}</p>}
    </form>
  );
}
