import { requireAdmin } from "@/lib/admin/guard";
import { canManageAdmins } from "@/lib/admin/levels";
import { allFlags } from "@/lib/repositories/flags";
import FlagRow from "./FlagRow";

export const dynamic = "force-dynamic";

export default async function FlagsPage() {
  const actor = await requireAdmin();
  const canEdit = canManageAdmins(actor.level);
  const flags = await allFlags();

  return (
    <>
      <h1 className="font-display text-[17px] font-semibold">Feature flags</h1>
      <p className="mt-1.5 max-w-[62ch] text-[12.5px] leading-relaxed text-mut">
        Which switches exist is decided in the codebase and added by migration —
        only their values are decided here. A flag with no row is off, so a
        mistyped key turns something off rather than on for everyone.
      </p>
      <p className="mt-2 max-w-[62ch] text-[12.5px] leading-relaxed text-mut">
        A partial rollout is stable per person: somebody inside 30% stays inside
        every larger share, so nobody loses a feature because somebody else was
        let in.
      </p>

      {!canEdit && (
        <p className="mt-4 rounded-xl border border-ln bg-surf p-3 text-[12px] text-mut">
          You can see these. Changing what other people get is configuration
          rather than an action on an account, so it sits with the super admin.
        </p>
      )}

      <div className="mt-5 rounded-xl border border-ln bg-surf">
        {flags.map((f) => (
          <FlagRow key={f.key} flag={f} canEdit={canEdit} />
        ))}
      </div>
    </>
  );
}
