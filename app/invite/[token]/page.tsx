import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth/session";
import { accept } from "@/lib/admin/invites";
import { pageTitle } from "@/lib/env";

export const metadata: Metadata = {
  title: pageTitle("Admin invitation"),
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Accepting an invitation.
 *
 * Deliberately not under /admin: everything there is behind requireAdmin,
 * and the whole point of this page is that the person opening it is not
 * an admin yet. It needs a session, not a role.
 *
 * Accepting happens on load rather than behind a button. The link is the
 * confirmation — it was sent privately to one address, it is checked
 * against the signed-in account, and it works once. A second "are you
 * sure" would only add a step to a decision already made by the person
 * who sent it.
 */
export default async function AcceptInvite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getSessionUser();

  // Sign in first, then come back here rather than landing on Today.
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  const result = await accept(token, user);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-[400px] text-center">
        {result.ok ? (
          <>
            <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
              You are an admin
            </h1>
            <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
              You can open the portal from the Admin link in the top bar. You
              can see every account and act on standard ones — not on other
              admins, and not on the super admin.
            </p>
            <Link
              href="/admin"
              className="mt-6 inline-block rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper"
            >
              Open the portal
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
              That invitation didn&rsquo;t work
            </h1>
            <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
              {result.error}
            </p>
            <Link
              href="/app"
              className="mt-6 inline-block rounded-md border border-ln2 px-3 py-1.5 text-[12.5px] font-medium text-mut"
            >
              Go to Today
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
