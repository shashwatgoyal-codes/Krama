import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import { appEnv } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import VerifyBanner from "@/components/VerifyBanner";

export const metadata: Metadata = {
  title: "Krama",
  // The app is private — never index it, whatever robots.txt says.
  robots: { index: false, follow: false },
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Not requireUser(): the pages below each gate properly, and a layout
  // that redirects would fight them. This only decides whose initial
  // sits in the corner.
  const user = await getSessionUser();

  const account = user
    ? await db.user.findUnique({
        where: { id: user.id },
        select: { emailVerified: true },
      })
    : null;

  return (
    // min-h-screen + flex-col so the two panes below can fill the
    // remaining height rather than collapsing to their content.
    <div className="flex min-h-screen flex-col">
      {/* Read on the server: APP_ENV isn't NEXT_PUBLIC_, so it never
          reaches the browser except as this one resolved value. */}
      <TopBar env={appEnv()} name={user?.name ?? "You"} />
      {user && !account?.emailVerified && <VerifyBanner email={user.email} />}
      {children}
    </div>
  );
}
