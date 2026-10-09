import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/** One section of the technical page: an anchor, a meta kicker, a title, a lead, and the body. */
export function Section({
  id,
  kicker,
  title,
  lead,
  badge,
  children,
  className,
}: {
  id: string;
  kicker?: string;
  title: string;
  /** A small chip after the title, for example "Planned". */
  badge?: string;
  lead?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cx("scroll-mt-6", className)}>
      <header className="mb-6 max-w-[720px]">
        {kicker ? <p className="t-meta mb-2 text-teal-bright">{kicker}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h2 id={`${id}-title`} className="font-display text-[24px] leading-[30px] font-semibold text-fg-1">
            {title}
          </h2>
          {badge ? <Tag>{badge}</Tag> : null}
        </div>
        {lead ? <div className="t-body mt-3 text-[15px] leading-[24px] text-fg-2">{lead}</div> : null}
      </header>
      {children}
    </section>
  );
}

/** A bordered surface for diagrams and tables (the panel look without a title row). */
export function Surface({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("rounded-panel border border-line bg-surface-1", className)}>{children}</div>;
}

/** A small meta note, used for the order-of-magnitude and planning-estimate labels. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("t-meta flex items-start gap-2", className)}>
      <span aria-hidden="true" className="mt-[5px] size-1.5 shrink-0 rounded-full bg-teal" />
      <span>{children}</span>
    </p>
  );
}

/** Table cell classes shared by the stores, risks, plan, and query tables. */
export const TH = "t-meta px-4 py-3 text-left font-medium align-bottom";
export const TD = "t-body px-4 py-3.5 align-top text-fg-2";

/** A small status chip ("This demo", "Planned"): radius 4, 1px teal border, 12px text. */
export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center rounded-chip border border-teal px-2 text-[12px] leading-4 font-medium text-teal-bright",
        className,
      )}
    >
      {children}
    </span>
  );
}
