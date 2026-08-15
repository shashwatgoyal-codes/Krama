import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import Section from "@/components/profile/Section";
import VerifyEmailForm from "@/components/auth/VerifyEmailForm";
import { sendVerification } from "./actions";

export const metadata: Metadata = {
  title: "Confirm your email · Krama",
  robots: { index: false, follow: false },
};

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
          <VerifyEmailForm email={user.email} autoSent={autoSent} />
        </Section>
      )}
    </div>
  );
}
