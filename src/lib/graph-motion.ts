"use client";

import { useDemoStore } from "./store";

/**
 * Whether the graph on screen has come to rest: the canvas has processed the
 * store's latest change, and no node tween or camera move runs. GraphCanvas
 * reports; presenter steps wait (the caption is placed against final positions).
 */
let mounted = 0;
let processed = -1;
let tweening = false;
let cameraUntil = 0;
let cameraTimer: ReturnType<typeof setTimeout> | undefined;
const waiters = new Set<() => void>();

function atRest(): boolean {
  if (mounted === 0) return true;
  return processed >= useDemoStore.getState().graph.revision && !tweening && performance.now() >= cameraUntil;
}

function check(): void {
  if (!atRest()) return;
  waiters.forEach((w) => w());
}

export const graphMotion = {
  mount(): () => void {
    mounted += 1;
    return () => {
      mounted -= 1;
      tweening = false;
      check();
    };
  },
  processed(revision: number): void {
    processed = Math.max(processed, revision);
    check();
  },
  tweening(on: boolean): void {
    tweening = on;
    check();
  },
  camera(ms: number): void {
    cameraUntil = Math.max(cameraUntil, performance.now() + ms);
    if (cameraTimer) clearTimeout(cameraTimer);
    cameraTimer = setTimeout(check, Math.max(0, cameraUntil - performance.now()) + 5);
  },
};

/** Resolves when the graph is at rest (at once when no graph is on screen), on abort, or after `timeoutMs`. */
export function whenGraphAtRest(signal?: AbortSignal, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = () => {
      waiters.delete(onRest);
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    // The canvas processes a change in the next frame: check after it, not before.
    const onRest = () => done();
    requestAnimationFrame(() => {
      if (atRest()) return done();
      waiters.add(onRest);
    });
    const timer = setTimeout(done, timeoutMs);
    signal?.addEventListener("abort", done, { once: true });
  });
}
