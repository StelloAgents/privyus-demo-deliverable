"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { shortDate } from "./format";
import { TRENDS, type Trend } from "./trend";

const DAY = 86400000;
const toMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/**
 * "Last 30 days" line chart with point markers and date ticks (hand-written SVG).
 * It measures its box so the markers stay round at any size.
 */
export function TrendChart({ trend = TRENDS[0], className }: { trend?: Trend; className?: string }) {
  const { points, start: TREND_START, end: TREND_END } = trend;
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const padX = 8;
  const top = 10;
  const bottom = 24; // room for the date ticks
  const t0 = toMs(TREND_START);
  const span = toMs(TREND_END) - t0 || DAY;
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  const range = max - min || 1;
  const xy = points.map((p) => ({
    ...p,
    x: padX + ((toMs(p.date) - t0) / span) * (w - padX * 2),
    y: top + (1 - (p.value - min) / range) * (h - top - bottom),
  }));
  const line = xy.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const ticks = xy.filter((p) => p.record).slice(-3);
  const last = xy[xy.length - 1];

  return (
    <div ref={boxRef} className={cx("relative min-h-0", className)}>
      {w > 0 && h > 0 ? (
        <svg width={w} height={h} className="block" role="img" aria-label={`Records on file, ${shortDate(TREND_START)} to ${shortDate(TREND_END)}`}>
          <line x1={padX} x2={w - padX} y1={h - bottom} y2={h - bottom} stroke="var(--border)" strokeWidth={1} />
          <path d={line} fill="none" stroke="var(--teal)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {xy.map((p) => (
            <circle key={p.date} cx={p.x} cy={p.y} r={p === last ? 5 : 3.5} fill="var(--surface-1)" stroke="var(--teal)" strokeWidth={2} />
          ))}
          {ticks.map((p) => (
            <g key={`t-${p.date}`}>
              <line x1={p.x} x2={p.x} y1={h - bottom} y2={h - bottom + 4} stroke="var(--border-strong)" strokeWidth={1} />
              <text
                x={p.x}
                y={h - 6}
                textAnchor={p === last ? "end" : p.x < 40 ? "start" : "middle"}
                className="fill-fg-3 text-[12px] font-medium"
              >
                {shortDate(p.date)}
              </text>
            </g>
          ))}
        </svg>
      ) : null}
    </div>
  );
}
