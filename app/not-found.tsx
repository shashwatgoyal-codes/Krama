import Link from "next/link";
import type { Metadata } from "next";
import { pageTitle } from "@/lib/env";

export const metadata: Metadata = {
  title: pageTitle("Not found"),
  robots: { index: false, follow: false },
};

/**
 * The 404. Reached by mistyped URLs and by stale links to things that
 * have since been deleted, which is the more common case here — a
 * bookmarked note or task that is no longer there.
 *
 * It offers a way back rather than only stating the problem. A dead end
 * that gives you nothing to click is a dead end twice.
 */
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-[380px] text-center">
        <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
          There&rsquo;s nothing here
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
          This page doesn&rsquo;t exist, or whatever used to be at this address has
          since been deleted.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2.5 text-[12.5px]">
          <Link
            href="/app"
            className="rounded-md bg-ink px-3 py-1.5 font-semibold text-paper transition-opacity hover:opacity-90"
          >
            Go to Today
          </Link>
          <Link
            href="/app/search"
            className="rounded-md border border-ln2 px-3 py-1.5 font-medium text-mut transition-colors hover:bg-surf2 hover:text-ink"
          >
            Search
          </Link>
        </div>
      </div>
    </main>
  );
}
