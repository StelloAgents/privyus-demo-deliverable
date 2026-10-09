"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, type PointerEvent as RPointerEvent } from "react";
import { EASE_OUT_EXPO, useReducedMotion } from "@/lib/motion";
import { monthStart } from "../orbit-layout";
import { BUILD } from "./build";
import { PLAY_MS, timeStore, useTimeWindow } from "./time";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthLabel = (m: number, withYear = false) => `${MONTHS[m % 12]}${withYear || m % 12 === 0 ? ` ${Math.floor(m / 12)}` : ""}`;
function dayLabel(day: number): string {
  const d = new Date(day * 86_400_000);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export const TIMELINE_HEIGHT = 84;

export interface OrbitTimelineProps {
  /** First month of the axis (year * 12 + month) and the number of months. */
  m0: number;
  months: number;
  /** Records on the graph per month of the axis. */
  counts: number[];
  /** The month of the focused record, marked on the axis. */
  focusMonth?: number;
  /** A change of the counts animates: the bars that change rise one by one in month order. */
  animate?: boolean;
}

function usePlayback(d0: number, d1: number) {
  const { playing } = useTimeWindow();
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const s = timeStore.get();
      const dt = Math.min(64, now - last);
      last = now;
      const end = s.end ?? d1;
      const next = (s.playhead ?? s.start ?? d0) + (dt / PLAY_MS) * (d1 - d0);
      if (next >= end) {
        timeStore.set({ playhead: null, playing: false });
        return;
      }
      timeStore.set({ playhead: next });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, d0, d1]);
}

type Drag = { mode: "start" | "end" | "body"; origin: number; s0: number; e0: number } | null;

/** Chronos: the graph's records by month, a draggable window that filters the graph, and Play (records appear in date order). */
export function OrbitTimeline({ m0, months, counts, focusMonth, animate = false }: OrbitTimelineProps) {
  const d0 = monthStart(m0);
  const d1 = monthStart(m0 + months);
  usePlayback(d0, d1);
  const t = useTimeWindow();
  const reduced = useReducedMotion();
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>(null);
  const max = Math.max(1, ...counts);
  const span = d1 - d0;
  const pct = (day: number) => `${((day - d0) / span) * 100}%`;

  const startM = t.start === null ? 0 : Math.round(((t.start - d0) / span) * months);
  const endM = t.end === null ? months : Math.round(((t.end - d0) / span) * months);
  const inWindow = counts.reduce((sum, c, m) => (m >= startM && m < endM ? sum + c : sum), 0);
  const scrubbing = t.playhead !== null;
  const full = startM === 0 && endM === months;

  const monthAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(((clientX - r.left) / r.width) * months);
  };
  const setWindow = (s: number, e: number) => {
    const whole = s <= 0 && e >= months;
    timeStore.set({ start: whole ? null : monthStart(m0 + s), end: whole ? null : monthStart(m0 + e), playhead: null, playing: false });
  };
  const startDrag = (mode: "start" | "end" | "body", ev: RPointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    (ev.target as Element).setPointerCapture(ev.pointerId);
    drag.current = { mode, origin: monthAt(ev.clientX), s0: startM, e0: endM };
  };
  const onMove = (ev: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const m = monthAt(ev.clientX);
    let s = d.s0;
    let e = d.e0;
    if (d.mode === "start") s = Math.min(Math.max(0, m), e - 1);
    else if (d.mode === "end") e = Math.max(Math.min(months, m), s + 1);
    else {
      const w = d.e0 - d.s0;
      s = Math.min(Math.max(0, d.s0 + (m - d.origin)), months - w);
      e = s + w;
    }
    if (s !== startM || e !== endM) setWindow(s, e);
  };
  const onUp = () => {
    drag.current = null;
  };
  const onKey = (h: "start" | "end", ev: React.KeyboardEvent) => {
    const step = ev.key === "ArrowLeft" ? -1 : ev.key === "ArrowRight" ? 1 : 0;
    if (!step) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (h === "start") setWindow(Math.min(Math.max(0, startM + step), endM - 1), endM);
    else setWindow(startM, Math.max(Math.min(months, endM + step), startM + 1));
  };

  const toggle = () => {
    const s = timeStore.get();
    if (s.playing) timeStore.set({ playing: false });
    else if (reduced) timeStore.set({ playhead: null, playing: false });
    else timeStore.set({ playing: true, playhead: s.playhead ?? s.start ?? d0 });
  };

  const labelEvery = months <= 8 ? 1 : months <= 14 ? 2 : 3;
  const ws = t.start ?? d0;
  const we = t.end ?? d1;

  return (
    <div
      data-caption-avoid
      data-orbit-timeline
      className="absolute inset-x-0 bottom-0 z-10 flex items-stretch gap-5 border-t border-line bg-surface-1 px-5 pt-3 pb-2.5"
      style={{ height: TIMELINE_HEIGHT }}
    >
      <div className="flex w-[132px] shrink-0 flex-col justify-between">
        <div>
          <p className="text-[12px] leading-4 font-medium text-fg-3">Records by month</p>
          <p className="mt-0.5 text-[13px] leading-5 font-semibold text-fg-1 tabular-nums">
            {scrubbing ? dayLabel(Math.floor(t.playhead!)) : `${inWindow} ${inWindow === 1 ? "record" : "records"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={t.playing ? "Pause playback" : "Play records in date order"}
          className="flex h-7 w-fit items-center gap-1.5 rounded-button border border-line-strong bg-surface-2 pr-2.5 pl-2 text-[12px] font-medium text-fg-1 transition-colors duration-[120ms] hover:bg-surface-3"
        >
          {t.playing ? <Pause size={13} strokeWidth={1.75} /> : <Play size={13} strokeWidth={1.75} />}
          {t.playing ? "Pause" : "Play"}
        </button>
      </div>

      <div className="relative min-w-0 flex-1 select-none" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        <div ref={track} className="absolute inset-x-0 top-1 bottom-[20px] flex items-end gap-[3px]">
          {counts.map((c, m) => {
            const on = m >= startM && m < endM;
            // Bars with records rise in month order (the order the sweep draws them).
            const rank = counts.slice(0, m).filter(Boolean).length;
            return (
              <div key={m} className="relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[1px]"
                  style={{
                    height: c ? `${Math.max(10, (c / max) * 100)}%` : "2px",
                    background: on ? "var(--teal)" : "var(--border-strong)",
                    opacity: c ? 1 : 0.6,
                    transition: animate
                      ? `background-color 200ms, height ${BUILD.barsMs}ms ${EASE_OUT_EXPO} ${rank * BUILD.barsStaggerMs}ms`
                      : "background-color 200ms",
                  }}
                />
              </div>
            );
          })}
        </div>
        <div
          className="absolute top-[-2px] bottom-[16px] cursor-grab rounded-[2px] border active:cursor-grabbing"
          style={{
            left: pct(ws),
            width: `calc(${pct(we)} - ${pct(ws)})`,
            borderColor: full ? "var(--border)" : "var(--teal-bright)",
            background: full ? "transparent" : "color-mix(in srgb, var(--teal-bright) 7%, transparent)",
          }}
          onPointerDown={(ev) => startDrag("body", ev)}
        >
          {(["start", "end"] as const).map((h) => (
            <div
              key={h}
              role="slider"
              aria-label={h === "start" ? "Window start" : "Window end"}
              aria-valuemin={0}
              aria-valuemax={months}
              aria-valuenow={h === "start" ? startM : endM}
              aria-valuetext={h === "start" ? monthLabel(m0 + startM, true) : monthLabel(m0 + endM - 1, true)}
              tabIndex={0}
              onPointerDown={(ev) => startDrag(h, ev)}
              onKeyDown={(ev) => onKey(h, ev)}
              className="absolute top-1/2 flex h-6 w-2.5 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-[2px] border border-teal-bright/70 bg-surface-2 focus-visible:outline-2 focus-visible:outline-teal-bright"
              style={h === "start" ? { left: -5 } : { right: -5 }}
            >
              <span className="h-2.5 w-px bg-teal-bright" />
            </div>
          ))}
        </div>
        {scrubbing ? (
          <div className="pointer-events-none absolute top-[-4px] bottom-[16px] w-px bg-fg-1" style={{ left: pct(t.playhead!) }}>
            <span className="absolute -top-[3px] -left-[3px] size-[7px] rounded-full bg-fg-1" />
          </div>
        ) : null}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4">
          {Array.from({ length: months }, (_, m) =>
            m % labelEvery === 0 ? (
              <span key={m} className="absolute text-[11px] leading-4 whitespace-nowrap text-fg-3 tabular-nums" style={{ left: `${(m / months) * 100}%` }}>
                {monthLabel(m0 + m, m === 0)}
              </span>
            ) : null,
          )}
          {focusMonth !== undefined && focusMonth >= m0 && focusMonth < m0 + months ? (
            <span
              className="absolute top-[-3px] size-[5px] rounded-full bg-orange"
              style={{ left: `calc(${((focusMonth - m0 + 0.5) / months) * 100}% - 2.5px)` }}
            />
          ) : null}
        </div>
      </div>

      <div className="flex w-[150px] shrink-0 flex-col justify-between text-right">
        <div>
          <p className="text-[12px] leading-4 font-medium text-fg-3">Window</p>
          <p className="mt-0.5 text-[13px] leading-5 font-semibold text-fg-1 tabular-nums">
            {monthLabel(m0 + startM, true)} to {monthLabel(m0 + endM - 1, true)}
          </p>
        </div>
        {full ? (
          <p className="text-[12px] leading-4 text-fg-3">Drag the edges to filter</p>
        ) : (
          <button
            type="button"
            onClick={() => setWindow(0, months)}
            className="ml-auto w-fit rounded-chip px-1 text-[12px] leading-4 font-medium text-teal-bright transition-colors duration-[120ms] hover:text-fg-1"
          >
            Show all months
          </button>
        )}
      </div>
    </div>
  );
}
