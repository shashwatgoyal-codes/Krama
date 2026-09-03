import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { adminDbConfigured } from "@/lib/admin/db";
import { overview, feedbackWaiting } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

function Metric({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl border border-ln bg-surf p-3.5">
      <p className="label-xs text-mut">{label}</p>
      <p className="mt-1 font-display text-[24px] font-semibold leading-none tracking-[-0.03em]">
        {value}
      </p>
      {note && <p className="mt-1.5 text-[11px] text-fai">{note}</p>}
    </div>
  );
}

export default async function AdminOverview() {
  await requireAdmin();
  if (!adminDbConfigured()) return null;

  const [o, waiting] = await Promise.all([overview(), feedbackWaiting()]);
  const peak = Math.max(1, ...o.signupsFourteenDays.map((d) => d.count));

  return (
    <>
      <h1 className="font-display text-[17px] font-semibold">Overview</h1>
      <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-mut">
        Counts and timestamps only. Nothing on this page is derived from reading
        anyone&rsquo;s notes, tasks or saved links — the connection behind it
        has no permission to read them.
      </p>

      {waiting > 0 && (
        <Link
          href="/admin/feedback"
          className="mt-4 flex items-center gap-2 rounded-lg border border-warn bg-warn-soft px-3 py-2 text-[12.5px] font-medium text-warn transition-opacity hover:opacity-80"
        >
          {waiting} {waiting === 1 ? "message is" : "messages are"} waiting for
          a reply
          <span aria-hidden="true" className="ml-auto">
            &rarr;
          </span>
        </Link>
      )}

      <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Accounts" value={String(o.totalAccounts)} />
        <Metric
          label="Verified"
          value={String(o.verifiedAccounts)}
          note={`${o.totalAccounts - o.verifiedAccounts} still unverified`}
        />
        <Metric
          label="Active · 7 days"
          value={String(o.activeSevenDays)}
          note="signed in at least once"
        />
        <Metric label="Active · 30 days" value={String(o.activeThirtyDays)} />
      </div>

      <section className="mt-6 rounded-xl border border-ln bg-surf p-4">
        <h2 className="label-xs text-mut">Sign-ups · last 14 days</h2>
        <div className="mt-3 flex h-[90px] items-end gap-[3px]">
          {o.signupsFourteenDays.map((d) => (
            <div
              key={d.day}
              className="flex flex-1 flex-col items-center gap-1.5"
            >
              <div
                title={`${d.day}: ${d.count}`}
                className={
                  "w-full rounded-t-[3px] " + (d.count ? "bg-acc" : "bg-ln")
                }
                style={{ height: `${Math.max(2, (d.count / peak) * 74)}px` }}
              />
              <span className="text-[8.5px] text-fai">{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-xl border border-ln bg-surf p-4">
        <h2 className="label-xs text-mut">Security</h2>
        <p className="mt-2 text-[12.5px]">
          <span className="font-semibold">{o.failedSignins}</span>
          <span className="text-mut">
            {" "}
            account{o.failedSignins === 1 ? "" : "s"} currently locked out by
            the sign-in throttle.
          </span>
        </p>
      </section>
    </>
  );
}
