"use client";

import { useSyncExternalStore } from "react";
import { T0, T1 } from "./data";

/** The time window (days since epoch). The 3D scene reads it every frame; the timeline renders from it. */
export interface TimeState {
  start: number;
  end: number;
  playhead: number;
  playing: boolean;
}

let state: TimeState = { start: T0, end: T1, playhead: T1, playing: false };
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

export const useTime = () => useSyncExternalStore(timeStore.subscribe, timeStore.get, timeStore.get);

/** Days a record takes to grow in during playback (5% of the window). */
export const growDays = (s: TimeState) => Math.max(8, (s.end - s.start) * 0.05);

/** Playback length for the whole window. */
export const PLAY_MS = 9000;
