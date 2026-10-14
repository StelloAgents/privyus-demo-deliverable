"use client";

/**
 * Which Explore graph renders: "orbit" (the 3D Orbit + Chronos graph, default)
 * or "2d" (the React Flow graph, kept as a safety fallback for a live demo).
 *
 * `?graph=2d` on any URL switches this tab to the 2D graph; `?graph=orbit`
 * switches it back. The choice holds for the tab (sessionStorage), so presenter
 * mode keeps it across page changes. Read once per page load.
 */
export type GraphMode = "orbit" | "2d";

const KEY = "privyus.graph";
let mode: GraphMode | null = null;

export function graphMode(): GraphMode {
  if (mode) return mode;
  if (typeof window === "undefined") return "orbit";
  let m: GraphMode = "orbit";
  try {
    const q = new URLSearchParams(window.location.search).get("graph");
    if (q === "2d" || q === "orbit") window.sessionStorage.setItem(KEY, q);
    m = window.sessionStorage.getItem(KEY) === "2d" ? "2d" : "orbit";
  } catch {
    m = new URLSearchParams(window.location.search).get("graph") === "2d" ? "2d" : "orbit";
  }
  mode = m;
  return m;
}
