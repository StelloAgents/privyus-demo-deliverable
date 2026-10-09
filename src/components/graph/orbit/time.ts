"use client";

import { useSyncExternalStore } from "react";

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
