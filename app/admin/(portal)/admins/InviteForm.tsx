"use client";

import { useState, useTransition } from "react";
import { inviteAdmin } from "./actions";

/**
 * The invitation link is shown once, here, and never again.
 *
 * Only the token's hash is stored, so there is nothing to show later —
 * the same reason a password manager makes you copy an API key at the
 * moment you create it. It is shown at all because Resend will not
 * deliver to an unverified domain yet, so the email may never arrive and
 * the link would otherwise be unreachable.
 */
export default function InviteForm() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; url: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  return (
    <form
      action={(fd) =>
        start(async () => {
          setError(null);
          const result = await inviteAdmin(fd);
          if (!result.ok || !result.data) {
            setError(
              result.ok
                ? "The invitation was created but its link came back empty. Withdraw it and try again."
                : result.error,
            );
            setIssued(null);
            return;
          }
          const { email, token } = result.data;
          setIssued({
            email,
            url: `${window.location.origin}/invite/${token}`,
          });
          setCopied(false);
        })
      }
      className="rounded-xl border border-ln bg-surf p-4"
    >
      <h2 className="label-xs text-mut">Invite an admin</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="their@email.com"
          className="field min-w-[220px] flex-1"
        />
        <input
          name="reason"
          required
          minLength={3}
          placeholder="Why — this goes in the audit log"
          className="field min-w-[240px] flex-[2]"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-ink px-3 py-[7px] text-[12.5px] font-semibold text-paper disabled:opacity-60"
        >
          {pending ? "Inviting…" : "Invite"}
        </button>
      </div>

      <p className="mt-2 text-[11px] text-fai">
        They get Admin — able to act on standard accounts, not on other admins.
        The link lasts 7 days.
      </p>

      {error && <p className="mt-2 text-[12px] text-bad">{error}</p>}

      {issued && (
        <div className="mt-3 rounded-lg border border-ok bg-ok-soft p-3">
          <p className="text-[12px] font-semibold text-ok">
            Invitation created for {issued.email}
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-mut">
            Copy this link now — only its hash is stored, so it cannot be shown
            again. If you lose it, withdraw the invitation and send another.
          </p>
          <div className="mt-2 flex gap-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap rounded border border-ln bg-surf px-2 py-1.5 font-mono text-[10.5px]">
              {issued.url}
            </code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(issued.url);
                setCopied(true);
              }}
              className="flex-none rounded border border-ln2 px-2.5 py-1.5 text-[11.5px] font-semibold"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
