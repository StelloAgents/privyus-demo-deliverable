"use client";

import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

import { prefersReducedMotion } from "./motion";
import { THEME_STORAGE_KEY } from "./theme-script";

export { THEME_STORAGE_KEY };

function read(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function subscribe(onChange: () => void): () => void {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

/** The current theme. Updates when it changes. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => "dark");
}

/**
 * Fired on window right after data-theme changes, inside the view transition
 * callback: `window.addEventListener("privyus:themechange", (e) => ...)`.
 * `e.detail.theme` is the new theme. Canvases (the globe) that read CSS
 * variables should update their colors synchronously in this handler; the
 * transition waits two short tasks, then captures the next rendered frame.
 * Components that use `useTheme()` re-render in that window too.
 */
export const THEME_CHANGE_EVENT = "privyus:themechange";

/**
 * Rendering is paused inside a view transition callback, and Chromium does not
 * run requestAnimationFrame there. Two short task turns let React commit and
 * run its effects (and the globe update its materials); the canvas then draws
 * in the next rendered frame, before the new state is captured.
 */
const nextTask = () => new Promise<void>((resolve) => setTimeout(resolve, 16));

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => { finished: Promise<void> };
};

/**
 * Switches the theme and saves the choice. With the View Transitions API, the
 * whole page cross-fades once (about 250ms, see globals.css), so the colors,
 * the logo, and the globe change together. Without it, or with reduced
 * motion, the switch is instant with every transition off for that frame.
 */
export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  const apply = () => {
    root.setAttribute("data-theme", theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage can fail (private mode). The theme still applies for this page.
    }
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: { theme } }));
  };

  const doc = document as ViewTransitionDoc;
  const reduced = prefersReducedMotion();
  if (!doc.startViewTransition || reduced) {
    root.classList.add("theme-instant");
    apply();
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theme-instant")));
    return;
  }

  // Hover and other transitions must not run under the snapshot.
  root.classList.add("theme-instant");
  const vt = doc.startViewTransition(async () => {
    apply();
    // Let React re-render and canvases update in the new colors before the capture.
    await nextTask();
    await nextTask();
  });
  vt.finished.finally(() => root.classList.remove("theme-instant"));
}
