"use client";

import { create } from "zustand";
import type { TourStep } from "./types";

export type TourPhase = "idle" | "running" | "ready";

export interface TourState {
  active: boolean;
  steps: TourStep[];
  /** 0-based step index. */
  index: number;
  phase: TourPhase;
  notes: boolean;
  /** The route curtain is up (the page area fades to the page color while a page changes). */
  curtain: boolean;
  /** Targets for a moment inside a step (for example the Save button before the move to Home). */
  spot: string[] | null;
  /** The start hint is owed (Present button or P), once per presenter session. */
  hintPending: boolean;
  /** The start hint shows until this time (ms, performance.now()). */
  hintUntil: number;
}

export const useTourStore = create<TourState>(() => ({
  active: false,
  steps: [],
  index: 0,
  phase: "idle",
  notes: false,
  curtain: false,
  spot: null,
  hintPending: false,
  hintUntil: 0,
}));

/** True while presenter mode runs. Features pause background activity (the live replay) when true. */
export function useTourActive(): boolean {
  return useTourStore((s) => s.active);
}

/** Non-hook form for event handlers and timers. */
export function isTourActive(): boolean {
  return useTourStore.getState().active;
}

/**
 * True while presenter mode runs, or while a presenter URL (`?present=1` or
 * `#present=<n>`) is about to start it. Pages then leave their state to the tour
 * (they do not apply their own URL parameters).
 */
export function tourOwnsPage(): boolean {
  if (isTourActive()) return true;
  if (typeof window === "undefined") return false;
  return /(^|[?&])present=1(&|$)/.test(window.location.search) || /^#present=\d+$/.test(window.location.hash);
}
