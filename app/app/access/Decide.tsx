"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/validation";

type Action = (formData: FormData) => Promise<ActionResult>;

/**
 * Yes, no, or stop.
 *
 * No confirmation dialog on any of them. Saying no is free and
 * reversible by asking again; stopping access is the safe direction and
 * should never be behind an extra click. Approving is the only one that
 * gives anything away, and the screen it sits on has already said in
 * plain words what it means.
 */
export default function Decide({
  id,
  approve,
  decline,
  revoke,
}: {
  id: string;
  approve?: Action;
  decline?: Action;
  revoke?: Action;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (action: Action) => (fd: FormData) =>
    start(async () => {
      setError(null);
      const result = await action(fd);
      if (!result.ok) setError(result.error);
    });

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {approve && (
          <form action={run(approve)}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-ink px-3 py-1.5 text-[12px] font-semibold text-paper disabled:opacity-60"
            >
              Let them look
            </button>
          </form>
        )}
        {decline && (
          <form action={run(decline)}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-ln2 bg-surf px-3 py-1.5 text-[12px] font-semibold text-mut disabled:opacity-60"
            >
              No
            </button>
          </form>
        )}
        {revoke && (
          <form action={run(revoke)}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-bad px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
            >
              Stop it now
            </button>
          </form>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] text-bad">{error}</p>}
    </>
  );
}
