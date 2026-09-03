import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { adminDbConfigured } from "@/lib/admin/db";
import { listFeedback } from "@/lib/admin/queries";
import FeedbackRow from "./FeedbackRow";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "new", label: "Waiting" },
  { key: "read", label: "Seen" },
  { key: "done", label: "Answered" },
  { key: "all", label: "All" },
];

/**
 * What people have told us.
 *
 * Read through the restricted role like every other screen here — with
 * one difference worth naming: this is the only place that role can see
 * something a person wrote. It is granted because feedback was addressed
 * to an administrator; notes and tasks were not, and remain unreadable
 * from these screens by the database rather than by this page choosing
 * not to ask.
 */
export default async function AdminFeedback({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  await requireAdmin();
  if (!adminDbConfigured()) return null;

  const { s } = await searchParams;
  const filter = FILTERS.some((f) => f.key === s) ? (s as string) : "new";
  const rows = await listFeedback(filter);

  return (
    <>
      <h1 className="font-display text-[17px] font-semibold">Feedback</h1>
      <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-mut">
        Messages people sent from their settings. This is the only content these
        screens can read, and only because it was written to you. A reply
        appears in the sender&rsquo;s settings — no email is sent.
      </p>

      <nav className="mt-4 flex gap-[3px]">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/feedback?s=${f.key}`}
            className={
              "rounded-md px-2.5 py-[5px] text-[12.5px] font-medium transition-colors " +
              (filter === f.key
                ? "bg-ink text-paper"
                : "text-mut hover:bg-surf2 hover:text-ink")
            }
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <div className="mt-3 overflow-hidden rounded-lg border border-ln bg-surf">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-[12.5px] text-mut">
            {filter === "new" ? "Nothing waiting." : "Nothing here."}
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <FeedbackRow key={row.id} row={row} />
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
