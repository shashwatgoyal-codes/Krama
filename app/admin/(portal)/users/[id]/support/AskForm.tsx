"use client";

import { useState, useTransition } from "react";
import { askForAccess } from "./actions";
import { SCOPES, SCOPE_LABEL } from "@/lib/admin/scopes";

/**
 * Asking to look.
 *
 * The reason has a ten-character minimum because the account holder
 * reads it verbatim — "debugging" tells them nothing and is not a basis
 * for consenting to anything.
 *
 * Nothing is ticked to begin with. A form that defaults to asking for
 * everything is a form that gets sent asking for everything.
 */
export default function AskForm({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent) {
    return (
      <p className="rounded-lg border border-ok bg-ok-soft p-3 text-[12px] text-ok">
        Asked. {email} decides — you will have access only if they say yes, and
        only for as long as they allow.
      </p>
    );
  }

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const result = await askForAccess(fd);
          if (!result.ok) setError(result.error);
          else setSent(true);
        })
      }
    >
      <input type="hidden" name="userId" value={userId} />

      <fieldset>
        <legend className="label-xs text-mut">What do you need to see?</legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-1.5 text-[12.5px]">
              <input
                type="checkbox"
                name="scopes"
                value={s}
                className="accent-acc"
              />
              {SCOPE_LABEL[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="label-xs mt-4 block text-mut" htmlFor="support-reason">
        Why — {email} reads this word for word
      </label>
      <textarea
        id="support-reason"
        name="reason"
        rows={3}
        minLength={10}
        required
        placeholder="Your repeating task is not appearing on the calendar and I need to see how it is set up."
        className="field mt-1 w-full"
      />

      {error && <p className="mt-2 text-[12px] text-bad">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="mt-3 rounded-lg bg-ink px-3 py-[7px] text-[12.5px] font-semibold text-paper disabled:opacity-60"
      >
        {pending ? "Asking…" : "Ask for access"}
      </button>
    </form>
  );
}
