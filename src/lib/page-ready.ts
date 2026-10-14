"use client";

import { useEffect } from "react";
import { emit, nextEvent } from "./events";

/**
 * Page readiness for the route curtain: a page reports when it has fully drawn
 * (no skeleton, map drawn, graph in place). Event based, no polling.
 */
let readyPath: string | null = null;

/** Reports `path` as drawn once `ready` holds (two frames later, so the frame is on screen). */
export function usePageReady(path: string, ready = true): void {
  useEffect(() => {
    if (!ready) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        readyPath = path;
        emit("page-ready", path);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      if (readyPath === path) readyPath = null;
    };
  }, [path, ready]);
}

/** Resolves true when the page at `path` is drawn (at once if it already is), false on abort or timeout. */
export function whenPageReady(path: string, signal?: AbortSignal, timeoutMs = 3000): Promise<boolean> {
  if (readyPath === path) return Promise.resolve(true);
  return nextEvent("page-ready", { match: (p) => p === path, signal, timeoutMs });
}
