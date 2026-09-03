import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { adminDbConfigured } from "@/lib/admin/db";
import { listUsers } from "@/lib/admin/queries";
import { LEVEL_LABEL, LEVEL_STYLE } from "@/lib/admin/levels";

export const dynamic = "force-dynamic";

function ago(d: Date | null): string {
  if (!d) return "never";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireAdmin();
  if (!adminDbConfigured()) return null;

  const { q } = await searchParams;
  const users = await listUsers(q);

  return (
    <>
      <h1 className="font-display text-[17px] font-semibold">Users</h1>
      <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-mut">
        Role answers who has power here: <strong>Standard</strong> is an
        ordinary account, <strong>Admin</strong> can act on others,{" "}
        <strong>Super admin</strong> can grant that. &ldquo;312 items&rdquo; is
        operational — it tells you whether an account is in use. What those
        items say is not available here.
      </p>

      <form className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by email or name"
          className="field w-full max-w-[320px]"
        />
        <button
          type="submit"
          className="rounded-lg bg-ink px-3 py-[7px] text-[12.5px] font-semibold text-paper"
        >
          Search
        </button>
      </form>

      <div className="mt-4 overflow-x-auto rounded-xl border border-ln bg-surf">
        <table className="w-full min-w-[640px] border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b border-ln text-left">
              {[
                "Account",
                "Role",
                "Status",
                "Joined",
                "Last seen",
                "Items",
              ].map((h) => (
                <th
                  key={h}
                  className="label-xs px-3.5 py-2.5 font-semibold text-mut"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-ln last:border-0">
                <td className="px-3.5 py-2.5">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="font-semibold text-acc"
                  >
                    {u.name}
                  </Link>
                  <span className="block text-[11px] text-mut">{u.email}</span>
                </td>
                <td className="px-3.5 py-2.5">
                  {u.level === "standard" ? (
                    <span className="text-[11px] text-mut">Standard</span>
                  ) : (
                    <span
                      className={`rounded border px-[5px] py-0.5 text-[10.5px] font-semibold ${LEVEL_STYLE[u.level]}`}
                    >
                      {LEVEL_LABEL[u.level]}
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2.5">
                  {u.verified ? (
                    <span className="rounded border border-ok bg-ok-soft px-[5px] py-0.5 text-[10.5px] font-semibold text-ok">
                      Verified
                    </span>
                  ) : (
                    <span className="rounded border border-warn bg-warn-soft px-[5px] py-0.5 text-[10.5px] font-semibold text-warn">
                      Unverified
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2.5 text-mut">
                  {u.joined.toISOString().slice(0, 10)}
                </td>
                <td className="px-3.5 py-2.5 text-mut">{ago(u.lastSeen)}</td>
                <td className="px-3.5 py-2.5 tabular-nums">{u.items}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3.5 py-6 text-center text-mut">
                  {q ? `Nothing matches “${q}”.` : "No accounts yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {users.length === 200 && (
        <p className="mt-2 text-[11px] text-fai">
          Showing the 200 most recent. Search to narrow it — this cap is here so
          a growing table cannot quietly become a slow page.
        </p>
      )}
    </>
  );
}
