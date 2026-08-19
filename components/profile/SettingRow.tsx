import Help from "./Help";

/**
 * A settings row as the design draws it: what the setting is on the
 * left, the control on the right, a hairline between each.
 *
 * This is not the same shape as a form field stacked label-over-input,
 * which is what I built first. The difference matters — a settings page
 * is read down the left edge to find the thing you came for, and the
 * controls line up on the right so the eye can skip them until it has.
 */
export default function SettingRow({
  label,
  description,
  help,
  htmlFor,
  children,
}: {
  label: string;
  description?: React.ReactNode;
  /** Longer reasoning, behind a (?) — for rules you can't guess. */
  help?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 border-b border-ln py-3 last:border-b-0">
      <div className="min-w-[190px] flex-1">
        <label
          htmlFor={htmlFor}
          className="block text-[13px] font-semibold text-ink"
        >
          {label}
          {help && <Help>{help}</Help>}
        </label>
        {description && (
          <span className="mt-0.5 block max-w-[46ch] text-[11.5px] leading-[1.4] text-mut">
            {description}
          </span>
        )}
      </div>
      <div className="flex-none">{children}</div>
    </div>
  );
}
