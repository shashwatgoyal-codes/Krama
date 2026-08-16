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
        <Button
          type="button"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Cancel" : "Change password"}
        </Button>
      </SettingRow>

      {open && (
        // A contained card rather than three more rows in the flat list.
        // The two fields and their button are one task, and a settings
        // page that lays them out like unrelated settings makes you hunt
        // for where the task ends.
        <form
          action={submit}
          className="mb-3 rounded-lg border border-ln bg-surf2 p-3"
        >
          <fieldset disabled={pending} className="flex flex-wrap gap-3">
            <div className="min-w-[180px] flex-1">
              <label htmlFor="currentPassword" className="label-xs mb-1 block">
                Current password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className={inputClass}
              />
            </div>

            <div className="min-w-[180px] flex-1">
              <label htmlFor="newPassword" className="label-xs mb-1 block">
                New password
              </label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                required
                minLength={10}
                autoComplete="new-password"
                className={inputClass}
              />
            </div>
          </fieldset>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-[38ch] text-[11px] leading-relaxed text-fai">
              At least 10 characters. Saving signs out every other device.
            </p>
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              {pending ? "Changing…" : "Save new password"}
            </Button>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-2 rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
            >
              {error}
            </p>
          )}
        </form>
      )}
    </>
  );
}
