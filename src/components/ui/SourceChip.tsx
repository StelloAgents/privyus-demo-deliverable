import type { SourceKind } from "@/lib/types";
import { cx } from "./cx";

export interface SourceChipProps {
  /** FARA chips are lavender; every other source is teal. */
  kind: SourceKind;
  /** Chip text, for example "LDA Q1 2026" or "FARA #6843". */
  label: string;
  /** Opens the source drawer. */
  onClick?: () => void;
  className?: string;
}

/** Source chip: radius 8, 1px border in the source color, 12px text. */
export function SourceChip({ kind, label, onClick, className }: SourceChipProps) {
  const fara = kind === "FARA";
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx(
        "inline-flex h-7 shrink-0 items-center rounded-chip border px-2.5 text-[12px] leading-4 font-medium whitespace-nowrap transition-[background-color] duration-[120ms]",
        fara
          ? "border-lavender text-lavender hover:bg-[var(--lavender-soft)]"
          : "border-teal text-teal-bright hover:bg-[var(--teal-soft)]",
        className,
      )}
    >
      {label}
    </Tag>
  );
}

/** A short chip label for a source kind, when the data gives no label. */
export function sourceKindLabel(kind: SourceKind): string {
  const map: Record<SourceKind, string> = {
    FARA: "FARA",
    LDA: "LDA",
    FEC: "FEC",
    CONGRESS: "congress.gov",
    DISCLOSURE: "Disclosure",
    TRAVEL: "Travel filing",
    STATEMENT: "Statement",
  };
  return map[kind];
}
