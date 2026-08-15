"use client";

import { useId, useState } from "react";

/**
 * The (?) beside a field label. Some of these settings quietly change how
 * every score in the app is calculated, and a setting you don't
 * understand is one you won't touch — so the explanation lives next to
 * the control rather than in documentation nobody opens.
 *
 * A button rather than a title attribute: tooltips are invisible to
 * keyboards and to touch, which is most of the ways this gets read.
 */
export default function Help({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? "Hide help" : "Show help"}
        className={
          "ml-1 inline-grid size-[15px] flex-none cursor-pointer place-items-center " +
          "rounded-full border align-middle text-[9.5px] font-bold leading-none " +
          "transition-colors " +
          (open
            ? "border-acc bg-acc text-on-acc"
            : "border-ln2 text-fai hover:border-acc hover:text-acc")
        }
      >
        ?
      </button>

      {open && (
        <p
          id={id}
          className="mt-1.5 max-w-[52ch] rounded-lg border border-ln bg-surf2 px-2.5 py-2 text-[11.5px] leading-relaxed text-mut"
        >
          {children}
        </p>
      )}
    </>
  );
}
