import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { adminDbConfigured } from "@/lib/admin/db";
import { auditTrail, auditActions } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

/** Refusals are styled apart, because they are the interesting ones. */
function tone(action: string): string {
  if (action.includes("refused")) return "border-warn bg-warn-soft text-warn";
  if (action.includes("revoked") || action.includes("withdrawn"))
    return "border-bad bg-bad-soft text-bad";
  return "border-ln2 bg-surf2 text-mut";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; action?: string }>;
}) {
  await requireAdmin();
  if (!adminDbConfigured()) return null;

  const { actor, action } = await searchParams;
  const [rows, actions] = await Promise.all([
    auditTrail({ actor, action }),
    auditActions(),
  ]);

  return (
    <>
      <h1 className="font-display text-[17px] font-semibold">Audit log</h1>
      <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-mut">
        Every administrative action, including the ones that were refused — a
        log showing only what worked cannot answer the question people actually
        ask of it. Nothing here can be edited or deleted: the table rejects both
        at the database, and the connection this page reads through has no write
        permission at all.
      </p>

      <form className="mt-4 flex flex-wrap gap-2">
        <input
          name="actor"
          defaultValue={actor ?? ""}
          placeholder="Filter by who"
          className="w-full max-w-[220px] rounded-lg border border-ln2 bg-surf px-[11px] py-[7px] text-[12.5px] placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft"
        />
        <select
          name="action"
          defaultValue={action ?? ""}
          className="rounded-lg border border-ln2 bg-surf px-[9px] py-[7px] text-[12.5px]"
        >
          <option value="">Every action</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-lg bg-ink px-3 py-[7px] text-[12.5px] font-semibold text-paper"
        >
          Filter
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-ln bg-surf">
        <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-ln text-left">
              {["When", "Who", "Action", "On", "Why"].map((h) => (
                <th key={h} className="label-xs px-3.5 py-2.5 font-semibold text-mut">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-ln align-top last:border-0">
                <td className="whitespace-nowrap px-3.5 py-2.5 font-mono text-[10.5px] text-mut">
                  {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                </td>
                <td className="px-3.5 py-2.5">
                  <span className="block">{r.actorEmail}</span>
                  <span className="text-[10.5px] text-fai">{r.actorLevel}</span>
                </td>
                <td className="px-3.5 py-2.5">
                  <span
                    className={`rounded border px-[5px] py-0.5 font-mono text-[10.5px] font-semibold ${tone(r.action)}`}
                  >
                    {r.action}
                  </span>
                </td>
                <td className="px-3.5 py-2.5 text-mut">
                  {r.targetUserId ? (
                    <Link href={`/admin/users/${r.targetUserId}`} className="font-semibold text-acc">
                      {r.target}
                    </Link>
                  ) : (
                    // A flag key, or an account that has since been
                    // deleted. Shown either way — the record outlives
                    // what it points at, which is the point of it.
                    (r.target ?? "—")
                  )}
                </td>
                <td className="max-w-[320px] px-3.5 py-2.5 text-mut">{r.reason}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3.5 py-6 text-center text-mut">
                  Nothing recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length === 200 && (
        <p className="mt-2 text-[11px] text-fai">
          Showing the most recent 200. Filter to narrow it — this cap is stated
          rather than silent, because a log that quietly truncates reads as a
          log that ends.
        </p>
      )}
    </>
  );
}
