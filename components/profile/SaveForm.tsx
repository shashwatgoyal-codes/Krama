"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import type { ActionResult } from "@/lib/validation";

/**
 * Wraps a settings panel's form. Every panel saves the same way, so the
 * pending state, the error and the confirmation live here once.
 *
 * The confirmation matters more than it looks: without it a save that
 * changes nothing visible on screen — a daily cap, a rest day — is
 * indistinguishable from a save that silently failed.
 */
export default function SaveForm({
  action,
  children,
  label = "Save",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  label?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setSaved(true);
        // Long enough to notice, short enough not to become furniture.
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form action={submit} onChange={() => setSaved(false)}>
      <fieldset disabled={pending} className="flex flex-col gap-4">
        {children}
      </fieldset>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2.5">
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : label}
        </Button>
        {/* aria-live so the confirmation is announced, not just shown. */}
        <span aria-live="polite" className="text-[11.5px] font-semibold text-ok">
          {saved && "Saved"}
        </span>
      </div>
    </form>
  );
}
