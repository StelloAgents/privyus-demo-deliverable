import { easeSweep } from "@/lib/motion";
import { CLOCK_START } from "../orbit-layout";

/**
 * The orbit graph's build-in (DESIGN.md section 6, "Graph build"). The motion
 * explains the model: the graph builds itself, and the angle on a ring is the
 * date. Each phase starts at the reasoning step that it shows:
 *
 * 1. Set root node: the center scales in from 0.6 with one ring pulse; its label follows.
 * 2. Find (the step that adds records): each new ring draws itself clockwise from
 *    the clock origin, the month dial ticks with it, and each record drops into
 *    place as the sweep passes its date. Its card fades in after it lands.
 * 3. Establish connections (the next step): the edges grow from the center, in date order.
 * 4. Render (the last step): the faint context fades in, in date order, and the
 *    timeline bars rise by month.
 *
 * Loaded states, deep links, and reduced motion place everything at once.
 */
export const BUILD = {
  /** The center node: scale from 0.6 to 1. */
  rootMs: 560,
  rootScale0: 0.6,
  /** The center label fades in once the node has landed. */
  rootLabelDelayMs: 140,
  /** The one ring pulse around the center. */
  pulseMs: 760,
  /** A label or card fades in. */
  labelFadeMs: 200,
  /** A record drops onto its ring: down from this height, scale from 0.6 to 1. */
  dropMs: 460,
  dropLift: 0.42,
  dropScale0: 0.6,
  /** The card of a record fades in this long after the drop starts. */
  cardDelayMs: 180,
  /** A ring sweep lasts this many reasoning steps, within these bounds. */
  sweepSteps: 1.7,
  sweepMinMs: 540,
  sweepMaxMs: 900,
  /** New rings start their sweeps this far apart, inside out. */
  ringStaggerMs: 50,
  /** Context that becomes a record travels to its ring once the sweep passes its date. */
  joinMs: 720,
  /** An edge grows from the center to its record; edges start in date order. */
  edgeMs: 380,
  edgeStaggerMs: 80,
  /** Faint context fades in, in date order. */
  contextMs: 420,
  contextStaggerMs: 16,
  /** Timeline bars rise by month. */
  barsMs: 420,
  barsStaggerMs: 70,
} as const;

/** Time between steps when a change has no cue (a focus change). */
export const DEFAULT_STEP_MS = 600;

/** How long a ring sweep lasts for a turn that plays one step every `stepMs`. */
export function sweepMsFor(stepMs = DEFAULT_STEP_MS): number {
  return Math.round(Math.min(BUILD.sweepMaxMs, Math.max(BUILD.sweepMinMs, stepMs * BUILD.sweepSteps)));
}

const TAU = Math.PI * 2;

/** How far along the sweep (0 at the clock origin, 1 a full turn later) the angle `a` is. */
export function sweepFraction(a: number): number {
  const f = (a - CLOCK_START) / TAU;
  const r = f - Math.floor(f);
  // The clock origin itself is the start of the sweep, not its end.
  return r > 1 - 1e-6 ? 0 : r;
}

/** The sweep's progress at `t` (0..1 of its duration). */
export const sweepAt = (t: number): number => easeSweep(t < 0 ? 0 : t > 1 ? 1 : t);

/** The time (ms from the sweep start) at which a sweep of `durMs` passes the fraction `f`. */
export function sweepPassMs(f: number, durMs: number): number {
  if (f <= 0) return 0;
  if (f >= 1) return durMs;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (easeSweep(mid) < f) lo = mid;
    else hi = mid;
  }
  return ((lo + hi) / 2) * durMs;
}
