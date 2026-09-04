"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/validation";
import type { DeviceRow as Row } from "@/lib/repositories/sessions";
import { useToast } from "@/components/ui/Toast";
import DeviceIcon from "@/components/DeviceIcon";

export default function DeviceRow({
  device,
  action,
  signOutThis,
}: {
  device: Row;
  action: (fd: FormData) => Promise<ActionResult>;
  /** Only passed for the row you are reading this on. */
  signOutThis?: () => Promise<void>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();

  return (
    <div className="flex items-center gap-3 border-b border-ln p-3.5 last:border-0">
      <span className="flex-none text-mut" title={device.kind}>
        <DeviceIcon kind={device.kind} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold">
          {device.label}
          {device.current && (
            <span className="ml-2 rounded border border-ok bg-ok-soft px-[5px] py-0.5 text-[10px] font-semibold text-ok">
              This device
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[11.5px] text-mut">
          Signed in {device.signedInAt.toISOString().slice(0, 10)} ·{" "}
          {device.lastSeen}
        </p>
        {error && <p className="mt-1 text-[11px] text-bad">{error}</p>}
      </div>

      {device.current ? (
        /*
         * The current row gets a real control now.
         *
         * It used to have none, on the reasoning that signing yourself
         * out from a list of devices reads like the app breaking. But
         * the only alternative was "sign out everywhere", which also
         * ends your phone and your other laptop — a hammer for a job
         * that wanted a hand. So: the same button, doing the ordinary
         * sign-out, worded so it is clear which one goes.
         */
        <form action={signOutThis} className="flex-none">
          <button
            type="submit"
            className="rounded-md border border-ln2 px-2.5 py-1 text-[11.5px] font-semibold text-mut transition-colors hover:border-ink hover:text-ink"
          >
            Sign out here
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const fd = new FormData();
              fd.set("id", device.id);
              const result = await action(fd);
              if (!result.ok) setError(result.error);
              else toast.success(`Signed out of ${device.label}.`);
            })
          }
          className="flex-none rounded-md border border-ln2 px-2.5 py-1 text-[11.5px] font-semibold text-mut transition-colors hover:border-bad hover:text-bad disabled:opacity-50"
        >
          {pending ? "…" : "Sign out"}
        </button>
      )}
    </div>
  );
}
