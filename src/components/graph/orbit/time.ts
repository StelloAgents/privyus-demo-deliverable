"use client";

import { useSyncExternalStore } from "react";
import type { Catalog } from "@/lib/types";
import { monthOfDay, monthStart, toDay } from "../orbit-layout";

/**
 * The Chronos time window (days since 1970-01-01) of the orbit graph. The 3D
 * scene reads it every frame; the timeline renders from it. `null` bounds mean
 * the whole domain (the default; nothing is filtered).
 */
export interface TimeState {
  start: number | null;
  end: number | null;
  /** Playback position. `null`: not playing back (everything in the window shows). */
  playhead: number | null;
  playing: boolean;
}

const INITIAL: TimeState = { start: null, end: null, playhead: null, playing: false };
let state: TimeState = INITIAL;
const listeners = new Set<() => void>();

export const timeStore = {
  get: (): TimeState => state,
  set(patch: Partial<TimeState>) {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};

/** The whole window, no playback (a new exploration, a presenter step). */
export function resetTimeWindow(): void {
  if (state === INITIAL) return;
  state = INITIAL;
  for (const l of listeners) l();
}

/** The timeline axis: every dated record in the catalog (first month as year * 12 + month, and the number of months). */
export function timeAxis(catalog: Catalog): { m0: number; months: number } {
  let lo = Infinity;
  let hi = -Infinity;
  for (const e of Object.values(catalog.edges)) {
    if (!e.date) continue;
    const m = monthOfDay(toDay(e.date));
    lo = Math.min(lo, m);
    hi = Math.max(hi, m);
  }
  return isFinite(lo) ? { m0: lo, months: hi - lo + 1 } : { m0: 2025 * 12, months: 12 };
}

/** Sets the window at once (days; `null` bounds: the whole domain), with no playback. */
export function setTimeBounds(start: number | null, end: number | null): void {
  if (state.start === start && state.end === end && state.playhead === null && !state.playing) return;
  timeStore.set({ start, end, playhead: null, playing: false });
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Moves both edges of the window to `start` and `end` (days; `null`: that end of
 * the domain `[d0, d1]`) over `ms`. Resolves when the edges are there; on abort
 * the edges stop where they are.
 */
export function animateTimeBounds(start: number | null, end: number | null, d0: number, d1: number, ms: number, signal?: AbortSignal): Promise<void> {
  const s0 = state.start ?? d0;
  const e0 = state.end ?? d1;
  const s1 = start ?? d0;
  const e1 = end ?? d1;
  if (signal?.aborted) return Promise.resolve();
  if (ms <= 0 || (s0 === s1 && e0 === e1)) {
    setTimeBounds(start, end);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const t0 = performance.now();
    let raf = 0;
    const stop = () => {
      cancelAnimationFrame(raf);
      resolve();
    };
    signal?.addEventListener("abort", stop, { once: true });
    const tick = (now: number) => {
      if (signal?.aborted) return;
      const k = Math.min(1, (now - t0) / ms);
      if (k >= 1) {
        signal?.removeEventListener("abort", stop);
        setTimeBounds(start, end);
        resolve();
        return;
      }
      const e = easeInOutCubic(k);
      timeStore.set({ start: s0 + (s1 - s0) * e, end: e0 + (e1 - e0) * e, playhead: null, playing: false });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

/** Days of the first day of month `ym` ("YYYY-MM"), and of the day after the month ends. */
export const monthBounds = (ym: string): [number, number] => {
  const m = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1;
  return [monthStart(m), monthStart(m + 1)];
};

export const useTimeWindow = () => useSyncExternalStore(timeStore.subscribe, timeStore.get, timeStore.get);

/** Days a record takes to grow in during playback. */
export const GROW_DAYS = 18;
/** Playback length for the whole domain. */
export const PLAY_MS = 8000;

/**
 * How visible a record dated `day` is (0 to 1): inside the window, and reached
 * by the playhead. Undated records always show.
 */
export function timeVisibility(s: TimeState, day: number | undefined): number {
  if (day === undefined) return 1;
  if (s.start !== null && day < s.start - 0.5) return 0;
  if (s.end !== null && day >= s.end + 0.5) return 0;
  if (s.playhead === null) return 1;
  const g = (s.playhead - day) / GROW_DAYS + 0.15;
  return g < 0 ? 0 : g > 1 ? 1 : g;
}
