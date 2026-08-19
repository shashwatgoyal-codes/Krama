"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Which days of the week a routine runs on.
 *
 * Toggles rather than a dropdown because the useful answers are sets,
 * not single days: "every day except Sunday" is six taps here and is
 * simply not sayable with a picker that offers one weekday. The two
 * shapes people reach for most get a shortcut so they are one tap
 * rather than five.
 */

const DAYS = [
  { value: 1, label: "M", full: "Monday" },
  { value: 2, label: "T", full: "Tuesday" },
  { value: 3, label: "W", full: "Wednesday" },
  { value: 4, label: "T", full: "Thursday" },
  { value: 5, label: "F", full: "Friday" },
  { value: 6, label: "S", full: "Saturday" },
  { value: 0, label: "S", full: "Sunday" },
];

const SHORTCUTS = [
  { label: "Weekdays", days: [1, 2, 3, 4, 5] },
  { label: "Every day", days: [0, 1, 2, 3, 4, 5, 6] },
  { label: "Except Sunday", days: [1, 2, 3, 4, 5, 6] },
];

export default function WeekdayPicker({
  name = "recurrenceDays",
  selected,
  disabled,
}: {
  name?: string;
  selected: number[];
  disabled?: boolean;
}) {
  const [days, setDays] = useState<number[]>(selected);
  const hidden = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // React writing a hidden input fires no native event, so the form
  // around this would never learn it had changed.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    hidden.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [days]);

  function toggle(day: number) {
    setDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day].sort(),
    );
  }

  const matches = (preset: number[]) =>
    preset.length === days.length && preset.every((d) => days.includes(d));

  return (
    <div>
      <input
        ref={hidden}
        type="hidden"
        name={name}
        value={[...days].sort().join(",")}
      />

      <div className="flex flex-wrap gap-1">
        {DAYS.map((day) => (
          <button
            key={day.value}
            type="button"
            disabled={disabled}
            aria-label={day.full}
            aria-pressed={days.includes(day.value)}
            onClick={() => toggle(day.value)}
            className={
              "size-7 cursor-pointer rounded-md border text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed " +
              (days.includes(day.value)
                ? "border-acc bg-acc text-on-acc"
                : "border-ln2 text-mut hover:border-acc hover:text-acc")
            }
          >
            {day.label}
          </button>
        ))}
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {SHORTCUTS.map((shortcut) => (
          <button
            key={shortcut.label}
            type="button"
            disabled={disabled}
            onClick={() => setDays([...shortcut.days].sort())}
            className={
              "cursor-pointer rounded-full border px-2 py-0.5 text-[10.5px] font-semibold transition-colors disabled:cursor-not-allowed " +
              (matches(shortcut.days)
                ? "border-acc text-acc"
                : "border-ln2 text-fai hover:border-acc hover:text-acc")
            }
          >
            {shortcut.label}
          </button>
        ))}
      </div>

      {days.length === 0 && (
        <p className="mt-1 text-[11px] text-bad">
          Pick at least one day, or it never runs.
        </p>
      )}
    </div>
  );
}
