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
  // Nothing to save until something is changed. A button that is always
  // there is furniture — it stops being read, and it never confirms that
  // the edit you just made actually registered anywhere.
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        setDirty(false);
        setSaved(true);
        // Long enough to notice, short enough not to become furniture.
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form
      action={submit}
      // onInput as well as onChange: a select fires change, but a text
      // field only fires it on blur, so typing alone would leave the
      // form looking untouched.
      onChange={() => {
        setDirty(true);
        setSaved(false);
      }}
      onInput={() => {
        setDirty(true);
        setSaved(false);
      }}
    >
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
      {/* aria-live wraps the whole strip so the confirmation is
          announced even though the region appears and disappears. */}
      <div aria-live="polite">
        {(dirty || pending || saved) && (
          <div
            className={
              rows
                ? "flex items-center justify-end gap-2.5 border-t border-ln pt-3"
                : "mt-4 flex items-center gap-2.5"
            }
          >
            {saved && !dirty ? (
              <span className="text-[11.5px] font-semibold text-ok">Saved</span>
            ) : (
              <>
                <span className="text-[11px] text-fai">Unsaved changes</span>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={pending}
                >
                  {pending ? "Saving…" : label}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
