"use client";

import { useEffect, useRef, useState } from "react";
import { UNTIL_PRESETS, presetFor, type UntilPreset } from "@/lib/until";

/**
 * How long a routine runs for.
 *
 * Only shown once something actually repeats — asking "when does this
 * end?" about a one-off task is a question with no meaning, and a
 * control that greys itself out is still a control you have to read
 * past.
 *
 * The preset and the date go to the server separately rather than being
 * resolved here, because "end of this month" depends on which day the
 * user is on, and the server is the one that knows their timezone.
 */
export default function UntilField({
  name = "until",
  /** The stored end date as "YYYY-MM-DD", or null for open-ended. */
  value,
  /** Today in the user's zone, for matching a stored date to a preset. */
  today,
  disabled,
}: {
  name?: string;
  value: string | null;
  today: string;
  disabled?: boolean;
}) {
  const [preset, setPreset] = useState<UntilPreset>(presetFor(value, today));
  const [date, setDate] = useState(value ?? "");
  const hidden = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // The form around this watches for input events to know it is dirty,
  // and React writing a hidden input fires none.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    hidden.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [preset, date]);

  return (
    <div>
      <input ref={hidden} type="hidden" name={name} value={preset} />

      <div className="flex flex-wrap gap-1">
        {UNTIL_PRESETS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={preset === option.value}
            onClick={() => setPreset(option.value)}
            className={
              "cursor-pointer rounded-md border px-2 py-1 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed " +
              (preset === option.value
                ? "border-acc bg-acc text-on-acc"
                : "border-ln2 text-mut hover:border-acc hover:text-acc")
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {preset === "date" && (
        <input
          type="date"
          name={`${name}Date`}
          value={date}
          disabled={disabled}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          className="field field-sm mt-2 w-full"
        />
      )}

      {preset !== "never" && (
        <p className="mt-1 text-[11px] text-fai">
          It stops appearing after this, and nothing is deleted.
        </p>
      )}
    </div>
  );
}
