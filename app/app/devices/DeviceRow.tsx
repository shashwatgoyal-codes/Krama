"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/validation";
import type { DeviceRow as Row } from "@/lib/repositories/sessions";

export default function DeviceRow({
  device,
  action,
}: {
  device: Row;
  action: (fd: FormData) => Promise<ActionResult>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-3 border-b border-ln p-3.5 last:border-0">
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

      {/* No control at all on the current row, rather than a disabled one.
          A greyed-out button invites a click that explains a rule; an
          absent one just never raises the question. */}
      {!device.current && (
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
