"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import type { ActionResult } from "@/lib/validation";

type Action = (formData: FormData) => Promise<ActionResult>;

async function run(
  action: Action,
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return action(formData);
}

/**
 * Wraps a sign-in/sign-up form so errors render in one place and the
 * submit button disables itself while the request is in flight.
 */
export default function AuthForm({
  action,
  submitLabel,
  children,
}: {
  action: Action;
  submitLabel: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    run.bind(null, action),
    null,
  );

  return (
    <form action={formAction} noValidate>
      {state && !state.ok && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-bad bg-bad-soft px-3 py-2.5 text-[12.5px] leading-snug text-ink"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--bad)" strokeWidth="2.2" strokeLinecap="round" className="mt-px flex-none">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <span>{state.error}</span>
        </div>
      )}

      {children}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 w-full cursor-pointer rounded-lg border border-ink bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:bg-ink2 hover:border-ink2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "One moment…" : submitLabel}
      </button>
    </form>
  );
}
