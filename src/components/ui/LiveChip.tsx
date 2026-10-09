import { cx } from "./cx";

/** The "Live" status chip. The live color is used here only. */
export function LiveChip({ label = "Live", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-7 items-center gap-1.5 rounded-chip border border-[color-mix(in_srgb,var(--live)_45%,transparent)] px-2.5 text-[12px] leading-4 font-medium text-live",
        className,
      )}
    >
      <span
        className="block h-1.5 w-1.5 rounded-full bg-live"
        style={{ animation: "privy-pulse 2s ease-in-out infinite" }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
