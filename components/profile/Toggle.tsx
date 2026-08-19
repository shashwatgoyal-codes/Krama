"use client";

import { useState } from "react";

/**
 * The sliding switch the design uses for every on/off setting.
 *
 * A checkbox underneath rather than a div with a click handler, so it is
 * focusable, toggles with the space bar and announces its state — all of
 * which a styled div has to reimplement badly. The visible track is
 * drawn from the checkbox's own :checked state.
 */
export default function Toggle({
  name,
  defaultChecked,
  label,
}: {
  name: string;
  defaultChecked: boolean;
  label: string;
}) {
  const [on, setOn] = useState(defaultChecked);

  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        name={name}
        checked={on}
        onChange={(e) => setOn(e.target.checked)}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={
          "relative h-[21px] w-9 flex-none rounded-full transition-colors " +
          "peer-focus-visible:ring-[3px] peer-focus-visible:ring-acc-soft " +
          (on ? "bg-acc" : "bg-ln2")
        }
      >
        <span
          className={
            "absolute top-[2.5px] size-4 rounded-full bg-surf shadow-sm transition-[left] " +
            (on ? "left-[18px]" : "left-[2.5px]")
          }
        />
      </span>
      <span className="text-[11.5px] font-semibold text-mut">
        {on ? "On" : "Off"}
      </span>
    </label>
  );
}
