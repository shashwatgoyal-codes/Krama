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
  layout = "fields",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  label?: string;
  /**
   * "rows" for SettingRow children, which carry their own padding and
   * hairline — stacking a gap on top of that leaves uneven gutters and
   * a border floating in the middle of the space. "fields" keeps the
   * old spacing for the tabs still using stacked label-over-input.
   */
  layout?: "rows" | "fields";
}) {
  const rows = layout === "rows";
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
      <fieldset
        disabled={pending}
        className={rows ? "flex flex-col" : "flex flex-col gap-4"}
      >
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

      {/* In a row layout the controls all sit against the right edge, so
          the button belongs there too — left-aligned under a right-hand
          column reads as belonging to nothing. */}
      {/* A hairline above closes the form. Without it the button floats
          in whitespace between two rows and reads as belonging to
          whichever one it happens to sit nearer. */}
      <div
        className={
          rows
            ? "flex items-center justify-end gap-2.5 border-t border-ln pt-3"
            : "mt-4 flex items-center gap-2.5"
        }
      >
        {/* aria-live so the confirmation is announced, not just shown. */}
        <span aria-live="polite" className="text-[11.5px] font-semibold text-ok">
          {saved && "Saved"}
        </span>
        <Button type="submit" variant="primary" size="sm" disabled={pending}>
          {pending ? "Saving…" : label}
        </Button>
      </div>
    </form>
  );
}
