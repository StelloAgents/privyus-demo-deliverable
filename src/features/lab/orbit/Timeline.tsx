"use client";

/* Graph lab prototype (superseded by components/graph/orbit, kept for the Alternative Designs page): frame-loop mutation of three.js objects is intended here. */
/* eslint-disable react-hooks/refs, react-hooks/use-memo */

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, type PointerEvent as RPointerEvent } from "react";
import { MONTH_COUNT, PATH_NODES, T0, T1, dayLabel, histogram, monthLabel, monthOf, monthStartDay, nodeById, toDay } from "./data";
import { PLAY_MS, timeStore, useTime } from "./time";

const span = T1 - T0;
const pct = (day: number) => `${((day - T0) / span) * 100}%`;
/** The month that holds the private meeting (the focus chain), marked on the axis. */
const PATH_MONTH = monthOf(toDay(nodeById.get(PATH_NODES[1])!.date));

function usePlayback() {
  const { playing } = useTime();
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const s = timeStore.get();
      const dt = Math.min(64, now - last);
      last = now;
      const next = s.playhead + (dt / PLAY_MS) * span;
      if (next >= s.end) {
        timeStore.set({ playhead: s.end, playing: false });
        return;
      }
      timeStore.set({ playhead: next });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

type Drag = { mode: "start" | "end" | "body"; originMonth: number; s0: number; e0: number } | null;

/** Neo4j Bloom style timeline: records by month, a draggable window, and a play button. */
export function Timeline() {
  usePlayback();
  const t = useTime();
  const counts = useMemo(histogram, []);
  const max = Math.max(...counts);
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag>(null);

  const startM = monthOf(t.start);
  const endM = monthOf(t.end - 1) + 1;
  const inWindow = counts.reduce((sum, c, m) => (m >= startM && m < endM ? sum + c : sum), 0);
  const scrubbing = t.playing || t.playhead < t.end - 0.5;

  const monthAt = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    return Math.round(((clientX - r.left) / r.width) * MONTH_COUNT);
  };

  const onDown = (mode: "start" | "end" | "body") => (ev: RPointerEvent) => {
    ev.preventDefault();
    ev.stopPropagation();
    (ev.target as Element).setPointerCapture(ev.pointerId);
    drag.current = { mode, originMonth: monthAt(ev.clientX), s0: startM, e0: endM };
    timeStore.set({ playing: false });
  };
  const onMove = (ev: RPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const m = monthAt(ev.clientX);
    let s = d.s0;
    let e = d.e0;
    if (d.mode === "start") s = Math.min(Math.max(0, m), e - 1);
    else if (d.mode === "end") e = Math.max(Math.min(MONTH_COUNT, m), s + 1);
    else {
      const w = d.e0 - d.s0;
      s = Math.min(Math.max(0, d.s0 + (m - d.originMonth)), MONTH_COUNT - w);
      e = s + w;
    }
    const end = monthStartDay(e);
    timeStore.set({ start: monthStartDay(s), end, playhead: end });
  };
  const onUp = () => {
    drag.current = null;
  };

  const toggle = () => {
    const s = timeStore.get();
    if (s.playing) timeStore.set({ playing: false });
    else timeStore.set({ playing: true, playhead: s.playhead >= s.end - 0.5 ? s.start : s.playhead });
  };

  return (
    <div className="flex h-[112px] shrink-0 items-stretch gap-5 border-t border-line bg-surface-1 px-5 pt-4 pb-3">
      <div className="flex w-[148px] shrink-0 flex-col justify-between">
        <div>
          <p className="text-[12px] leading-4 font-medium text-fg-3">Records by month</p>
          <p className="mt-1 text-[13px] leading-5 font-semibold text-fg-1 tabular-nums">
            {scrubbing ? dayLabel(Math.floor(t.playhead)) : `${inWindow} records`}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-label={t.playing ? "Pause playback" : "Play records in date order"}
          className="flex h-8 w-fit items-center gap-2 rounded-button border border-line-strong bg-surface-2 pr-3 pl-2.5 text-[13px] font-medium text-fg-1 transition-colors duration-[120ms] hover:bg-surface-3"
        >
          {t.playing ? <Pause size={14} strokeWidth={1.75} /> : <Play size={14} strokeWidth={1.75} />}
          {t.playing ? "Pause" : "Play"}
        </button>
      </div>

      <div className="relative min-w-0 flex-1 select-none" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {/* Bars */}
        <div ref={track} className="absolute inset-x-0 top-0 bottom-[22px] flex items-end gap-[3px]">
          {counts.map((c, m) => {
            const on = m >= startM && m < endM;
            return (
              <div key={m} className="relative flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-[1px] transition-[background-color] duration-200"
                  style={{
                    height: c ? `${Math.max(8, (c / max) * 100)}%` : "2px",
                    background: on ? "var(--teal)" : "var(--border-strong)",
                    opacity: c ? 1 : 0.6,
                  }}
                />
              </div>
            );
          })}
        </div>
        {/* Window */}
        <div
          className="absolute top-[-4px] bottom-[18px] cursor-grab rounded-[2px] border border-teal-bright/60 active:cursor-grabbing"
          style={{ left: pct(t.start), width: `calc(${pct(t.end)} - ${pct(t.start)})`, background: "rgb(127 182 194 / 0.06)" }}
          onPointerDown={onDown("body")}
        >
          {(["start", "end"] as const).map((h) => (
            <div
              key={h}
              role="slider"
              aria-label={h === "start" ? "Window start" : "Window end"}
              aria-valuemin={0}
              aria-valuemax={MONTH_COUNT}
              aria-valuenow={h === "start" ? startM : endM}
              tabIndex={0}
              onPointerDown={onDown(h)}
              className="absolute top-1/2 flex h-7 w-3 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-[2px] border border-teal-bright/70 bg-surface-2"
              style={h === "start" ? { left: -6 } : { right: -6 }}
            >
              <span className="h-3 w-px bg-teal-bright" />
            </div>
          ))}
        </div>
        {/* Playhead */}
        {scrubbing && (
          <div className="pointer-events-none absolute top-[-6px] bottom-[18px] w-px bg-fg-1" style={{ left: pct(t.playhead) }}>
            <span className="absolute -top-[3px] -left-[3px] size-[7px] rounded-full bg-fg-1" />
          </div>
        )}
        {/* Axis */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4">
          {Array.from({ length: MONTH_COUNT }, (_, m) =>
            m % 3 === 0 ? (
              <span key={m} className="absolute text-[11px] leading-4 text-fg-3 tabular-nums" style={{ left: `${(m / MONTH_COUNT) * 100}%` }}>
                {monthLabel(m)}
              </span>
            ) : null,
          )}
          <span
            className="absolute top-[3px] size-[5px] rounded-full bg-orange"
            style={{ left: `calc(${((PATH_MONTH + 0.5) / MONTH_COUNT) * 100}% - 2.5px)` }}
            title="Private meeting, Jun 17, 2026"
          />
        </div>
      </div>

      <div className="flex w-[196px] shrink-0 flex-col justify-between text-right">
        <div>
          <p className="text-[12px] leading-4 font-medium text-fg-3">Window</p>
          <p className="mt-1 text-[13px] leading-5 font-semibold text-fg-1 tabular-nums">
            {monthLabel(startM, true)} to {monthLabel(endM - 1, true)}
          </p>
        </div>
        <p className="text-[12px] leading-4 text-fg-3">Drag the window to filter. Play reveals records in date order.</p>
      </div>
    </div>
  );
}
