"use client";

import { useState } from "react";

/**
 * The − value + control the design uses for every bounded number.
 *
 * A stepper rather than a text box because each of these has a small,
 * meaningful range: nudging a daily minimum from 3 to 4 is a decision,
 * and typing 400 into it isn't. The real value rides in a hidden input
 * so the form still posts a plain number.
 */
export type StepperFormat = "plain" | "hour" | "days";

function render(value: number, format: StepperFormat): string {
  if (format === "hour") return `${String(value).padStart(2, "0")}:00`;
  if (format === "days") return `${value} ${value === 1 ? "day" : "days"}`;
  return String(value);
}

export default function Stepper({
  name,
  defaultValue,
  min,
  max,
  step = 1,
  format = "plain",
  disabled,
}: {
  name: string;
  defaultValue: number;
  min: number;
  max: number;
  step?: number;
  /**
   * How to render the number, by name rather than by function.
   *
   * A formatter callback cannot cross the server-to-client boundary —
   * React refuses to serialise functions, and the page 500s at request
   * time while the build, the types and the linter all stay quiet. So
   * the caller names a format and the formatting happens over here.
   */
  format?: StepperFormat;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);

  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  const shown = render(value, format);

  return (
    <div className="flex items-center gap-2">
      <input type="hidden" name={name} value={value} />

      <Nudge
        label={`Decrease ${name}`}
        disabled={disabled || value <= min}
        onClick={() => setValue((v) => clamp(v - step))}
      >
        −
      </Nudge>

      {/* aria-live so a screen reader hears the new value, since the
          buttons themselves don't change their own labels. */}
      <span
        aria-live="polite"
        className="tabular min-w-[58px] text-center text-[13.5px] font-bold text-ink"
      >
        {shown}
      </span>

      <Nudge
        label={`Increase ${name}`}
        disabled={disabled || value >= max}
        onClick={() => setValue((v) => clamp(v + step))}
      >
        +
      </Nudge>
    </div>
  );
}

function Nudge({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-[26px] w-8 flex-none cursor-pointer place-items-center rounded-md border border-ln2 text-[14px] font-semibold text-mut transition-colors hover:border-acc hover:text-acc disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
