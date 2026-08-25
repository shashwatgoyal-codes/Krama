"use client";

import { useState, type InputHTMLAttributes, type ReactNode } from "react";
import Field from "./Field";
import RevealToggle from "@/components/ui/RevealToggle";

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
        <RevealToggle
          shown={shown}
          onToggle={() => setShown((v) => !v)}
          controls={name}
        />
      }
    />
  );
}
