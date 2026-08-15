import type { InputHTMLAttributes, ReactNode } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  name: string;
  hint?: ReactNode;
  action?: ReactNode;
};

export default function Field({
  label,
  name,
  hint,
  action,
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
      <input
        id={name}
        name={name}
        className={
          "w-full rounded-lg border border-ln2 bg-surf px-[11px] py-[9px] text-[13px] " +
          "text-ink placeholder:text-fai focus:border-acc focus:outline-none " +
          "focus:ring-[3px] focus:ring-acc-soft " +
          className
        }
        {...rest}
      />
      {hint && <p className="mt-1.5 text-[11.5px] leading-snug text-fai">{hint}</p>}
    </div>
  );
}
