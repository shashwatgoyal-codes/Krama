"use client";

import { useState, useTransition, useRef } from "react";
import { saveLink } from "@/app/app/explore/actions";
import { useToast } from "@/components/ui/Toast";

/**
 * Paste a link, it's saved. The fetch happens on the server and can take
 * a couple of seconds, so the button says so rather than sitting there
 * looking broken.
 */
export default function SaveLinkBar() {
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  function submit(data: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await saveLink(data);
      if (result.ok) {
        form.current?.reset();
        toast.success("Saved to Explore.");
      } else setError(result.error);
    });
  }

  return (
    <div className="min-w-0 flex-1">
      <form ref={form} action={submit} className="flex min-w-0 gap-2">
        <input
          name="url"
          required
          maxLength={2000}
          disabled={pending}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste a link to save it…"
          aria-label="Link to save"
          className="min-w-0 flex-1 rounded-[9px] border border-ln2 bg-surf px-[11px] py-1.5 text-[13px] text-ink placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          className="flex-none cursor-pointer rounded-[9px] border border-ink bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper transition-colors hover:border-ink2 hover:bg-ink2 disabled:opacity-50"
        >
          {pending ? "Reading…" : "Save"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-1.5 text-[11.5px] text-bad">
          {error}
        </p>
      )}
    </div>
  );
}
