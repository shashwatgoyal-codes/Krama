"use client";

/**
 * The show/hide control that sits inside a password box.
 *
 * One implementation, used by the auth screens and the profile screens,
 * because the details worth getting right are the same in both places
 * and are easy to get wrong twice:
 *
 *   - type="button". Inside a form the default is submit, and the first
 *     click would try to sign you in with half a password typed.
 *   - The label changes with the state, so it is not a mystery icon to
 *     someone who cannot see which glyph is showing.
 *   - text-mut rather than text-fai, which measures 2.76:1 against a
 *     white input — under the 3:1 a control you have to find and click
 *     is held to.
 */
export default function RevealToggle({
  shown,
  onToggle,
  controls,
}: {
  shown: boolean;
  onToggle: () => void;
  /** id of the input this reveals, for aria-controls. */
  controls: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      aria-pressed={shown}
      aria-controls={controls}
      className={
        "grid size-[26px] place-items-center rounded-md text-mut " +
        "transition-colors hover:bg-surf2 hover:text-ink " +
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-soft"
      }
    >
      {shown ? <EyeOff /> : <Eye />}
    </button>
  );
}

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function Eye() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.9" />
    </svg>
  );
}

function EyeOff() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" {...stroke}>
      <path d="M9.9 5.7A9.7 9.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17.6 17.6 0 0 1-3.4 4.2M6.2 6.3A17.4 17.4 0 0 0 2 12s3.6 6.5 10 6.5a9.9 9.9 0 0 0 4-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="M3 3l18 18" />
    </svg>
  );
}
