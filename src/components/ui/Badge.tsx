import type { HTMLAttributes } from "react";

type Variant = "default" | "warning" | "danger";

const variantClass: Record<Variant, string> = {
  default:
    "inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200",
  warning:
    "inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200",
  danger:
    "inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-900 ring-1 ring-rose-200",
};

export function Badge({
  variant = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={`${variantClass[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
