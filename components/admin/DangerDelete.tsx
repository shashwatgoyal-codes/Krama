"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/validation";

/**
 * Deleting an account.
 *
 * The confirmation is the account's email typed out, not a checkbox and
 * not "are you sure". The difference matters: "are you sure" is a
 * question people answer without reading, while typing an address is one
 * you cannot answer without looking at which account you are on. It is
 * the same reason repositories ask for their own name.
 */
export default function DangerDelete({
  action,
  userId,
  email,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  userId: string;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const matches = confirmation.trim().toLowerCase() === email.toLowerCase();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-bad px-2 py-1 text-[11.5px] font-semibold text-bad transition-colors hover:bg-bad-soft"
      >
        Delete account
      </button>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const result = await action(fd);
          if (result && !result.ok) setError(result.error);
        })
      }
      className="rounded-lg border border-bad bg-bad-soft p-3"
    >
      <input type="hidden" name="userId" value={userId} />
      <p className="text-[12px] font-semibold text-bad">
        This deletes everything and cannot be undone
      </p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-mut">
        Every task, note, event, saved link and point they have. The audit log
        keeps a record that you did it, because that table cannot be written
        over.
      </p>

      <label className="label-xs mt-3 block text-mut" htmlFor="confirmation">
        Type <span className="font-mono text-ink">{email}</span> to confirm
      </label>
      <input
        id="confirmation"
        name="confirmation"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        autoComplete="off"
        className="mt-1 w-full rounded-md border border-ln2 bg-surf px-2 py-1 text-[11.5px] focus:border-bad focus:outline-none"
      />

      <label className="label-xs mt-2 block text-mut" htmlFor="delete-reason">
        Why
      </label>
      <input
        id="delete-reason"
        name="reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Recorded in the audit log"
        className="mt-1 w-full rounded-md border border-ln2 bg-surf px-2 py-1 text-[11.5px] placeholder:text-fai focus:border-bad focus:outline-none"
      />

      {error && <p className="mt-2 text-[11.5px] text-bad">{error}</p>}

      <div className="mt-3 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setConfirmation("");
            setError(null);
          }}
          className="rounded-md px-2 py-1 text-[11.5px] font-medium text-mut"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !matches || reason.trim().length < 3}
          className="rounded-md bg-bad px-2.5 py-1 text-[11.5px] font-semibold text-white disabled:opacity-45"
        >
          {pending ? "Deleting…" : "Delete permanently"}
        </button>
      </div>
    </form>
  );
}
