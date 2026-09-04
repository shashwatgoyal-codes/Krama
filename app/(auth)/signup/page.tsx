import Link from "next/link";
import type { Metadata } from "next";
import { pageTitle } from "@/lib/env";
import { flagOnGlobally } from "@/lib/repositories/flags";
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";
import Field from "@/components/auth/Field";
import PasswordField from "@/components/auth/PasswordField";
import { signUp } from "../actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { redirectIfSignedIn } from "@/lib/auth/redirect-if-signed-in";

export const metadata: Metadata = {
  title: pageTitle("Create an account"),
  robots: { index: false, follow: false },
};

const PROMISES = [
  "Tasks, notes, a calendar and saved links in one place",
  "Routines that show up on their own, so you stop remembering them",
  "A score that rewards showing up, and forgives the days you don't",
  // Was "Export everything, any time, in one click". Export was taken out
  // on purpose — it handed over the points history, the one thing worth
  // tampering with — so the promise had outlived the feature.
  "Points you set yourself, so effort counts for what it's worth",
];

export default async function SignUpPage() {
  await redirectIfSignedIn();

  // The flag is a real gate, not a label. With it off the form is not
  // rendered at all — a hidden sign-up form is still a POST endpoint,
  // and the action refuses too.
  const open = await flagOnGlobally("open_registration");
  if (!open) return <ClosedRegistration />;

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
        <PasswordField
          label="Password"
          name="password"
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

/**
 * What a stranger sees when sign-ups are closed.
 *
 * It says the door is shut rather than pretending nothing is here — a
 * page that 404s would have people retrying the link, and this is a
 * state you turn on deliberately and turn off again.
 */
function ClosedRegistration() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-[380px] text-center">
        <h1 className="font-display text-[19px] font-semibold tracking-[-0.02em]">
          Krama is invite-only right now
        </h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-mut">
          New accounts are closed for the moment. If you already have one, you
          can still sign in.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-md bg-ink px-3 py-1.5 text-[12.5px] font-semibold text-paper"
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
