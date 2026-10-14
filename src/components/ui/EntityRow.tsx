import { ChevronRight } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { cx } from "./cx";

export interface EntityRowProps {
  /** A 40px Avatar or IconRing. */
  leading: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Meta text on the right (date, count). */
  meta?: ReactNode;
  /** Extra content before the meta (a sparkline, a button). */
  trailing?: ReactNode;
  onClick?: () => void;
  /** "card": surface-2 card with a border. "plain": no background. */
  variant?: "card" | "plain";
  /** Show the chevron on hover. Default: true when clickable. */
  chevron?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Entity row: ring on the left, title and subtitle, meta on the right, chevron on hover only. */
export function EntityRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  onClick,
  variant = "card",
  chevron,
  className,
  style,
}: EntityRowProps) {
  const clickable = !!onClick;
  const showChevron = chevron ?? clickable;
  const Tag = clickable ? "button" : "div";
  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={onClick}
      style={style}
      className={cx(
        "group flex w-full min-w-0 items-center gap-3 text-left transition-[background-color,border-color] duration-[120ms]",
        variant === "card" && "rounded-card border border-line bg-surface-2 px-3 py-3",
        variant === "plain" && "rounded-card px-2 py-2",
        clickable && variant === "card" && "hover:border-line-strong hover:bg-surface-3",
        clickable && variant === "plain" && "hover:bg-surface-2",
        className,
      )}
    >
      {leading}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="t-card-title truncate">{title}</span>
        {subtitle ? <span className="t-body truncate text-fg-2">{subtitle}</span> : null}
      </span>
      {trailing}
      {meta ? <span className="t-meta shrink-0 text-right">{meta}</span> : null}
      {showChevron ? (
        <ChevronRight
          size={18}
          strokeWidth={1.5}
          aria-hidden="true"
          className="-ml-1 shrink-0 text-fg-3 opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100"
        />
      ) : null}
    </Tag>
  );
}
