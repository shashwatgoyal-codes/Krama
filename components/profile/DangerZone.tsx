"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { inputClass } from "./Row";
import PasswordInput from "@/components/ui/PasswordInput";
import { deleteAccountAction } from "@/app/app/profile/actions";

export default function DangerZone({
  counts,
}: {
  counts: { tasksDone: number; notesKept: number; totalPoints: number };
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(formData: FormData) {
    setError(null);
    startTransition(async () => {
      // On success this redirects and never returns.
      const result = await deleteAccountAction(formData);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* delete account */}
      <div>
        <p className="text-[12px] font-semibold text-ink">Delete my account</p>
        <p className="mt-1 max-w-[54ch] text-[11.5px] leading-relaxed text-mut">
          This removes everything and cannot be undone — {counts.tasksDone}{" "}
          finished {counts.tasksDone === 1 ? "task" : "tasks"},{" "}
          {counts.notesKept} {counts.notesKept === 1 ? "note" : "notes"} and{" "}
          {counts.totalPoints} points of history. There is no backup and no
          grace period.
        </p>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 cursor-pointer rounded-[9px] border border-bad px-[13px] py-[7px] text-[12px] font-semibold text-bad transition-colors hover:bg-bad-soft"
          >
            Delete my account
          </button>
        ) : (
          <form action={remove} className="mt-3 flex flex-col gap-3">
            <fieldset disabled={pending} className="flex flex-col gap-3">
              <div className="max-w-[300px]">
                <label
                  htmlFor="delete-password"
                  className="block text-[11.5px] font-semibold text-ink"
                >
                  Your password
                </label>
                <PasswordInput
                  id="delete-password"
                  name="password"
                  required
                  autoComplete="current-password"
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>

              <div className="max-w-[300px]">
                <label
                  htmlFor="delete-confirm"
                  className="block text-[11.5px] font-semibold text-ink"
                >
                  Type <span className="font-mono text-bad">DELETE</span> to
                  confirm
                </label>
                <input
                  id="delete-confirm"
                  name="confirm"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  className={`mt-1.5 ${inputClass}`}
                />
              </div>
            </fieldset>

            {error && (
              <p
                role="alert"
                className="max-w-[300px] rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
              >
                {error}
              </p>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="submit"
                disabled={pending}
                className="cursor-pointer rounded-[9px] border border-bad bg-bad px-[13px] py-[7px] text-[12px] font-semibold text-paper transition-opacity hover:opacity-90 disabled:opacity-45"
              >
                {pending ? "Deleting…" : "Permanently delete"}
              </button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  setError(null);
                }}
              >
                Keep my account
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
