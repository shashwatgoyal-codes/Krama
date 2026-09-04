"use client";

import { useState, type InputHTMLAttributes } from "react";
import RevealToggle from "./RevealToggle";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  id: string;
};

/**
 * A bare password input with a reveal control, for the screens that
 * style their own inputs rather than going through the auth Field.
 *
 * Starts hidden and persists nothing — revealing a password is a
 * decision about this moment and who is behind you, not a preference.
 */
export default function PasswordInput({ id, className = "", ...rest }: Props) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={shown ? "text" : "password"}
        // Room for the control, so a long value scrolls under it rather
        // than sitting behind it.
        className={`${className} pr-[38px]`}
        {...rest}
      />
      <span className="absolute inset-y-0 right-0 flex items-center pr-1.5">
        <RevealToggle
          shown={shown}
          onToggle={() => setShown((v) => !v)}
          controls={id}
        />
      </span>
    </div>
  );
}
