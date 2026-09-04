"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useCoarsePointer } from "./pointer";

/**
 * A date field whose popup belongs to the app.
 *
 * The native <input type="date"> is a good control with one problem that
 * cannot be fixed: its calendar is drawn by the browser, outside the
 * page, so it stays a white rectangle on a dark screen no matter what the
 * rest of the app looks like. Matching it to everything else means not
 * using it.
 *
 * What is kept from the native control is the part worth keeping. The
 * real value still travels in an <input>, so forms post exactly as
 * before. Typing still works — the visible field accepts a typed date and
 * the calendar follows it. And on a touch screen the native picker is
 * genuinely better than anything drawn here, so that is what it falls
 * back to: the OS wheel a thumb already knows beats a grid of small
 * targets.
 */

type Props = {
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (iso: string) => void;
  min?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** "2026-09-04" → the Date at UTC midnight, with no zone drift. */
function parse(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(at.getTime()) ? null : at;
}

function iso(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function monthLabel(at: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(at);
}

function readable(isoDate: string): string {
  const at = parse(isoDate);
  if (!at) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(at);
}

/**
 * The days drawn for a month, Monday first, padded to whole weeks.
 *
 * Six rows always, so the popup does not change height as you page
 * through months — a calendar that resizes under the cursor makes you
 * re-find the day you were reaching for.
 */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // Monday = 0
  const start = new Date(Date.UTC(year, month, 1 - lead));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });
}

export default function DateField({
  name,
  defaultValue = "",
  value,
  onChange,
  min,
  required,
  disabled,
  className = "field field-sm",
  id,
}: Props) {
  const controlled = value !== undefined;
  const [own, setOwn] = useState(defaultValue);
  const current = controlled ? value : own;

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [cursor, setCursor] = useState(() => parse(current) ?? new Date());

  const touch = useCoarsePointer();
  const wrap = useRef<HTMLDivElement>(null);
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

  function set(next: string) {
    if (!controlled) setOwn(next);
    onChange?.(next);
    setTyped("");
  }

  function pick(at: Date) {
    set(iso(at));
    setOpen(false);
  }

  if (touch) {
    return (
      <input
        id={id}
        type="date"
        name={name}
        required={required}
        disabled={disabled}
        min={min}
        value={current}
        onChange={(e) => set(e.target.value)}
        className={className}
      />
    );
  }

  const grid = monthGrid(cursor.getUTCFullYear(), cursor.getUTCMonth());
  const today = iso(new Date());
  const shown = typed || readable(current);

  return (
    <div ref={wrap} className="relative">
      {/* The value the form posts. Never the visible text. */}
      <input type="hidden" name={name} value={current} required={required} />

      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={shown}
          placeholder="dd/mm/yyyy"
          role="combobox"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popupId : undefined}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setTyped(e.target.value);
            // Accept what a person types, in the order they'd type it.
            const m = e.target.value.match(
              /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{4})$/,
            );
            if (m) {
              const [, d, mo, y] = m;
              const next = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
              if (parse(next)) {
                set(next);
                setCursor(parse(next)!);
              }
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setOpen(false);
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
            }
          }}
          className={`${className} pr-[30px]`}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Close the calendar" : "Open the calendar"}
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="absolute inset-y-0 right-0 grid w-[28px] cursor-pointer place-items-center text-mut transition-colors hover:text-ink disabled:opacity-50"
        >
          <CalendarGlyph />
        </button>
      </div>

      {open && (
        <div
          id={popupId}
          role="dialog"
          aria-label="Choose a date"
          className="glass absolute left-0 top-full z-50 mt-1.5 w-[248px] rounded-[10px] p-2.5"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-ink">
              {monthLabel(cursor)}
            </span>
            <div className="flex gap-0.5">
              <Step
                label="Previous month"
                onClick={() =>
                  setCursor(
                    new Date(
                      Date.UTC(
                        cursor.getUTCFullYear(),
                        cursor.getUTCMonth() - 1,
                        1,
                      ),
                    ),
                  )
                }
              >
                &#8593;
              </Step>
              <Step
                label="Next month"
                onClick={() =>
                  setCursor(
                    new Date(
                      Date.UTC(
                        cursor.getUTCFullYear(),
                        cursor.getUTCMonth() + 1,
                        1,
                      ),
                    ),
                  )
                }
              >
                &#8595;
              </Step>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-y-0.5">
            {WEEKDAYS.map((d, i) => (
              <span
                key={i}
                aria-hidden="true"
                className="grid h-[22px] place-items-center text-[10px] font-medium text-fai"
              >
                {d}
              </span>
            ))}

            {grid.map((at) => {
              const key = iso(at);
              const inMonth = at.getUTCMonth() === cursor.getUTCMonth();
              const isToday = key === today;
              const chosen = key === current;
              const blocked = min !== undefined && key < min;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={blocked}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={chosen}
                  onClick={() => pick(at)}
                  className={
                    "grid h-[26px] cursor-pointer place-items-center rounded-[6px] text-[11.5px] transition-colors " +
                    (chosen
                      ? "bg-acc font-semibold text-on-acc "
                      : inMonth
                        ? "text-ink hover:bg-acc-soft "
                        : "text-fai hover:bg-acc-soft ") +
                    (isToday && !chosen ? "font-semibold text-acc " : "") +
                    "disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  }
                >
                  {at.getUTCDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-ln pt-2">
            <button
              type="button"
              onClick={() => {
                set("");
                setOpen(false);
              }}
              className="cursor-pointer text-[11.5px] font-medium text-mut transition-colors hover:text-bad"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => pick(new Date())}
              className="cursor-pointer text-[11.5px] font-medium text-acc transition-opacity hover:opacity-80"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-[22px] cursor-pointer place-items-center rounded-[6px] text-[12px] text-mut transition-colors hover:bg-acc-soft hover:text-ink"
    >
      {children}
    </button>
  );
}

function CalendarGlyph() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="3.5"
        width="12"
        height="10.5"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M2 6.5h12M5.5 2v3M10.5 2v3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
