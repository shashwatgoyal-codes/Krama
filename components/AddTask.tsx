"use client";

import { useRef, useState, useTransition } from "react";
import { createTask } from "@/app/app/actions";

export default function AddTask({ autoFocus = false }: { autoFocus?: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createTask(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Cleared by hand rather than with a key reset, so focus stays put
      // and you can add three things without touching the mouse.
      if (inputRef.current) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
    });
  }

  return (
    <form action={submit}>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          name="title"
          required
          maxLength={200}
          autoFocus={autoFocus}
          disabled={pending}
          placeholder="What needs doing?"
          aria-label="New task"
          className="min-w-0 flex-1 rounded-[9px] border border-ln2 bg-surf px-[11px] py-2 text-[13px] text-ink placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer rounded-[9px] border border-ink bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-paper transition-colors hover:bg-ink2 hover:border-ink2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[11.5px] text-bad">
          {error}
        </p>
      )}
    </form>
  );
}
