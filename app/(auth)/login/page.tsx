import Link from "next/link";
import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import AuthForm from "@/components/auth/AuthForm";
import Field from "@/components/auth/Field";
import { signIn } from "../actions";

export const metadata: Metadata = {
  title: "Sign in · Krama",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Pick up where you left off."
      aside={
        <>
          <p className="font-display text-[17px] font-semibold leading-snug tracking-[-0.02em]">
            Your day, decided once.
          </p>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-mut">
            Plan in the morning, drag what matters onto the clock, and let the
            rest wait.
          </p>
          <div className="mt-5 rounded-xl border border-ln bg-surf p-3">
            {[
              { t: "10:00", label: "Sprint standup", tone: "ok" },
              { t: "11:00", label: "Review the PR", tone: "ok" },
              { t: "14:00", label: "Migration notes", tone: "acc" },
              { t: "20:00", label: "Study block", tone: "idle" },
            ].map((row) => (
              <div key={row.t} className="flex items-center gap-2.5 py-1.5">
                <span className="w-11 flex-none text-right font-mono text-[9.5px] text-fai">
                  {row.t}
                </span>
                <span
                  className={
                    "flex-1 rounded-r-md border-l-2 px-2 py-1.5 text-[11px] font-semibold " +
                    (row.tone === "ok"
                      ? "border-l-ok bg-ok-soft"
                      : row.tone === "acc"
                        ? "border-l-acc bg-acc-soft"
                        : "border-l-ln2 bg-surf2 text-mut")
                  }
                >
                  {row.label}
                </span>
              </div>
            ))}
          </div>
        </>
      }
    >
      <AuthForm action={signIn} submitLabel="Sign in">
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
          autoComplete="current-password"
          required
          action={
            <Link href="/forgot" className="text-[11.5px] font-semibold text-acc">
              Forgot?
            </Link>
          }
        />
      </AuthForm>

      <p className="mt-4 text-center text-[12.5px] text-mut">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-acc">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
