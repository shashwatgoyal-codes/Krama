"use client";

import { useSyncExternalStore } from "react";

/**
 * Light / Dark / System, as the design draws it.
 *
 * Theme is the one setting that cannot live on the server: it has to be
 * applied before first paint or the page flashes the wrong colours, so
 * it is written to localStorage and stamped onto <html> by the inline
 * script in the root layout. This control edits that same value.
 *
 * Read with useSyncExternalStore rather than an effect that calls
 * setState. localStorage genuinely is an external store, and reading it
 * this way gives React a server snapshot to render first — which is what
 * stops the control flipping under the user on hydration.
 *
 * "System" removes the attribute entirely rather than resolving it to a
 * colour, so the OS stays in charge and a later change to it is followed
 * without reopening the app.
 */

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
] as const;

const KEY = "krama-theme";
const EVENT = "krama-theme-change";

function subscribe(onChange: () => void): () => void {
  // `storage` covers other tabs; the custom event covers this one, which
  // storage deliberately does not fire for.
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

function readTheme(): string {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** The server can't know, and guessing would flip on hydration. */
const serverTheme = () => "system";

export default function ThemePicker() {
  const choice = useSyncExternalStore(subscribe, readTheme, serverTheme);

  function pick(value: string) {
    try {
      if (value === "system") {
        localStorage.removeItem(KEY);
        document.documentElement.removeAttribute("data-theme");
      } else {
        localStorage.setItem(KEY, value);
        document.documentElement.setAttribute("data-theme", value);
      }
      window.dispatchEvent(new Event(EVENT));
    } catch {
      // Private browsing with storage denied: the attribute still
      // changes, the choice just won't survive a reload.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex overflow-hidden rounded-[7px] border border-ln2"
    >
      {OPTIONS.map((option, index) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={choice === option.value}
          onClick={() => pick(option.value)}
          className={
            "cursor-pointer px-2.5 py-[5px] text-[11.5px] font-semibold transition-colors " +
            (index > 0 ? "border-l border-ln2 " : "") +
            (choice === option.value
              ? "bg-acc text-on-acc"
              : "text-mut hover:text-acc")
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
