import type { Metadata } from "next";
import { pageTitle } from "@/lib/env";
import StatusPage, {
  PrimaryLink,
  QuietLink,
} from "@/components/status/StatusPage";

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
    <StatusPage
      code="404"
      title="There's nothing at this address"
      body={
        <>
          <p>
            Either the address is wrong, or whatever used to be here has since
            been deleted.
          </p>
          <p className="mt-2">
            Nothing is broken and nothing has been lost — this page simply
            doesn&rsquo;t exist.
          </p>
        </>
      }
      actions={
        <>
          <PrimaryLink href="/app">Go to Today</PrimaryLink>
          <QuietLink href="/app/search">Search everything</QuietLink>
        </>
      }
    />
  );
}
