import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "primary";
type Size = "md" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold cursor-pointer " +
  "rounded-[9px] border transition-colors disabled:opacity-45 disabled:cursor-not-allowed";

const VARIANT: Record<Variant, string> = {
  default:
    "bg-surf border-ln2 text-ink2 hover:border-acc hover:text-acc",
  primary:
    "bg-ink border-ink text-paper hover:bg-ink2 hover:border-ink2",
};

const SIZE: Record<Size, string> = {
  md: "text-[12.5px] px-[13px] py-[7px]",
  sm: "text-[11.5px] px-[10px] py-[5px]",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export default function Button({
  variant = "default",
  size = "md",
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      {...rest}
    />
  );
}
