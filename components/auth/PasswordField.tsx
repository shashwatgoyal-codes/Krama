"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import Field from "./Field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label: string;
  name: string;
  hint?: ReactNode;
  action?: ReactNode;
};

/**
 * A password box you can look at.
 *
 * Worth having because the alternative to seeing what you typed is
 * typing it again, and on a phone keyboard that is where people give up
 * and reach for the reset link — which costs an email and a five-minute
 * detour to fix a mistyped character.
 *
 * It starts hidden, and nothing here remembers the choice between
 * fields or between visits: revealing a password is a decision about
 * this moment and who is behind you, not a preference.
 */
export default function PasswordField({ name, ...rest }: Props) {
  const [shown, setShown] = useState(false);

  return (
    <Field
      {...rest}
      name={name}
      type={shown ? "text" : "password"}
      trailing={
        <button
          type="button" // never "submit" — it lives inside a form
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Hide password" : "Show password"}
          aria-pressed={shown}
          aria-controls={name}
          className={
            // text-mut, not text-fai: the faint token measures 2.76:1
            // against the input, under the 3:1 that a control someone
            // has to find and click is held to.
            "grid size-[26px] place-items-center rounded-md text-mut " +
            "transition-colors hover:bg-surf2 hover:text-ink " +
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-acc-soft"
          }
        >
          {shown ? <EyeOff /> : <Eye />}
        </button>
      }
    />
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
