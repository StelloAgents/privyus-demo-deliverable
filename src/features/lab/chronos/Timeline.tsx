"use client";

import { Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { BINS, NODE_BY_ID, T_END, T_START, dateMs, formatDay } from "./data";
import { useChronos } from "./store";

/** Full span plays in this many seconds. */
const PLAY_SECONDS = 11;
const MAX = Math.max(...BINS.map((b) => b.count));
const span = T_END - T_START;
const frac = (ms: number) => (ms - T_START) / span;

/** The bottom histogram: one bar per month of Hartley's records. Play reveals the scene in date order. */
export function Timeline() {
  const t = useChronos((s) => s.t);
  const playing = useChronos((s) => s.playing);
  const focusId = useChronos((s) => s.focusId);
  const setT = useChronos((s) => s.setT);
  const setPlaying = useChronos((s) => s.setPlaying);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = useChronos.getState();
      const next = s.t + (dt / PLAY_SECONDS) * span;
      if (next >= T_END) {
        s.setT(T_END);
        s.setPlaying(false);
        return;
      }
      s.setT(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  const toggle = () => {
    if (playing) return setPlaying(false);
    if (t >= T_END - 1) setT(T_START);
    setPlaying(true);
  };

  const seek = useCallback(
    (clientX: number) => {
      const el = track.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
      setT(T_START + f * span);
    },
    [setT],
  );

  const focus = focusId ? NODE_BY_ID.get(focusId) : undefined;
  const focusMs = focus?.date ? dateMs(focus.date) : null;
  const pf = frac(t);

  return (
    <div className="chronos-timeline">
      <button
        type="button"
        className="chronos-play"
        onClick={toggle}
        aria-label={playing ? "Pause playback" : "Play records in date order"}
      >
        {playing ? <Pause size={16} strokeWidth={1.75} /> : <Play size={16} strokeWidth={1.75} />}
      </button>
      <div className="chronos-now">
        <div className="chronos-now-label">Showing records to</div>
        <div className="chronos-now-date">{formatDay(t)}</div>
      </div>
      <div
        ref={track}
        className="chronos-track"
        role="slider"
        aria-label="Timeline"
        aria-valuemin={T_START}
        aria-valuemax={T_END}
        aria-valuenow={Math.round(t)}
        aria-valuetext={formatDay(t)}
        tabIndex={0}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          setPlaying(false);
          seek(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && seek(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onKeyDown={(e) => {
          const step = 7 * 864e5;
          if (e.key === "ArrowRight") setT(t + step);
          if (e.key === "ArrowLeft") setT(t - step);
        }}
      >
        <div className="chronos-bars">
          {BINS.map((b) => {
            const played = b.start <= t;
            return (
              <div key={b.start} className="chronos-bin">
                <div
                  className={played ? "chronos-bar chronos-bar-on" : "chronos-bar"}
                  style={{ height: `${b.count ? 10 + (b.count / MAX) * 90 : 0}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="chronos-axis">
          {BINS.map((b, i) => {
            const d = new Date(b.start);
            const m = d.getUTCMonth();
            const show = m % 3 === 0;
            return (
              <div key={b.start} className="chronos-tick">
                {show ? (m === 0 || i === 0 ? `${["Jan", "Apr", "Jul", "Oct"][m / 3]} ${d.getUTCFullYear()}` : ["Jan", "Apr", "Jul", "Oct"][m / 3]) : ""}
              </div>
            );
          })}
        </div>
        {focusMs !== null && <div className="chronos-focus-mark" style={{ left: `${frac(focusMs) * 100}%` }} title={focus?.label} />}
        <div className="chronos-playhead" style={{ left: `${pf * 100}%` }} />
      </div>
    </div>
  );
}
