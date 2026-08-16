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
        <form
          action={submit}
          className="border-b border-ln px-0 py-3"
          // Autofill has nothing to latch onto until the form exists,
          // which is half the reason it only exists once asked for.
        >
          <fieldset disabled={pending} className="flex flex-wrap gap-3">
            <div>
              <label
                htmlFor="currentPassword"
                className="label-xs mb-1 block"
              >
                Current password
              </label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className={`w-[200px] ${inputClass}`}
              />
            </div>

            <div>
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
                className={`w-[200px] ${inputClass}`}
              />
            </div>

            <div className="flex items-end">
              <Button type="submit" variant="primary" size="sm" disabled={pending}>
                {pending ? "Changing…" : "Save"}
              </Button>
            </div>
          </fieldset>

          <p className="mt-2 max-w-[52ch] text-[11px] leading-relaxed text-fai">
            At least 10 characters — length matters more than symbols.
            Changing it signs out every other device, which is the point if
            one of them isn&rsquo;t yours any more.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-2 max-w-[52ch] rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
            >
              {error}
            </p>
          )}
        </form>
      )}
    </>
  );
}
