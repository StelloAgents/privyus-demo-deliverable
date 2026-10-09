"use client";

import { create } from "zustand";
import { prefersReducedMotion } from "@/lib/motion";
import { isTourActive } from "@/lib/tour";
import { houseStateVotes } from "@/data/votes";
import { SENATE_SEATS } from "./votes";

/**
 * Shared state for the Home hero: the map view, the chamber shown in the seat chart,
 * the state under the pointer (linked between the map and the seat chart), and the
 * open detail card on the map.
 */
export type MapView = "world" | "us";
export type Chamber = "senate" | "house";

export type MapDetail =
  | { kind: "state"; code: string; x: number; y: number }
  | { kind: "arcs"; arcIds: string[]; x: number; y: number };

/** Roll-call order: alphabetical by state. Senate counts seats; House counts states. */
const SENATE_ORDER = [...SENATE_SEATS].sort((a, b) => a.state.localeCompare(b.state) || a.id.localeCompare(b.id)).map((s) => s.id);
const HOUSE_ORDER = houseStateVotes.map((h) => h.state).sort();
export const ROLL_INDEX: Record<string, number> = Object.fromEntries([
  ...SENATE_ORDER.map((id, i) => [`s:${id}`, i]),
  ...HOUSE_ORDER.map((code, i) => [`h:${code}`, i]),
]);
const ROLL_MS = 3000;
/** Presenter mode plays the roll call a little faster. */
const ROLL_MS_PRESENTING = 2600;

/** The map view for each Radar topic: Ukraine aid and the industrial base on the US map, allied coordination on the world. */
export const TOPIC_VIEW: MapView[] = ["us", "us", "world"];
export const TOPIC_KIND = ["vote", "money", "allies"] as const;

interface HomeState {
  mapView: MapView;
  chamber: Chamber;
  hoverState: string | null;
  detail: MapDetail | null;
  /** How many roll-call units (Senate seats or House states) have filled in. */
  rollFilled: number;
  rollTotal: number;
  /** A state whose points pulse once (a live record that names only a state). */
  pulse: { code: string; key: number } | null;
  /** The user is hovering the map: the ambient drift pauses. */
  mapHover: boolean;
  /** The page has loaded (fonts, globe module, first globe frame): content may show. */
  ready: boolean;
  /** The globe drew its first frame with the land built. */
  globeReady: boolean;
  /** The reveal has finished: the skeleton has faded out (once per page load). */
  revealed: boolean;
  setReady: () => void;
  setGlobeReady: () => void;
  /** The text in the Home ask bar. */
  askText: string;
  setAskText: (t: string) => void;
  /** The Radar card's chart tab. */
  radarTab: "vote" | "trend";
  setRadarTab: (t: "vote" | "trend") => void;
  /** The Radar topic (index into the Radar topics). It drives the map. */
  topic: number;
  setTopic: (i: number) => void;
  startRollCall: () => void;
  /** Ends a running roll call at once (all seats filled). */
  completeRollCall: () => void;
  pulseState: (code: string) => void;
  setMapHover: (v: boolean) => void;
  setMapView: (v: MapView) => void;
  setChamber: (c: Chamber) => void;
  setHoverState: (code: string | null) => void;
  setDetail: (d: MapDetail | null) => void;
}

let rollTimer: ReturnType<typeof setInterval> | undefined;

export const useHome = create<HomeState>((set, get) => ({
  // The Radar card opens on "Senate vote", so the map opens on the United States.
  mapView: "us",
  chamber: "senate",
  hoverState: null,
  detail: null,
  rollFilled: SENATE_ORDER.length,
  rollTotal: SENATE_ORDER.length,
  pulse: null,
  mapHover: false,
  ready: false,
  globeReady: false,
  revealed: false,
  setReady: () => {
    if (get().ready) return;
    set({ ready: true });
    // The map's entrance plays after the reveal: the roll call fills (US view).
    // Presenter mode skips it: its steps replay the roll call when they show it.
    if (get().mapView === "us" && !isTourActive()) get().startRollCall();
  },
  setGlobeReady: () => set({ globeReady: true }),
  askText: "",
  setAskText: (askText) => set({ askText }),
  radarTab: "vote",
  setRadarTab: (radarTab) => {
    set({ radarTab });
    // On the Ukraine topic the map follows the chart; other topics keep their own map.
    if (get().topic === 0) get().setMapView(radarTab === "vote" ? "us" : "world");
  },
  topic: 0,
  setTopic: (topic) => {
    set({ topic, detail: null });
    // Each topic picks its map view; a manual switch holds until the next topic change.
    get().setMapView(TOPIC_VIEW[topic] ?? "world");
    if (TOPIC_VIEW[topic] === "us") get().startRollCall();
  },
  startRollCall: () => {
    if (typeof window === "undefined") return;
    const total = get().chamber === "senate" ? SENATE_ORDER.length : HOUSE_ORDER.length;
    if (rollTimer) clearInterval(rollTimer);
    if (prefersReducedMotion()) {
      set({ rollFilled: total, rollTotal: total });
      return;
    }
    set({ rollFilled: 0, rollTotal: total });
    const rollMs = isTourActive() ? ROLL_MS_PRESENTING : ROLL_MS;
    // Time counts only while the tab is visible.
    let elapsed = 0;
    let last = performance.now();
    rollTimer = setInterval(() => {
      const now = performance.now();
      if (!document.hidden) elapsed += now - last;
      last = now;
      const filled = Math.min(total, Math.floor((elapsed / rollMs) * total));
      if (filled !== get().rollFilled) set({ rollFilled: filled });
      if (filled >= total && rollTimer) {
        clearInterval(rollTimer);
        rollTimer = undefined;
      }
    }, 50);
  },
  completeRollCall: () => {
    if (rollTimer) clearInterval(rollTimer);
    rollTimer = undefined;
    const total = get().chamber === "senate" ? SENATE_ORDER.length : HOUSE_ORDER.length;
    set({ rollFilled: total, rollTotal: total });
  },
  pulseState: (code) => set((s) => ({ pulse: { code, key: (s.pulse?.key ?? 0) + 1 } })),
  setMapHover: (mapHover) => set({ mapHover }),
  setMapView: (mapView) => {
    const was = get().mapView;
    set({ mapView, detail: null });
    if (mapView === "us" && was !== "us") get().startRollCall();
  },
  setChamber: (chamber) => {
    set({ chamber, detail: null });
    get().startRollCall();
  },
  setHoverState: (hoverState) => set({ hoverState }),
  setDetail: (detail) => set({ detail }),
}));
