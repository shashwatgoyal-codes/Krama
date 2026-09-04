"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useCoarsePointer } from "./pointer";
import { clockLabel, type TimeFormat } from "@/lib/time";

/**
 * A time field whose popup belongs to the app.
 *
 * Same reasoning as DateField: the native control's dropdown is drawn by
 * the browser and cannot be themed, so it stays a white column of numbers
 * on a dark screen. And the native one offers minute precision that no
 * routine has ever needed — half hours are the only answers anyone gives.
 *
 * The stored value stays "HH:MM" in 24-hour form, whatever clock the
 * reader has chosen. That is what the server parses and what every other
 * time is compared against; only the labels follow the setting.
 */

type Props = {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (hhmm: string) => void;
  timeFormat?: TimeFormat;
  /** Minutes between options. Half hours by default. */
  step?: number;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  id?: string;
  /** Offered when the field may legitimately hold nothing. */
  clearable?: boolean;
};

/** "09:30" → 570. Null when it isn't a time. */
export function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 570 → "09:30", always 24-hour: this is the stored form. */
export function toValue(minutes: number): string {
  const safe = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(
    safe % 60,
  ).padStart(2, "0")}`;
}

export default function TimeField({
  name,
  defaultValue = "",
  value,
  onChange,
  timeFormat = "24",
  step = 30,
  disabled,
  required,
  className = "field field-sm",
  id,
  clearable = false,
}: Props) {
  const controlled = value !== undefined;
  const [own, setOwn] = useState(defaultValue);
  const current = controlled ? value : own;

  const [open, setOpen] = useState(false);
  const touch = useCoarsePointer();
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const popupId = useId();

  useEffect(() => {
    if (!open) return;
    function away(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  // Open on the time already chosen rather than at midnight, so the
  // list starts where the answer probably is.
  useEffect(() => {
    if (!open || !list.current) return;
    const chosen = list.current.querySelector('[data-chosen="true"]');
    chosen?.scrollIntoView({ block: "center" });
  }, [open]);

  function set(next: string) {
    if (!controlled) setOwn(next);
    onChange?.(next);
  }

  if (touch) {
    return (
      <input
        id={id}
        type="time"
        name={name}
        required={required}
        disabled={disabled}
        value={current}
        onChange={(e) => set(e.target.value)}
        className={className}
      />
    );
  }

  const options = Array.from({ length: Math.floor(1440 / step) }, (_, i) =>
    toValue(i * step),
  );
  const minutes = toMinutes(current);
  const shown = minutes === null ? "" : clockLabel(minutes, timeFormat);

  return (
    <div ref={wrap} className="relative">
      <input type="hidden" name={name} value={current} required={required} />

      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={`${className} flex cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed`}
      >
        <span className={shown ? "text-ink" : "text-fai"}>
          {shown || (clearable ? "Off" : "--:--")}
        </span>
        <ClockGlyph />
      </button>

      {open && (
        <div
          id={popupId}
          role="listbox"
          aria-label="Choose a time"
          ref={list}
          className="glass absolute left-0 top-full z-50 mt-1.5 max-h-[220px] w-[132px] overflow-y-auto rounded-[10px] p-1"
        >
          {clearable && (
            <button
              type="button"
              role="option"
              aria-selected={current === ""}
              onClick={() => {
                set("");
                setOpen(false);
              }}
              className={
                "block w-full cursor-pointer rounded-[6px] px-2.5 py-1.5 text-left text-[12px] transition-colors " +
                (current === ""
                  ? "bg-acc font-semibold text-on-acc"
                  : "text-mut hover:bg-acc-soft hover:text-ink")
              }
            >
              Off
            </button>
          )}

          {options.map((o) => {
            const chosen = o === current;
            return (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={chosen}
                data-chosen={chosen}
                onClick={() => {
                  set(o);
                  setOpen(false);
                }}
                className={
                  "block w-full cursor-pointer rounded-[6px] px-2.5 py-1.5 text-left text-[12px] tabular transition-colors " +
                  (chosen
                    ? "bg-acc font-semibold text-on-acc"
                    : "text-ink hover:bg-acc-soft")
                }
              >
                {clockLabel(toMinutes(o)!, timeFormat)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ClockGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="flex-none text-mut"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 4.8V8l2.2 1.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
