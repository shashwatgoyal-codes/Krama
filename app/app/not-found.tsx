import StatusPage, {
  PrimaryLink,
  QuietLink,
} from "@/components/status/StatusPage";

/**
 * A 404 raised from inside the app — a note, task or link that has been
 * deleted, or an id that was never theirs.
 *
 * Separate from the root 404 so it keeps the navigation. Somebody who
 * opened a stale bookmark has made a small mistake, and taking the whole
 * app away from them for it is a larger one.
 */
export default function AppNotFound() {
  return (
    <StatusPage
      inShell
      code="404"
      title="That isn't here any more"
      body={
        <p>
          Whatever this address pointed at has been deleted, or it was never
          yours to open. Nothing else is affected.
        </p>
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
