import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { adminDbConfigured } from "@/lib/admin/db";
import { supportDbConfigured } from "@/lib/admin/support-db";
import { accountDetail } from "@/lib/admin/queries";
import { canActOn } from "@/lib/admin/levels";
import { liveAccess, pendingRequest, view, SCOPE_LABEL } from "@/lib/admin/support";
import AskForm from "./AskForm";

export const dynamic = "force-dynamic";

export default async function SupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ scope?: string }>;
}) {
  const actor = await requireAdmin();
  if (!adminDbConfigured()) return null;

  const { id } = await params;
  const account = await accountDetail(id);
  if (!account) notFound();

  const allowed = canActOn(actor.level, account.level);
  const live = allowed ? await liveAccess(actor.email, id) : null;
  const pending = allowed ? await pendingRequest(actor.email, id) : null;

  const { scope } = await searchParams;
  const opened =
    live && scope && (SCOPE_LABEL as Record<string, string>)[scope]
      // Reading happens here, and only here. Every call is recorded on
      // the way through, so the person sees it in their own settings.
      ? await view(actor, id, scope as keyof typeof SCOPE_LABEL)
      : null;

  return (
    <>
      <Link href={`/admin/users/${id}`} className="text-[12px] font-semibold text-acc">
        ← {account.name}
      </Link>
      <h1 className="mt-2 font-display text-[17px] font-semibold">Support access</h1>
      <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-mut">
        The only way to read what someone wrote, and it is theirs to grant.
        Read-only, time-boxed, visible to them while it is happening, and they
        can end it at any moment.
      </p>

      {!supportDbConfigured() && (
        <p className="mt-4 rounded-xl border border-bad bg-bad-soft p-3 text-[12px] text-bad">
          SUPPORT_DATABASE_URL is not set, so nothing can be read on this
          deployment even with permission. See docs/ADMIN.md.
        </p>
      )}

      {!allowed ? (
        <p className="mt-5 rounded-xl border border-ln bg-surf p-4 text-[12.5px] text-mut">
          You cannot ask this account for access — it is not a standard account.
        </p>
      ) : live ? (
        <>
          <div className="mt-5 rounded-xl border border-ok bg-ok-soft p-4">
            <p className="text-[12.5px] font-semibold text-ok">
              {account.email} approved this until{" "}
              {live.accessUntil!.toISOString().slice(0, 16).replace("T", " ")}
            </p>
            <p className="mt-1 text-[11.5px] text-mut">
              They can see everything you open, and can stop this at any point.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {live.scopes.map((s) => (
              <Link
                key={s}
                href={`/admin/users/${id}/support?scope=${s}`}
                className={
                  "rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold " +
                  (scope === s
                    ? "border-acc bg-acc-soft text-acc"
                    : "border-ln2 text-mut hover:bg-surf2")
                }
              >
                {SCOPE_LABEL[s]}
              </Link>
            ))}
          </div>

          {opened && (
            <div className="mt-4 rounded-xl border border-ln bg-surf">
              {opened.ok ? (
                opened.items.length === 0 ? (
                  <p className="p-4 text-center text-[12.5px] text-mut">
                    They have nothing here.
                  </p>
                ) : (
                  opened.items.map((item) => (
                    <div key={item.id} className="border-b border-ln p-3 last:border-0">
                      <p className="whitespace-pre-wrap text-[12.5px]">{item.text}</p>
                      <p className="mt-1 font-mono text-[10.5px] text-fai">
                        {item.at.toISOString().slice(0, 10)}
                      </p>
                    </div>
                  ))
                )
              ) : (
                <p className="p-4 text-[12.5px] text-bad">{opened.error}</p>
              )}
            </div>
          )}
        </>
      ) : pending ? (
        <p className="mt-5 rounded-xl border border-acc bg-acc-soft p-4 text-[12.5px] text-acc">
          You have asked, and {account.email} has not answered yet. The request
          lapses on{" "}
          {pending.requestExpiresAt.toISOString().slice(0, 10)} if they never do.
        </p>
      ) : (
        <div className="mt-5 rounded-xl border border-ln bg-surf p-4">
          <AskForm userId={id} email={account.email} />
        </div>
      )}
    </>
  );
}
