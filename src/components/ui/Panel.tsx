import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";

export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Shown on the right of the title row. */
  action?: ReactNode;
  /** A 1px line under the title row. */
  divider?: boolean;
  /** Class for the body wrapper. */
  bodyClassName?: string;
  /** Remove the 24px padding (for edge-to-edge content such as a graph). */
  flush?: boolean;
}

/** Panel: surface-1, 1px border, radius 16, padding 24 (DESIGN.md section 4). */
export function Panel({
  title,
  subtitle,
  action,
  divider,
  bodyClassName,
  flush,
  className,
  children,
  ...rest
}: PanelProps) {
  const hasHeader = title || action || subtitle;
  return (
    <section
      className={cx(
        "flex min-h-0 min-w-0 flex-col rounded-panel border border-line bg-surface-1",
        !flush && "p-6",
        className,
      )}
      {...rest}
    >
      {hasHeader ? (
        <header
          className={cx(
            "flex shrink-0 items-start justify-between gap-4",
            flush && "px-6 pt-6",
            divider ? "mb-4 border-b border-line pb-4" : "mb-4",
          )}
        >
          <div className="min-w-0">
            {title ? <h2 className="t-panel-title truncate">{title}</h2> : null}
            {subtitle ? <p className="t-body mt-1 text-fg-2">{subtitle}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
        </header>
      ) : null}
      <div className={cx("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}
