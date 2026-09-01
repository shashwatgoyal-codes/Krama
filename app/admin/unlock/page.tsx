import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/admin/guard";
import { canOpenPortal } from "@/lib/admin/levels";
import { isStepped, STEPUP_TTL_MINUTES } from "@/lib/admin/stepup";
import UnlockForm from "./UnlockForm";

export const dynamic = "force-dynamic";

/**
 * The password prompt in front of the portal.
 *
 * Outside the admin layout on purpose — that layout is what requires a
 * step-up, so putting this inside it would be a door that needs its own
 * key to reach.
 */
export default async function Unlock({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const actor = await currentAdmin();
  if (!actor || !canOpenPortal(actor.level)) redirect("/app");
  if (await isStepped(actor.userId)) redirect("/admin");

  const { next } = await searchParams;
  // Only same-site admin paths, so this cannot become an open redirect.
  const target = next && next.startsWith("/admin") ? next : "/admin";

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-[380px]">
        <div
          aria-hidden="true"
          className="mb-6 h-1 w-full rounded"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, var(--warn) 0 10px, transparent 10px 20px)",
          }}
        />
        <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
          Confirm it&rsquo;s you
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
          Your sign-in lasts thirty days, which is right for a planner and wrong
          for a portal that can act on other people&rsquo;s accounts. Entering
          your password unlocks it for {STEPUP_TTL_MINUTES} minutes.
        </p>
        <UnlockForm next={target} email={actor.email} />
      </div>
    </main>
  );
}
