import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "primary" is orange: use it for the one primary action on a screen. */
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-orange text-[var(--on-orange)] hover:brightness-110 active:brightness-95",
  secondary: "border border-line bg-surface-2 text-fg-1 hover:bg-surface-3 hover:border-line-strong",
  ghost: "text-fg-2 hover:bg-surface-2 hover:text-fg-1",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-[14px]",
  lg: "h-12 gap-2 px-5 text-[15px]",
};

/** Buttons are radius 10, never pill-shaped (DESIGN.md section 3). */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconRight, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-button leading-none font-semibold whitespace-nowrap transition-[background-color,border-color,color,filter] duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
});
