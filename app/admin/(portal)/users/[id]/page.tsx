import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { adminDbConfigured } from "@/lib/admin/db";
import { accountDetail } from "@/lib/admin/queries";
import { canActOn, LEVEL_LABEL, LEVEL_BLURB } from "@/lib/admin/levels";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-ln py-2 last:border-0">
      <span className="text-[12px] text-mut">{label}</span>
      <span className="text-[12.5px] font-medium">{value}</span>
    </div>
  );
}

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdmin();
  if (!adminDbConfigured()) return null;

  const { id } = await params;
  const account = await accountDetail(id);
  if (!account) notFound();

  return (
    <>
      <Link href="/admin/users" className="text-[12px] font-semibold text-acc">
        ← Users
      </Link>

      <h1 className="mt-2 font-display text-[17px] font-semibold">{account.name}</h1>
      <p className="text-[12.5px] text-mut">{account.email}</p>
      <p className="mt-1 text-[11.5px] text-fai">{LEVEL_BLURB[account.level]}</p>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-xl border border-ln bg-surf p-4">
          <h2 className="label-xs text-mut">Account</h2>
          <div className="mt-2">
            <Row label="Account ID" value={account.id} />
            <Row label="Role" value={LEVEL_LABEL[account.level]} />
            {account.level === "admin" && (
              <>
                <Row
                  label="Admin since"
                  value={account.grantedAt ? account.grantedAt.toISOString().slice(0, 10) : "unknown"}
                />
                <Row label="Granted by" value={account.grantedBy ?? "unknown"} />
              </>
            )}
            <Row label="Status" value={account.verified ? "Verified" : "Unverified"} />
            <Row label="Joined" value={account.joined.toISOString().slice(0, 10)} />
            <Row
              label="Last signed in"
              value={account.lastSeen ? account.lastSeen.toISOString().slice(0, 10) : "never"}
            />
            <Row label="Live sessions" value={String(account.liveSessions)} />
            <Row label="Timezone" value={account.timezone ?? "not set"} />
          </div>

          <h2 className="label-xs mt-5 text-mut">Usage</h2>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {(
              [
                ["Tasks", account.breakdown.tasks],
                ["Notes", account.breakdown.notes],
                ["Events", account.breakdown.events],
                ["Links", account.breakdown.links],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-lg border border-ln bg-surf2 p-2.5 text-center">
                <p className="font-display text-[19px] font-semibold leading-none tabular-nums">
                  {n}
                </p>
                <p className="mt-1 text-[10.5px] text-mut">{label}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 rounded-lg border border-ln bg-surf2 p-3 text-[11.5px] leading-relaxed text-mut">
            You cannot read this account&rsquo;s content. Not because the screen
            declines to show it — the connection these figures came from has no
            permission to select it, so a change to this page could not reveal
            it either. Reaching content requires the account holder&rsquo;s
            consent, through a request they can see and revoke.
          </p>
        </div>

        <div className="rounded-xl border border-ln bg-surf p-4">
          <h2 className="label-xs text-mut">Actions</h2>
          {canActOn(actor.level, account.level) ? (
            <p className="mt-2 text-[12px] leading-relaxed text-mut">
              None yet. Suspend, force a password reset and request content
              access all land here — each one needing a written reason, each one
              recorded in the audit log under your name. They are deliberately
              not shipped before that log exists.
            </p>
          ) : account.level === "superadmin" ? (
            <p className="mt-2 text-[12px] leading-relaxed text-mut">
              Nobody can act on a super admin from in here — not even a super
              admin. That seat is entered and left through the environment, so
              the portal cannot lock out the one person who can unlock it.
            </p>
          ) : (
            <p className="mt-2 text-[12px] leading-relaxed text-mut">
              You manage standard accounts. Acting on another admin needs
              Super admin.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
