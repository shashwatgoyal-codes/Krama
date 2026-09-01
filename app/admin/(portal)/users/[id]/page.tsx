import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { adminDbConfigured } from "@/lib/admin/db";
import { accountDetail } from "@/lib/admin/queries";
import { canActOn, canManageAdmins, LEVEL_LABEL, LEVEL_BLURB } from "@/lib/admin/levels";
import ReasonedAction from "@/components/admin/ReasonedAction";
import DangerDelete from "@/components/admin/DangerDelete";
import {
  suspendAccount,
  restoreAccount,
  endSessions,
  promoteToAdmin,
  demoteToStandard,
  removeAccount,
} from "./actions";

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
      {account.suspendedAt && (
        <p className="mt-2 inline-block rounded border border-bad bg-bad-soft px-[6px] py-0.5 text-[11px] font-semibold text-bad">
          Suspended
        </p>
      )}

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
            <div className="mt-3 flex flex-col gap-3">
              {account.suspendedAt ? (
                <div>
                  <p className="text-[12px] text-mut">
                    Suspended on {account.suspendedAt.toISOString().slice(0, 10)}.
                    They cannot sign in.
                  </p>
                  <p className="mt-1 text-[11.5px] italic text-fai">
                    &ldquo;{account.suspendedReason}&rdquo;
                  </p>
                  <div className="mt-2">
                    <ReasonedAction
                      action={restoreAccount}
                      hidden={{ userId: account.id }}
                      label="Restore access"
                      title={`Restore access for ${account.email}`}
                      confirm="Restore"
                      tone="safe"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-[12px] leading-relaxed text-mut">
                    Suspending stops them signing in and ends every session they
                    have. Nothing is deleted and it can be undone.
                  </p>
                  <div className="mt-2">
                    <ReasonedAction
                      action={suspendAccount}
                      hidden={{ userId: account.id }}
                      label="Suspend account"
                      title={`Suspend ${account.email}`}
                      confirm="Suspend"
                    />
                  </div>
                </div>
              )}

              <div className="border-t border-ln pt-3">
                <p className="text-[12px] leading-relaxed text-mut">
                  Ends {account.liveSessions} live session
                  {account.liveSessions === 1 ? "" : "s"} without suspending —
                  for &ldquo;I left myself signed in somewhere&rdquo;.
                </p>
                <div className="mt-2">
                  <ReasonedAction
                    action={endSessions}
                    hidden={{ userId: account.id }}
                    label="Sign out everywhere"
                    title={`End every session for ${account.email}`}
                    confirm="Sign out"
                    tone="safe"
                  />
                </div>
              </div>

              <p className="border-t border-ln pt-3 text-[11.5px] leading-relaxed text-fai">
                Every action needs a reason and is recorded in the audit log
                under your name. Forcing a password reset is not here yet: it
                depends on email, which cannot reach anyone but the Resend
                account owner until a domain is verified.
              </p>
            </div>
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

      {canManageAdmins(actor.level) && account.level !== "superadmin" && (
        <div className="mt-4 rounded-xl border border-ln bg-surf p-4">
          <h2 className="label-xs text-mut">Super admin only</h2>

          <div className="mt-3 flex flex-wrap items-start gap-x-6 gap-y-3">
            <div>
              <p className="text-[12px] text-mut">
                Currently <strong>{LEVEL_LABEL[account.level]}</strong>.
              </p>
              <div className="mt-2">
                {account.level === "standard" ? (
                  <ReasonedAction
                    action={promoteToAdmin}
                    hidden={{ userId: account.id }}
                    label="Make admin"
                    title={`Make ${account.email} an admin`}
                    confirm="Promote"
                    tone="safe"
                  />
                ) : (
                  <ReasonedAction
                    action={demoteToStandard}
                    hidden={{ userId: account.id }}
                    label="Remove admin"
                    title={`Return ${account.email} to a standard account`}
                    confirm="Demote"
                  />
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-ln pt-3">
            <DangerDelete
              action={removeAccount}
              userId={account.id}
              email={account.email}
            />
          </div>

          <p className="mt-3 text-[11.5px] leading-relaxed text-fai">
            Nobody can be made a super admin here — that level has no row to
            write, which is why it lives in the environment. To change who it
            is, change SUPER_ADMIN_EMAIL and redeploy.
          </p>
        </div>
      )}
    </>
  );
}
