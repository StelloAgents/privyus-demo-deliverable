import { useId } from "react";

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  /** Mark the last point with one orange dot. Use on one chart at most per screen. */
  highlightLast?: boolean;
  className?: string;
  ariaLabel?: string;
}

/** A 64x24 teal sparkline, hand-written SVG (no chart library). */
export function Sparkline({
  values,
  width = 64,
  height = 24,
  highlightLast,
  className,
  ariaLabel,
}: SparklineProps) {
  const gid = useId();
  if (values.length < 2) return <svg width={width} height={height} className={className} aria-hidden="true" />;
  const pad = 2.5;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (width - pad * 2),
    y: pad + (1 - (v - min) / span) * (height - pad * 2),
  }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)} ${height} L${pts[0].x.toFixed(1)} ${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--teal)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--teal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke="var(--teal)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      {highlightLast ? <circle cx={last.x} cy={last.y} r={2.5} fill="var(--orange)" /> : null}
    </svg>
  );
}
