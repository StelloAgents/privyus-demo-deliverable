import { DeltaChip } from "./DeltaChip";
import { Sparkline } from "./Sparkline";
import { cx } from "./cx";

export interface KpiTileProps {
  label: string;
  value: string | number;
  delta?: number | string;
  deltaDirection?: "up" | "down";
  /** Optional caption after the delta, for example "vs last week". */
  deltaCaption?: string;
  series?: number[];
  className?: string;
}

/** KPI tile: label (meta), figure (KPI), delta chip, 64x24 teal sparkline. */
export function KpiTile({ label, value, delta, deltaDirection, deltaCaption, series, className }: KpiTileProps) {
  const figure = typeof value === "number" ? value.toLocaleString("en-US") : value;
  return (
    <div className={cx("flex min-w-0 flex-col gap-2 rounded-card border border-line bg-surface-2 p-4", className)}>
      <div className="t-meta truncate">{label}</div>
      <div className="flex items-end justify-between gap-3">
        <div className="t-kpi">{figure}</div>
        {series ? <Sparkline values={series} className="mb-1 shrink-0" /> : null}
      </div>
      {delta !== undefined ? (
        <div className="flex items-center gap-2">
          <DeltaChip value={delta} direction={deltaDirection} />
          {deltaCaption ? <span className="t-meta">{deltaCaption}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
