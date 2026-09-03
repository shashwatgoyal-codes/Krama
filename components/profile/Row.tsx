import Help from "./Help";

/** A labelled control, with the explanation tucked behind the (?). */
export default function Row({
  label,
  htmlFor,
  help,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  help?: React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-[12px] font-semibold text-ink"
      >
        {label}
        {help && <Help>{help}</Help>}
      </label>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] text-fai">{hint}</p>}
    </div>
  );
}

/** The one field style, in app/globals.css. */
export const inputClass = "field";
