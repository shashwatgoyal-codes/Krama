import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { canManageAdmins, LEVEL_LABEL } from "@/lib/admin/levels";
import { listAdmins, listPending, INVITE_TTL_DAYS } from "@/lib/admin/invites";
import InviteForm from "./InviteForm";
import ReasonedAction from "@/components/admin/ReasonedAction";
import { withdrawInvite, removeAdmin } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const actor = await requireAdmin();
  const manage = canManageAdmins(actor.level);
  const [admins, pending] = await Promise.all([listAdmins(), listPending()]);

  return (
    <>
      <h1 className="font-display text-[17px] font-semibold">Admins</h1>
      <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-mut">
        Everyone who can open this portal. The super admin is not listed here
        because it is not granted here — it comes from{" "}
        <code className="font-mono text-[11.5px]">SUPER_ADMIN_EMAIL</code>, so
        reaching the top needs deploy access rather than a row in a table.
      </p>

      {manage ? (
        <div className="mt-5">
          <InviteForm />
        </div>
      ) : (
        <p className="mt-5 rounded-xl border border-ln bg-surf p-4 text-[12px] text-mut">
          Only a super admin can invite or revoke. You can see who has access.
        </p>
      )}

      <section className="mt-5">
        <h2 className="label-xs text-mut">
          Current admins · {admins.length}
        </h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-ln bg-surf">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-ln text-left">
                {["Account", "Level", "Since", "Granted by", ""].map((h, i) => (
                  <th key={i} className="label-xs px-3.5 py-2.5 font-semibold text-mut">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-b border-ln last:border-0">
                  <td className="px-3.5 py-2.5">
                    {/* Clickable for the same reason the users table is:
                        the name is the thing you want to look into, and
                        having to go back to Users and search for somebody
                        you are already looking at is the kind of small
                        friction that makes a tool feel unfinished. */}
                    <Link
                      href={`/admin/users/${a.user.id}`}
                      className="font-semibold text-acc"
                    >
                      {a.user.name}
                    </Link>
                    <span className="block text-[11px] text-mut">{a.user.email}</span>
                  </td>
                  <td className="px-3.5 py-2.5">{LEVEL_LABEL[a.level]}</td>
                  <td className="px-3.5 py-2.5 text-mut">
                    {a.grantedAt.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-3.5 py-2.5 text-mut">{a.grantedBy ?? "—"}</td>
                  <td className="px-3.5 py-2.5 text-right">
                    {manage && a.user.id !== actor.userId && (
                      <ReasonedAction
                        action={removeAdmin}
                        hidden={{ userId: a.user.id }}
                        label="Revoke"
                        title={`Revoke admin access for ${a.user.email}`}
                        confirm="Revoke access"
                      />
                    )}
                  </td>
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3.5 py-6 text-center text-mut">
                    Nobody but the super admin has access.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="label-xs text-mut">Open invitations · {pending.length}</h2>
        <div className="mt-2 overflow-x-auto rounded-xl border border-ln bg-surf">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <tbody>
              {pending.map((inv) => (
                <tr key={inv.id} className="border-b border-ln last:border-0">
                  <td className="px-3.5 py-2.5">
                    <span className="font-semibold">{inv.email}</span>
                    <span className="block text-[11px] text-mut">
                      invited by {inv.invitedBy} on{" "}
                      {inv.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </td>
                  <td className="px-3.5 py-2.5">
                    {inv.expired ? (
                      <span className="rounded border border-warn bg-warn-soft px-[5px] py-0.5 text-[10.5px] font-semibold text-warn">
                        Lapsed
                      </span>
                    ) : (
                      <span className="text-[11.5px] text-mut">
                        expires {inv.expiresAt.toISOString().slice(0, 10)}
                      </span>
                    )}
                  </td>
                  <td className="px-3.5 py-2.5 text-right">
                    {manage && (
                      <ReasonedAction
                        action={withdrawInvite}
                        hidden={{ id: inv.id }}
                        label="Withdraw"
                        title={`Withdraw the invitation to ${inv.email}`}
                        confirm="Withdraw"
                      />
                    )}
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td className="px-3.5 py-6 text-center text-mut">
                    Nothing outstanding. Invitations last {INVITE_TTL_DAYS} days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-fai">
          Lapsed invitations are listed rather than hidden — &ldquo;I sent it and
          nothing happened&rdquo; is answered by seeing that it sat there and
          expired.
        </p>
      </section>
    </>
  );
}
