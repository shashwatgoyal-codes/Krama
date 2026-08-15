import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import NotBuiltYet from "@/components/NotBuiltYet";

export const metadata: Metadata = {
  title: "Notes · Krama",
  robots: { index: false, follow: false },
};

export default async function Page() {
  // Gated like every other page, even though there's nothing here yet.
  await requireUser();

  return (
    <NotBuiltYet
      title="Notes"
      what="A board of colour-coded sticky notes you can drag anywhere. Each one can become a task, so a thought turns into something scheduled without retyping it."
      next="The board, drag positions and the five note colours."
    />
  );
}
