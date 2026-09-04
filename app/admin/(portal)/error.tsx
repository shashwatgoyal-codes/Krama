"use client";

import { useEffect } from "react";
import Link from "next/link";
import StatusPage from "@/components/status/StatusPage";

/**
 * A failed render inside the admin portal.
 *
 * Worth its own boundary because the most likely cause here is specific
 * and actionable: the restricted role has no grant for a column somebody
 * added to a query. That is a configuration problem, not a broken app,
 * and it says so rather than making an administrator guess.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      inShell
      tone="warn"
      title="This admin screen didn't load"
      body={
        <p>
          If this is new, the usual cause is the restricted database role
          missing a grant for something a query asked for — see{" "}
          <code className="rounded bg-surf2 px-1 py-0.5 font-mono text-[11px]">
            docs/ADMIN.md
          </code>
          . That refusal is the seal working, not a fault.
        </p>
      }
      reference={error.digest}
      actions={
        <>
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer rounded-lg bg-ink px-3.5 py-2 font-semibold text-paper transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="rounded-lg border border-ln2 px-3.5 py-2 font-medium text-mut transition-colors hover:border-ink2 hover:text-ink"
          >
            Back to overview
          </Link>
        </>
      }
    />
  );
}
