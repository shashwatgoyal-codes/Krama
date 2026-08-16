"use client";

import { useId } from "react";

/**
 * The (?) beside a setting that carries a rule you can't guess.
 *
 * A hover tooltip, as drawn: a dark card that floats over the layout
 * rather than a panel that pushes it around. Opening a help note should
 * not move the control you were about to use.
 *
 * Shown on hover *and* on focus. Hover alone would make every one of
 * these invisible to a keyboard, and the settings pages are exactly
 * where the un-guessable rules live — the day boundary, the daily cap,
 * the backdating limit. There is no click handler and no state; the
 * whole thing is CSS, which is also why it costs nothing to render.
 */
export default function Help({ children }: { children: React.ReactNode }) {
  const id = useId();

  return (
    <span className="group relative inline-block align-middle">
      <button
        type="button"
        aria-describedby={id}
        aria-label="What this means"
        // cursor-help rather than pointer: there is nothing to click,
        // and a pointer would promise an action that never comes.
        className="ml-1.5 inline-grid size-[15px] cursor-help place-items-center rounded-full border border-ln2 text-[9.5px] font-bold leading-none text-fai transition-colors group-hover:border-acc group-hover:text-acc focus-visible:border-acc focus-visible:text-acc focus-visible:outline-none"
      >
        ?
      </button>

      <span
        id={id}
        role="tooltip"
        // invisible + opacity rather than hidden, so the text stays in
        // the accessibility tree for aria-describedby to point at.
        className="pointer-events-none invisible absolute left-[-8px] top-[24px] z-20 w-[255px] rounded-lg bg-ink px-3 py-2.5 text-[11.5px] font-normal normal-case leading-[1.5] tracking-normal text-paper opacity-0 shadow-[0_8px_26px_rgba(0,0,0,0.3)] transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {/* The little arrow, as in the design. */}
        <span
          aria-hidden
          className="absolute left-3 top-[-4px] size-[9px] rotate-45 rounded-[1px] bg-ink"
        />
        {children}
      </span>
    </span>
  );
}
