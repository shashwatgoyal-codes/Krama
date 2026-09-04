import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import { signOut } from "@/app/(auth)/actions";
import { currentAdmin } from "@/lib/admin/guard";
import AccessBanner from "@/components/AccessBanner";
import QuickCapture from "@/components/QuickCapture";
import { db as database } from "@/lib/db";
import { canOpenPortal } from "@/lib/admin/levels";
import { appEnv } from "@/lib/env";
import { getSessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { ACCENT_TOKENS, isAccent } from "@/lib/appearance";
import { tintCss, DEFAULT_TINTS } from "@/lib/notes";
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
  // Cheap for the overwhelming majority: the superadmin check is a string
  // comparison against an environment variable, and the grant lookup is a
  // unique-index hit that only runs for a signed-in visitor.
  const admin = await currentAdmin();

  // Two counts, one query each, only for a signed-in visitor. Worth the
  // cost on every page: a banner that appears a page late is a banner
  // that let somebody read something without you knowing.
  const now = new Date();
  const [liveAccess, waitingAccess] = user
    ? await Promise.all([
        database.supportAccess.count({
          where: {
            userId: user.id, approvedAt: { not: null }, revokedAt: null,
            accessUntil: { gt: now },
          },
        }),
        database.supportAccess.count({
          where: {
            userId: user.id, approvedAt: null, declinedAt: null,
            requestExpiresAt: { gt: now },
          },
        }),
      ])
    : [0, 0];

  const account = user
    ? await db.user.findUnique({
        where: { id: user.id },
        select: {
          emailVerified: true,
          avatarAt: true,
          profile: {
            select: {
              accent: true,
              density: true,
              reduceMotion: true,
              interfaceFont: true,
              noteTints: true,
            },
          },
        },
      })
    : null;

  const settings = account?.profile;
  const accent = isAccent(settings?.accent ?? "") ? settings!.accent : "amber";
  const tokens = ACCENT_TOKENS[accent as keyof typeof ACCENT_TOKENS];

  // The accent is two custom properties, so changing it is an override
  // rather than a parallel set of Tailwind classes per colour. Written
  // as a <style> because the dark value has to live behind a media query
  // and a [data-theme] rule, which an inline style attribute cannot do.
  const accentCss = `
    [data-accent] { --acc: ${tokens.light[0]}; --acc-soft: ${tokens.light[1]}; }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) [data-accent] {
        --acc: ${tokens.dark[0]}; --acc-soft: ${tokens.dark[1]};
      }
    }
    :root[data-theme="dark"] [data-accent] {
      --acc: ${tokens.dark[0]}; --acc-soft: ${tokens.dark[1]};
    }
    :root[data-theme="light"] [data-accent] {
      --acc: ${tokens.light[0]}; --acc-soft: ${tokens.light[1]};
    }
  `;

  return (
    // min-h-screen + flex-col so the two panes below can fill the
    // remaining height rather than collapsing to their content.
    <div
      data-accent={accent}
      data-density={settings?.density ?? "comfortable"}
      data-motion={settings?.reduceMotion ? "reduced" : "full"}
      data-font={settings?.interfaceFont ?? "krama"}
      data-tints=""
      className="flex min-h-screen flex-col"
    >
      <style
        dangerouslySetInnerHTML={{
          __html:
            accentCss + tintCss(settings?.noteTints ?? DEFAULT_TINTS),
        }}
      />
      {/* Read on the server: APP_ENV isn't NEXT_PUBLIC_, so it never
          reaches the browser except as this one resolved value. */}
      <TopBar
        isAdmin={admin !== null && canOpenPortal(admin.level)}
        env={appEnv()}
        name={user?.name ?? "You"}
        email={user?.email ?? ""}
        signOut={signOut}
        avatar={
          user && account?.avatarAt
            ? `/api/avatar/${user.id}?v=${account.avatarAt.getTime()}`
            : null
        }
      />
      {user && !account?.emailVerified && <VerifyBanner email={user.email} />}
      <AccessBanner count={liveAccess} waiting={waitingAccess} />
      <QuickCapture />
      {children}
    </div>
  );
}
