import Link from "next/link";
import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";
import Field from "@/components/auth/Field";
import { signUp } from "../actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";

export const metadata: Metadata = {
  title: "Create an account · Krama",
  robots: { index: false, follow: false },
};

const PROMISES = [
  "Tasks, notes, a calendar and saved links in one place",
  "Routines that show up on their own, so you stop remembering them",
  "A score that rewards showing up, and forgives the days you don't",
  "Export everything, any time, in one click",
];

export default function SignUpPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Free while it's being built. No card."
      aside={
        <>
          <p className="font-display text-[17px] font-semibold leading-snug tracking-[-0.02em]">
            What you get
          </p>
          <ul className="mt-4 space-y-2.5">
            {PROMISES.map((line) => (
              <li key={line} className="flex gap-2.5 text-[12.5px] text-mut">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-none">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                <span>{line}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-lg border border-ln bg-surf px-3.5 py-3 text-[12px] leading-relaxed text-mut">
            <strong className="font-semibold text-ink">
              Your notes stay yours.
            </strong>{" "}
            Nobody running Krama can read what you write.
          </p>
        </>
      }
    >
      <AuthForm action={signUp} submitLabel="Create account">
        <Field
          label="Name"
          name="name"
          type="text"
          autoComplete="name"
          required
          placeholder="Shashwat"
        />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          hint={
            <>
              At least {MIN_PASSWORD_LENGTH} characters. Length matters more
              than symbols — a long phrase beats a short scramble.
            </>
          }
        />
      </AuthForm>

      <p className="mt-4 text-center text-[12.5px] text-mut">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-acc">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
