import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import NotBuiltYet from "@/components/NotBuiltYet";

export const metadata: Metadata = {
  title: "Calendar · Krama",
  robots: { index: false, follow: false },
};

export default async function Page() {
  // Gated like every other page, even though there's nothing here yet.
  await requireUser();

  return (
    <NotBuiltYet
      title="Calendar"
      what="A week view you can drag tasks onto to give them a time. Completing the block completes the task."
      next="Deciding first whether this reads your real calendar. A week view that doesn't know about your actual meetings would let you double-book yourself."
    />
  );
}
