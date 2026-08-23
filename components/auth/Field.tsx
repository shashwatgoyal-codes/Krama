import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: ReactNode;
  /** Sits beside the label, e.g. the "Forgot?" link. */
  action?: ReactNode;
  /** Sits inside the input's right edge, e.g. the show-password toggle. */
  trailing?: ReactNode;
};

export default function Field({
  label,
  name,
  hint,
  action,
  trailing,
  className = "",
  ...rest
}: Props) {
  return (
    <div className="mt-4">
      <label
        htmlFor={name}
        className="mb-1.5 flex items-center gap-2 text-[12px] font-semibold text-ink2"
      >
        {label}
        {action && <span className="ml-auto">{action}</span>}
      </label>

      {/* Relative only so `trailing` has something to sit against. The
          input keeps its own padding-right in that case, so a long value
          scrolls under the control instead of behind it. */}
      <div className="relative">
        <input
          id={name}
          name={name}
          className={
            "w-full rounded-lg border border-ln2 bg-surf px-[11px] py-[9px] text-[13px] " +
            "text-ink placeholder:text-fai focus:border-acc focus:outline-none " +
            "focus:ring-[3px] focus:ring-acc-soft " +
            (trailing ? "pr-[38px] " : "") +
            className
          }
          {...rest}
        />
        {trailing && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-1.5">
            {trailing}
          </span>
        )}
      </div>

      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-fai">{hint}</p>}
    </div>
  );
}
