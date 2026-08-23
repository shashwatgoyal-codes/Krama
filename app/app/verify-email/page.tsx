import type { Metadata } from "next";
import { pageTitle } from "@/lib/env";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import Section from "@/components/profile/Section";
import VerifyEmailForm from "@/components/auth/VerifyEmailForm";
import { emailConfigured } from "@/lib/email/send";
import { sendVerification } from "./actions";

export const metadata: Metadata = {
  title: pageTitle("Confirm your email"),
  robots: { index: false, follow: false },
};

/**
 * The most recent message written for this address.
 *
 * Only consulted when there is no mail provider — it exists so that the
 * page can point at the file rather than leaving you to guess which of
 * several it is. The code itself is never read here: it lives in the
 * picture, and the plaintext is dropped the moment it is drawn.
 */
async function newestMailFor(email: string): Promise<string | null> {
  try {
    const { readdir } = await import("node:fs/promises");
    const slug = email.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
    const files = await readdir(".mail");
    const mine = files
      .filter((f) => f.includes(slug) && f.endsWith(".html"))
      .sort()
      .reverse();
    return mine[0] ?? null;
  } catch {
    // No directory yet, or no permission to look. Neither is worth an
    // error on a page whose job is to accept six digits.
    return null;
  }
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const record = await db.user.findUnique({
    where: { id: user.id },
    select: { emailVerified: true },
  });

  // Arriving straight from sign-up sends the first code without making
  // anyone press a button for it.
  const latestMail = emailConfigured()
    ? null
    : await newestMailFor(user.email);

  let autoSent = false;
  if (!record?.emailVerified && params.sent === "1") {
    const result = await sendVerification();
    autoSent = result.ok;
  }

  return (
    <div className="mx-auto w-full max-w-[560px] px-5 py-6">
      <h1 className="mb-1 font-display text-xl font-semibold tracking-[-0.025em]">
        Confirm your email
      </h1>
      <p className="mb-5 max-w-[54ch] text-[12.5px] leading-relaxed text-mut">
        This is what lets you get back in if you ever forget your password.
        Until it&rsquo;s confirmed, a reset code has nowhere safe to go.
      </p>

      {record?.emailVerified ? (
        <Section title="Already confirmed">
          <p className="text-[12.5px] leading-relaxed text-mut">
            {user.email} was confirmed on{" "}
            {record.emailVerified.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Nothing to do here.
          </p>
          <Link
            href="/app"
            className="mt-3 inline-block text-[12.5px] font-semibold text-acc"
          >
            Back to today
          </Link>
        </Section>
      ) : (
        <Section
          title={user.email}
          description="The code is in the image inside that email — not as text, and not in the subject line. Read the digits and type them below."
        >
          {/* Says so when no mail can leave the building.
              Without a provider the message is written to .mail/ and
              nothing is sent, and this page used to say "check your
              inbox" regardless — so the only way to find out was to
              wait for an email that was never coming. */}
          {!emailConfigured() && (
            <p className="mb-3 rounded-lg border border-warn bg-warn-soft px-3 py-2 text-[11.5px] leading-relaxed text-ink">
              <span className="font-semibold">No email is being sent.</span>{" "}
              This deployment has no mail provider, so nothing reaches your
              inbox — the message is written to{" "}
              <code className="font-mono">.mail/</code> instead, with the code
              in the picture beside it.
              {latestMail && (
                <>
                  {" "}
                  The newest one is{" "}
                  <code className="break-all font-mono">{latestMail}</code>.
                </>
              )}{" "}
              Set <code className="font-mono">RESEND_API_KEY</code> to send real
              mail.
            </p>
          )}
          <VerifyEmailForm email={user.email} autoSent={autoSent} />
        </Section>
      )}
    </div>
  );
}
