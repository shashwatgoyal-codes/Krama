import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { adminDbConfigured } from "@/lib/admin/db";
import { LEVEL_LABEL } from "@/lib/admin/levels";
import { pageTitle } from "@/lib/env";

export const metadata: Metadata = {
  title: pageTitle("Admin"),
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/admins", label: "Admins" },
  { href: "/admin/audit", label: "Audit log" },
];

/**
 * Every admin screen sits inside this, and the gate is here rather than
 * on each page — one place to get right, and a new page added later is
 * protected by existing rather than by someone remembering.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const actor = await requireAdmin();

  return (
    <div className="min-h-screen bg-paper">
      {/* Not decoration. Nothing else in this app is striped, so a
          screenshot of this page is unambiguous, and so is glancing at
          the wrong tab. */}
      <div
        aria-hidden="true"
        className="h-1 w-full"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, var(--warn) 0 10px, transparent 10px 20px)",
        }}
      />

      <header className="flex-none border-b border-ln bg-surf">
        <div className="flex h-12 items-center gap-3.5 px-4">
          <span className="font-display text-[14.5px] font-semibold tracking-[-0.015em]">
            Krama
          </span>
          <span className="label-xs -ml-1.5 rounded border border-warn bg-warn-soft px-[5px] py-0.5 text-warn">
            Admin
          </span>

          <nav className="flex gap-[3px]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2.5 py-[5px] text-[12.5px] font-medium text-mut transition-colors hover:bg-surf2 hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-[11.5px] text-mut">
            <span title={actor.email}>
              {actor.email} · {LEVEL_LABEL[actor.level]}
            </span>
            <Link
              href="/app"
              className="rounded-md border border-ln2 px-2 py-1 font-medium transition-colors hover:bg-surf2 hover:text-ink"
            >
              Leave admin
            </Link>
          </div>
        </div>
      </header>

      {!adminDbConfigured() && (
        <p className="border-b border-bad bg-bad-soft px-4 py-2 text-[12px] text-bad">
          ADMIN_DATABASE_URL is not set, so these screens have no restricted
          connection to read through. See docs/ADMIN.md — nothing will load
          until it is configured, and that is deliberate.
        </p>
      )}

      <main className="mx-auto max-w-[1100px] px-4 py-6">{children}</main>
    </div>
  );
}
