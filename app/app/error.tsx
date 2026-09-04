"use client";

import { useEffect } from "react";
import Link from "next/link";
import StatusPage from "@/components/status/StatusPage";

/**
 * A failed render inside the app, caught without losing the shell.
 *
 * The root boundary would replace the whole page, nav included, for what
 * is usually one screen's query timing out. Here the rest of the app
 * stays reachable, so the way out is a click rather than a retyped URL.
 */
export default function AppError({
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
      title="This screen didn't load"
      body={
        <p>
          Something failed while putting this page together. Nothing you had
          saved is affected, and the rest of Krama still works.
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
            href="/app"
            className="rounded-lg border border-ln2 px-3.5 py-2 font-medium text-mut transition-colors hover:border-ink2 hover:text-ink"
          >
            Go to Today
          </Link>
        </>
      }
    />
  );
}
