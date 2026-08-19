"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Shown on every /app page until the address is confirmed.
 *
 * Persistent rather than dismissible on purpose, and this is the one
 * place in the app where that is the right call: an unconfirmed address
 * means a forgotten password is an unrecoverable account. It is stated
 * plainly once and never nags beyond that.
 */
export default function VerifyBanner({ email }: { email: string }) {
  // Pointless on the page whose entire job is to fix this.
  if (usePathname() === "/app/verify-email") return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-warn bg-warn-soft px-4 py-2">
      <span className="text-[12px] text-ink">
        <span className="font-semibold">{email}</span> isn&rsquo;t confirmed
        yet — without it, a forgotten password can&rsquo;t be reset.
      </span>
      <Link
        href="/app/verify-email"
        className="text-[12px] font-semibold text-acc underline underline-offset-2"
      >
        Confirm it now
      </Link>
    </div>
  );
}
