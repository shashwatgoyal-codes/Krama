import type { Metadata } from "next";
import { requireUserOrThrow } from "@/lib/auth/guard";
import { requestsFor, SCOPE_LABEL, ACCESS_TTL_HOURS } from "@/lib/admin/support";
import { pageTitle } from "@/lib/env";
import Decide from "./Decide";
import { approveRequest, declineRequest, revokeAccess } from "./actions";

export const metadata: Metadata = {
  title: pageTitle("Support access"),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function when(d: Date) {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default async function AccessPage() {
  const user = await requireUserOrThrow();
  const rows = await requestsFor(user.id);
  const now = new Date();

  const waiting = rows.filter(
    (r) => !r.approvedAt && !r.declinedAt && r.requestExpiresAt > now,
  );
  const live = rows.filter(
    (r) => r.approvedAt && !r.revokedAt && r.accessUntil && r.accessUntil > now,
  );
  const past = rows.filter((r) => !waiting.includes(r) && !live.includes(r));

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8">
      <h1 className="font-display text-[17px] font-semibold">Support access</h1>
      <p className="mt-2 max-w-[58ch] text-[12.5px] leading-relaxed text-mut">
        Nobody running Krama can read your tasks, notes, calendar or saved links.
        That is enforced by the database, not by a promise. If someone needs to
        look in order to help you, they have to ask here — and you can say no,
        or say yes and change your mind.
      </p>

      {waiting.length > 0 && (
        <section className="mt-6">
          <h2 className="label-xs text-mut">Waiting for you</h2>
          {waiting.map((r) => (
            <div key={r.id} className="mt-2 rounded-xl border border-acc bg-acc-soft p-4">
              <p className="text-[13px] font-semibold">
                {r.adminEmail} wants to look at your{" "}
                {r.scopes.map((s) => SCOPE_LABEL[s].toLowerCase()).join(", ")}
              </p>
              <p className="mt-1.5 text-[12.5px] italic text-mut">
                &ldquo;{r.reason}&rdquo;
              </p>
              <p className="mt-2 text-[11.5px] text-mut">
                Asked {when(r.requestedAt)}. If you approve, they can look for{" "}
                {ACCESS_TTL_HOURS} hours, read-only, and you can stop it at any
                point. They can never change anything.
              </p>
              <div className="mt-3">
                <Decide
                  id={r.id}
                  approve={approveRequest}
                  decline={declineRequest}
                />
              </div>
            </div>
          ))}
        </section>
      )}

      {live.length > 0 && (
        <section className="mt-6">
          <h2 className="label-xs text-mut">Happening now</h2>
          {live.map((r) => (
            <div key={r.id} className="mt-2 rounded-xl border border-warn bg-warn-soft p-4">
              <p className="text-[13px] font-semibold">
                {r.adminEmail} can see your{" "}
                {r.scopes.map((s) => SCOPE_LABEL[s].toLowerCase()).join(", ")}
              </p>
              <p className="mt-1 text-[11.5px] text-mut">
                Until {when(r.accessUntil!)}, unless you stop it.
              </p>

              {r.views.length > 0 ? (
                <ul className="mt-2 space-y-0.5">
                  {r.views.map((v) => (
                    <li key={v.id} className="text-[11.5px] text-mut">
                      Opened your {SCOPE_LABEL[v.scope].toLowerCase()} —{" "}
                      {v.count} item{v.count === 1 ? "" : "s"} · {when(v.viewedAt)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11.5px] text-fai">
                  They have not opened anything yet.
                </p>
              )}

              <div className="mt-3">
                <Decide id={r.id} revoke={revokeAccess} />
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="mt-6">
        <h2 className="label-xs text-mut">Earlier</h2>
        {past.length === 0 ? (
          <p className="mt-2 rounded-xl border border-ln bg-surf p-4 text-[12.5px] text-mut">
            Nobody has ever asked to look at your things.
          </p>
        ) : (
          <div className="mt-2 rounded-xl border border-ln bg-surf">
            {past.map((r) => (
              <div key={r.id} className="border-b border-ln p-3.5 last:border-0">
                <p className="text-[12.5px]">
                  <span className="font-semibold">{r.adminEmail}</span>{" "}
                  <span className="text-mut">
                    {r.declinedAt
                      ? "— you said no"
                      : r.revokedAt
                        ? "— you ended it early"
                        : r.approvedAt
                          ? "— access has expired"
                          : "— the request lapsed unanswered"}
                  </span>
                </p>
                <p className="mt-0.5 text-[11.5px] text-fai">
                  {when(r.requestedAt)} ·{" "}
                  {r.views.length} thing{r.views.length === 1 ? "" : "s"} opened
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
