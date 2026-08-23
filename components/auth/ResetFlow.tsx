"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Field from "./Field";
import PasswordField from "@/components/auth/PasswordField";
import CodeField from "./CodeField";
import { requestReset, resetPassword } from "@/app/(auth)/forgot/actions";

/**
 * Both halves of the reset on one page.
 *
 * Deliberately not two routes: carrying the address to a second page
 * means either putting it in the URL — where it lands in history, logs
 * and referrers — or trusting the user to retype it exactly. Keeping the
 * flow in one component avoids both.
 */
export default function ResetFlow() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function request(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await requestReset(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmail(String(formData.get("email") ?? ""));
      setNotice(
        typeof result.data === "string"
          ? result.data
          : "If that address has an account, a code is on its way.",
      );
      setStep("code");
    });
  }

  function submit(formData: FormData) {
    setError(null);
    formData.set("email", email);
    startTransition(async () => {
      // Redirects on success and never returns.
      const result = await resetPassword(formData);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-bad bg-bad-soft px-3 py-2.5 text-[12.5px] leading-snug text-ink"
        >
          {error}
        </p>
      )}

      {notice && (
        <p className="mt-4 rounded-lg border border-ok bg-ok-soft px-3 py-2.5 text-[12.5px] leading-snug text-ink">
          {notice}
        </p>
      )}

      {step === "email" ? (
        <form action={request} noValidate>
          <fieldset disabled={pending}>
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </fieldset>
          <Submit pending={pending} label="Send me a code" />
          <p className="mt-4 text-center text-[12.5px] text-mut">
            Remembered it?{" "}
            <Link href="/login" className="font-semibold text-acc">
              Sign in
            </Link>
          </p>
        </form>
      ) : (
        <form action={submit} noValidate>
          <fieldset disabled={pending}>
            <CodeField />
            <PasswordField
              label="New password"
              name="password"
              autoComplete="new-password"
              required
              minLength={10}
              hint="At least 10 characters. A short phrase you'll remember beats a scramble you won't."
            />
          </fieldset>
          <Submit pending={pending} label="Set new password" />
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setNotice(null);
              setError(null);
            }}
            className="mt-3 w-full cursor-pointer text-center text-[12px] text-mut hover:text-acc"
          >
            Use a different address
          </button>
        </form>
      )}
    </div>
  );
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-5 w-full cursor-pointer rounded-lg border border-ink bg-ink px-4 py-2.5 text-[13.5px] font-semibold text-paper transition-colors hover:border-ink2 hover:bg-ink2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "One moment…" : label}
    </button>
  );
}
