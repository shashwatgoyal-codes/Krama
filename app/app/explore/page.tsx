import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import NotBuiltYet from "@/components/NotBuiltYet";

export const metadata: Metadata = {
  title: "Explore · Krama",
  robots: { index: false, follow: false },
};

export default async function Page() {
  // Gated like every other page, even though there's nothing here yet.
  await requireUser();

  return (
    <NotBuiltYet
      title="Explore"
      what="Somewhere to keep links worth returning to. Paste a URL, it fetches the title and preview, and you note why you saved it, which is what makes a bookmark worth having later."
      next="Saving links with their metadata, and turning one into a task."
    />
  );
}
