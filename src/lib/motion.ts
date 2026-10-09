"use client";

import { useSyncExternalStore, type CSSProperties } from "react";
import type { Transition, Variants } from "motion/react";

/** Motion values from DESIGN.md section 6. Use these only. */
export const MOTION = {
  /** Root node spring (graph build). */
  rootSpring: { type: "spring", stiffness: 260, damping: 24 } as Transition,
  /** Delay between children that enter one by one. */
  childStaggerMs: 40,
  /** Edge draw from parent to child. */
  edgeDrawMs: 280,
  /** Camera move to a focused node. */
  cameraMs: 450,
  /** Context dimming fade. */
  dimMs: 200,
  /** Panel content fade and rise. */
  panelMs: 180,
  panelRisePx: 8,
  /** List stagger per row, and the maximum number of staggered rows. */
  listStaggerMs: 30,
  listStaggerMax: 8,
  /** Hover color and opacity. */
  hoverMs: 120,
  /** Streamed chat text speed. */
  wordsPerSecond: 35,
  /** Node travel from the parent position to its own position. */
  nodeTravelMs: 560,
  /** Duration for existing nodes that move aside. */
  settleMs: 600,
} as const;

/** cubic-bezier(0.22, 1, 0.36, 1) as an array for motion, and as a CSS string. */
export const EASE_OUT_EXPO_ARRAY = [0.22, 1, 0.36, 1] as const;
export const EASE_OUT_EXPO = "cubic-bezier(0.22, 1, 0.36, 1)";

/** A JS version of a CSS cubic-bezier, for camera and layout tweens. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const sampleDX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const err = sampleX(t) - x;
      if (Math.abs(err) < 1e-5) break;
      const d = sampleDX(t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    // Bisection fallback for safety.
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 20 && Math.abs(sampleX(t) - x) > 1e-5; i++) {
      if (sampleX(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return sampleY(t);
  };
}

export const easeOutExpo = cubicBezier(0.22, 1, 0.36, 1);

/** The orbit's ring sweep (a clock hand): a soft start, an even middle, a soft landing. */
export const easeSweep = cubicBezier(0.45, 0, 0.25, 1);

/** Fade and rise 8px over 180ms (panel content). */
export const fadeRise: Variants = {
  hidden: { opacity: 0, y: MOTION.panelRisePx },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: MOTION.panelMs / 1000, ease: EASE_OUT_EXPO_ARRAY },
  },
};

/** Container variants that stagger children 30ms apart. */
export const staggerList: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: MOTION.listStaggerMs / 1000 } },
};

/** Delay in ms for list row `index` (stagger stops after 8 rows). */
export function listDelayMs(index: number): number {
  return Math.min(index, MOTION.listStaggerMax - 1) * MOTION.listStaggerMs;
}

/** CSS style for a row that fades and rises with the list stagger. */
export function fadeRiseStyle(index = 0): CSSProperties {
  return {
    animation: `privy-fade-rise ${MOTION.panelMs}ms ${EASE_OUT_EXPO} both`,
    animationDelay: `${listDelayMs(index)}ms`,
  };
}

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** True when the user asks for reduced motion. Safe on the server (returns false). */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REDUCED_QUERY).matches;
}

function subscribeReduced(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** React hook form of `prefersReducedMotion`, which updates on change. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReduced, prefersReducedMotion, () => false);
}
