"use client";

import { useState, useTransition } from "react";
import CodeField from "./CodeField";
import Button from "@/components/ui/Button";
import { sendVerification, verifyEmail } from "@/app/app/verify-email/actions";

export default function VerifyEmailForm({
  email,
  autoSent,
}: {
  email: string;
  autoSent: boolean;
}) {
  const [notice, setNotice] = useState<string | null>(
    autoSent ? `A code is on its way to ${email}.` : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function resend() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await sendVerification();
      if (result.ok) setNotice(`A new code is on its way to ${email}.`);
      else setError(result.error);
    });
  }

  function submit(formData: FormData) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await verifyEmail(formData);
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  if (done) {
    return (
      <div className="rounded-xl border border-ok bg-ok-soft px-4 py-5 text-center">
        <p className="font-display text-[15px] font-semibold text-ink">
          Email confirmed
        </p>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-mut">
          {email} is yours. You can get back to work.
        </p>
      </div>
    );
  }

  return (
    <div>
      {notice && (
        <p className="mb-1 rounded-lg border border-ok bg-ok-soft px-3 py-2.5 text-[12.5px] leading-snug text-ink">
          {notice}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mb-1 rounded-lg border border-bad bg-bad-soft px-3 py-2.5 text-[12.5px] leading-snug text-ink"
        >
          {error}
        </p>
      )}

      <form action={submit} noValidate>
        <fieldset disabled={pending}>
          <CodeField />
        </fieldset>

        <div className="mt-5 flex flex-wrap items-center gap-2.5">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "One moment…" : "Confirm email"}
          </Button>
          <Button type="button" onClick={resend} disabled={pending}>
            Send another
          </Button>
        </div>
      </form>
    </div>
  );
}
