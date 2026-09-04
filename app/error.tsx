"use client";

import { useEffect } from "react";
import Link from "next/link";
import StatusPage from "@/components/status/StatusPage";

/**
 * The catch-all for a render that threw.
 *
 * Two rules it follows. It never shows `error.message`: in production
 * React replaces it with a generic string anyway, and in development
 * showing it here would only duplicate the overlay — but a server error
 * message can carry a connection string or a row's contents, and this
 * page is the wrong place to find that out. And it offers `reset()`,
 * because a good share of what lands here is one failed query rather
 * than a broken page, and retrying costs nothing.
 *
 * The digest is shown deliberately: it is the only handle correlating
 * what someone saw with what the server logged.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The server logs its own; this covers the ones thrown in the browser.
    console.error(error);
  }, [error]);

  return (
    <StatusPage
      tone="warn"
      title="This screen didn't load"
      body={
        <>
          <p>
            Something failed while putting this page together. Nothing you had
            saved is affected.
          </p>
          <p className="mt-2">
            Quite often it is one slow query rather than a broken page, so
            trying again is worth doing before anything else.
          </p>
        </>
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
