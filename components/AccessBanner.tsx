import Link from "next/link";

/**
 * Shown on every screen while somebody has live access.
 *
 * Consent that you granted once and then forget about is not really
 * consent — the thing that keeps it honest is knowing, at the moment it
 * is true, that somebody can see. So this is not tucked into settings.
 * It sits above the app, on every page, for as long as it lasts, with
 * the way to stop it one click away.
 */
export default function AccessBanner({
  count,
  waiting,
}: {
  /** Live approvals right now. */
  count: number;
  /** Requests sitting unanswered. */
  waiting: number;
}) {
  if (count === 0 && waiting === 0) return null;

  const live = count > 0;
  return (
    <Link
      href="/app/access"
      className={
        "block border-b px-4 py-1.5 text-[12px] transition-opacity hover:opacity-90 " +
        (live
          ? "border-warn bg-warn-soft text-warn"
          : "border-acc bg-acc-soft text-acc")
      }
    >
      {live ? (
        <>
          <strong>
            Someone can see your things right now
            {count > 1 ? ` (${count} people)` : ""}.
          </strong>{" "}
          You approved it. Tap to see what they have opened, or stop it.
        </>
      ) : (
        <>
          <strong>
            {waiting === 1
              ? "Someone is asking to look at your things."
              : `${waiting} people are asking to look at your things.`}
          </strong>{" "}
          Tap to decide.
        </>
      )}
    </Link>
  );
}
