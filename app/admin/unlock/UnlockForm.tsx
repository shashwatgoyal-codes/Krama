"use client";

import { useState, useTransition } from "react";
import { unlock } from "./actions";
import PasswordField from "@/components/auth/PasswordField";

export default function UnlockForm({ next, email }: { next: string; email: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const result = await unlock(fd);
          if (result && !result.ok) setError(result.error);
        })
      }
      className="mt-5"
    >
      <input type="hidden" name="next" value={next} />
      {/* Present so a password manager knows which entry to offer. */}
      <input type="hidden" name="email" value={email} autoComplete="username" />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        required
        autoFocus
      />
      {error && <p className="mt-2 text-[12px] text-bad">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 w-full rounded-lg bg-ink px-3 py-2 text-[12.5px] font-semibold text-paper disabled:opacity-60"
      >
        {pending ? "Checking…" : "Unlock the portal"}
      </button>
      <a href="/app" className="mt-3 block text-center text-[12px] font-medium text-mut">
        Back to Krama
      </a>
    </form>
  );
}
