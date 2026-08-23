"use client";

import { useEffect } from "react";
import Link from "next/link";

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
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-[400px] text-center">
        <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
          Something went wrong
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
          This screen failed to load. Nothing you had saved is affected —
          try again, and if it keeps happening the reference below identifies
          what broke.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2.5 text-[12.5px]">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-ink px-3 py-1.5 font-semibold text-paper transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/app"
            className="rounded-md border border-ln2 px-3 py-1.5 font-medium text-mut transition-colors hover:bg-surf2 hover:text-ink"
          >
            Go to Today
          </Link>
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-[10.5px] text-fai">
            Reference {error.digest}
          </p>
        )}
      </div>
    </main>
  );
}
