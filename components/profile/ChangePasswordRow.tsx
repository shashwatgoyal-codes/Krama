"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import SettingRow from "./SettingRow";
import { inputClass } from "./Row";
import { changePassword } from "@/app/app/profile/actions";

/**
 * A row that says when the password last changed, and a button that
 * opens the form — not two password fields sitting open on a settings
 * page you visited to change something else.
 *
 * That is what the design draws, and it is also the better behaviour:
 * a permanently visible current-password field invites password
 * managers to fill it on every visit, which trains people to ignore it.
 */
export default function ChangePasswordRow({
  lastChanged,
}: {
  lastChanged: string;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await changePassword(formData);
      if (result.ok) {
        setOpen(false);
        setDone(true);
        setTimeout(() => setDone(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      <SettingRow
        label="Password"
        description={
          done ? (
            <span className="font-semibold text-ok">
              Changed. Every other device has been signed out.
            </span>
          ) : (
            lastChanged
          )
        }
      >
        <Button type="button" size="sm" onClick={() => setOpen((v) => !v)}>
          {open ? "Cancel" : "Change password"}
        </Button>
      </SettingRow>

      {open && (
        <form action={submit}>
          <fieldset disabled={pending}>
            {/* The revealed fields use the same row shape as everything
                else on the page. Two inputs crammed side by side read as
                a different kind of thing than the settings above them,
                which is exactly what they are not. */}
            <SettingRow label="Current password" htmlFor="currentPassword">
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className={`w-[220px] ${inputClass}`}
              />
            </SettingRow>

            <SettingRow
              label="New password"
              description="At least 10 characters. Length matters more than symbols — a short phrase you'll remember beats a scramble you won't."
              htmlFor="newPassword"
            >
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={`w-[220px] ${inputClass}`}
              />
            </SettingRow>
          </fieldset>

          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
            >
              {error}
            </p>
          )}

          <div className="mt-3 flex items-center justify-end gap-2.5">
            <span className="text-[11px] text-fai">
              Signs out every other device.
            </span>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Changing…" : "Save new password"}
            </Button>
          </div>
        </form>
      )}
    </>
  );
}
