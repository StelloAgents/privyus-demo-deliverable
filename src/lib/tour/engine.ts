"use client";

import { prefersReducedMotion } from "@/lib/motion";
import { whenPageReady } from "@/lib/page-ready";
import { useTourStore } from "./store";
import { sleep } from "./timing";
import type { TourApp, TourStep } from "./types";

/**
 * Presenter mode runner (PRESENTER-MODE.md section 5).
 *
 * Every step declares its settled `end` state. `goTo(n)` puts the end state of
 * step n-1 in place at once (`app.apply`, behind the route curtain only when the
 * page changes), then plays step n. A forward press from a settled step skips
 * the apply: the step plays from the screen as it is. Each press aborts the step
 * in progress through its AbortSignal, so rapid presses end exactly where the
 * last press points.
 */

/** Curtain fade-in (the old page fades out); the fade-out is 240ms (Spotlight). */
const CURTAIN_IN_MS = 180;
/** The curtain never stays opaque longer than this (it lifts even if the page is late). */
const OPAQUE_CAP_MS = 600;
/** Safety net: a step whose action never finishes still shows its caption after this. */
const PLAY_CAP_MS = 8000;

export interface TourNavigator {
  replace: (route: string) => void;
  prefetch: (route: string) => void;
}

let nav: TourNavigator | null = null;
let app: TourApp<unknown> | null = null;
let ctrl = new AbortController();
/** The pathname the router was last asked for, while that navigation is in flight. */
let pendingPath: string | null = null;
/** Curtains in progress (a newer step may raise it again before an aborted one lowers it). */
let curtainHolders = 0;
/** When the curtain started to fade in. */
let curtainUpAt = 0;

/** The shell provides client-side navigation (Next router). */
export function setTourNavigator(n: TourNavigator | null): void {
  nav = n;
}

const pathOf = (route: string) => new URL(route, window.location.origin).pathname;

/** The page on screen, or the one a navigation in flight is about to show. */
function currentPath(): string {
  if (pendingPath === window.location.pathname) pendingPath = null;
  return pendingPath ?? window.location.pathname;
}

/**
 * Opens `route` and resolves when the new page has drawn (its "page-ready"
 * event), or on abort, or after 3s.
 */
async function navigate(route: string, signal: AbortSignal): Promise<void> {
  const path = pathOf(route);
  pendingPath = path;
  if (nav) nav.replace(route);
  else window.location.assign(route);
  await whenPageReady(path, signal);
}

/**
 * The route curtain: the page area fades to the page color while `prepare`
 * runs (store work for the next page, which is not on screen yet; both are
 * awaited). Then the router opens `route` and the curtain waits for the new
 * page to report that it has drawn, and fades back in. The router call waits
 * for the fade: a page that commits under a half-faded curtain shows undrawn.
 * Opaque for at most OPAQUE_CAP_MS. It always lifts (also on abort or error),
 * unless a newer step holds it.
 */
async function withCurtain(prepare: () => void, route: string, signal: AbortSignal): Promise<void> {
  curtainHolders += 1;
  // A curtain that is already up (a newer press while it fades or is opaque) only waits out its fade.
  if (!useTourStore.getState().curtain) curtainUpAt = performance.now();
  useTourStore.setState({ curtain: true });
  try {
    const fadeLeft = prefersReducedMotion() ? 0 : Math.max(0, CURTAIN_IN_MS - (performance.now() - curtainUpAt));
    await Promise.all([sleep(fadeLeft, signal), Promise.resolve().then(prepare)]);
    if (signal.aborted) return;
    document.documentElement.setAttribute("data-tour-curtain", "on");
    await Promise.race([navigate(route, signal), sleep(OPAQUE_CAP_MS, signal)]);
  } catch (e) {
    console.warn("[tour] page change failed", e);
  } finally {
    curtainHolders = Math.max(0, curtainHolders - 1);
    if (curtainHolders === 0) liftCurtain();
  }
}

function liftCurtain(): void {
  document.documentElement.removeAttribute("data-tour-curtain");
  useTourStore.setState({ curtain: false });
}

/**
 * For steps: open another page under the route curtain. `before` runs first
 * (for example a reset of the next page's store, which is not on screen yet).
 */
export function changePage(route: string, signal: AbortSignal, before?: () => void): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return withCurtain(() => before?.(), route, signal);
}

/** For steps: move the cutout to other targets inside a step (null: back to the step's targets). */
export function spotlight(targets: string[] | null): void {
  useTourStore.setState({ spot: targets });
}

/** Puts `state` in place: behind the curtain when the page changes, else at once. */
async function arrive(state: unknown, signal: AbortSignal): Promise<void> {
  const a = app!;
  const route = a.route(state);
  if (pathOf(route) === currentPath()) {
    a.apply(state);
    return;
  }
  await withCurtain(() => a.apply(state), route, signal);
}

/** Writes the step into the URL hash (`#present=<n>`), so a reload reopens the same step. */
function writeStepToUrl(index: number): void {
  try {
    const url = `${window.location.pathname}${window.location.search}#present=${index + 1}`;
    // Keep the router's own history state, so the router does not react.
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // Ignore.
  }
}

/**
 * Shows step `n`. "forward" from the settled step n-1 plays from the screen as
 * it is; anything else (a press while a step still plays, ←, Home, End, a deep
 * link) first puts step n-1's end state in place.
 */
async function goTo(n: number, how: "forward" | "jump"): Promise<void> {
  const st = useTourStore.getState();
  if (!st.active || !app) return;
  const steps = st.steps;
  const i = Math.max(0, Math.min(n, steps.length - 1));
  const fromSettled = how === "forward" && st.index === i - 1 && st.phase === "ready";
  ctrl.abort();
  const run = new AbortController();
  ctrl = run;
  const { signal } = run;
  useTourStore.setState({ index: i, phase: "running", spot: null });
  writeStepToUrl(i);
  try {
    if (!fromSettled) {
      await arrive(i === 0 ? app.clean : steps[i - 1].end, signal);
      // A page that is still loading (a deep link, a reload) draws before the step plays.
      if (!signal.aborted) await whenPageReady(currentPath(), signal);
    }
    if (signal.aborted) return;
    await Promise.race([steps[i].play(signal), sleep(PLAY_CAP_MS, signal)]);
  } catch (e) {
    console.warn(`[tour] step ${i + 1} failed`, e);
  }
  if (signal.aborted) return;
  writeStepToUrl(i);
  useTourStore.setState({ phase: "ready", spot: null });
}

/* ------------------------------------------------------------------ */
/* Public controls                                                     */
/* ------------------------------------------------------------------ */

/**
 * Starts presenter mode at `index` (0-based) with a clean demo state.
 * `hint`: show the navigation hint once (started by the Present button or P).
 */
export function startTour<S>(steps: TourStep<S>[], tourApp: TourApp<S>, index = 0, opts: { hint?: boolean } = {}): void {
  app = tourApp as TourApp<unknown>;
  ctrl.abort();
  curtainHolders = 0;
  pendingPath = null;
  useTourStore.setState({
    active: true,
    steps: steps as TourStep[],
    index: Math.max(0, Math.min(index, steps.length - 1)),
    phase: "running",
    curtain: false,
    spot: null,
    hintPending: !!opts.hint,
    hintUntil: 0,
  });
  document.documentElement.setAttribute("data-presenting", "");
  // The trigger (the "Present" button) must not keep focus: Space would click it again.
  (document.activeElement as HTMLElement | null)?.blur?.();
  app.start();
  for (const route of ["/", "/explore", "/search"]) nav?.prefetch(route);
  void goTo(index, "jump");
}

/** Leaves presenter mode. The app stays where it is; the user's own data comes back. */
export function exitTour(): void {
  if (!useTourStore.getState().active) return;
  ctrl.abort();
  curtainHolders = 0;
  pendingPath = null;
  liftCurtain();
  app?.exit();
  document.documentElement.removeAttribute("data-presenting");
  useTourStore.setState({ active: false, phase: "idle", spot: null, hintPending: false, hintUntil: 0 });
  try {
    if (window.location.hash.startsWith("#present=")) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
  } catch {
    // Ignore.
  }
}

export function nextStep(): void {
  const { index, steps, active } = useTourStore.getState();
  // The last step stays (as in a slide deck); Esc or the X leaves.
  if (!active || index >= steps.length - 1) return;
  void goTo(index + 1, "forward");
}

/** ← shows the step before exactly as → reaches it. On step 1, ← replays step 1. */
export function prevStep(): void {
  const { index, active } = useTourStore.getState();
  if (active) void goTo(Math.max(0, index - 1), "jump");
}

/** Jumps to a step (Home, End). */
export function goToStep(index: number): void {
  if (useTourStore.getState().active) void goTo(index, "jump");
}

export function toggleNotes(): void {
  useTourStore.setState((s) => ({ notes: !s.notes }));
}

/* ------------------------------------------------------------------ */
/* State on <html> (CSS hooks and end-to-end tests)                     */
/* ------------------------------------------------------------------ */

if (typeof window !== "undefined") {
  useTourStore.subscribe((s) => {
    const el = document.documentElement;
    if (!s.active) {
      el.removeAttribute("data-tour-step");
      el.removeAttribute("data-tour-phase");
      return;
    }
    el.setAttribute("data-tour-step", String(s.index + 1));
    el.setAttribute("data-tour-phase", s.phase);
  });
}
