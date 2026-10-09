import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cx } from "./cx";

export interface DeltaChipProps {
  /** A number (12 shows as "+12") or a ready string ("+8.4%"). */
  value: number | string;
  /** Default: from the sign of `value`. */
  direction?: "up" | "down";
  className?: string;
}

/** A change value in the up or down color. Deltas only. */
export function DeltaChip({ value, direction, className }: DeltaChipProps) {
  const str = typeof value === "number" ? `${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}` : value;
  const dir = direction ?? (str.trim().startsWith("-") || str.trim().startsWith("−") ? "down" : "up");
  const Icon = dir === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-0.5 rounded-chip px-1.5 text-[12px] leading-4 font-semibold tabular-nums",
        dir === "up" ? "bg-[var(--up-soft)] text-up" : "bg-[var(--down-soft)] text-down",
        className,
      )}
    >
      <Icon size={14} strokeWidth={2} aria-hidden="true" />
      {str}
    </span>
  );
}
