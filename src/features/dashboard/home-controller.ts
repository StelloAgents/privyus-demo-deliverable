"use client";

import { nextEvent } from "@/lib/events";
import { frames, untilAbort } from "@/lib/tour";
import { useHome, type MapView } from "./homeStore";
import { useLive } from "./live";

/**
 * Home controls for presenter mode. Each resolves when its visible result is in
 * place, and stops at once when its signal aborts.
 */

/** The fixed live record of the live step: Aegis Systems PAC → Sen. Ellen Hartley, $18,750. */
const FIXED_RECORD = "fec-hartley";

/** What a presenter step shows on Home. */
export interface HomeView {
  /** Radar topic index (0 Ukraine Aid Package, 1 Defense Industrial Base). */
  topic: number;
  radarTab: "vote" | "trend";
  mapView: MapView;
  /** The open state card on the map, by state code. */
  stateCard: string | null;
  /** The fixed live record is in the activity feed. */
  liveRecord: boolean;
}

const fixedRecordIn = () => useLive.getState().arrivals.some((a) => a.forceArc);

/**
 * Puts `v` in place at once: no roll call, no live arc, an empty ask bar, the
 * full seat chart. Idempotent.
 */
export function applyHomeView(v: HomeView): void {
  const h = useHome.getState();
  const detailCode = h.detail?.kind === "state" ? h.detail.code : null;
  const patch: Partial<ReturnType<typeof useHome.getState>> = {};
  if (h.askText) patch.askText = "";
  if (h.hoverState) patch.hoverState = null;
  if (h.chamber !== "senate") patch.chamber = "senate";
  if (h.topic !== v.topic) patch.topic = v.topic;
  if (h.radarTab !== v.radarTab) patch.radarTab = v.radarTab;
  if (h.mapView !== v.mapView) patch.mapView = v.mapView;
  if (detailCode !== v.stateCard || (h.detail && h.detail.kind !== "state")) {
    patch.detail = v.stateCard ? { kind: "state", code: v.stateCard, x: 0, y: 0 } : null;
  }
  if (Object.keys(patch).length) useHome.setState(patch);
  if (h.rollFilled < h.rollTotal || h.chamber !== "senate") useHome.getState().completeRollCall();
  if (v.liveRecord && !fixedRecordIn()) useLive.getState().inject(FIXED_RECORD, { silent: true });
  if (!v.liveRecord) useLive.getState().clearInjected();
}

/** Switches the map view; resolves when the camera flight has ended (at once when there is none). */
export async function setMapView(view: MapView, signal: AbortSignal): Promise<void> {
  if (useHome.getState().mapView === view) return;
  const landed = nextEvent("map-flight-done", { signal, timeoutMs: 1500 });
  useHome.getState().setMapView(view);
  useHome.getState().completeRollCall();
  await landed;
}

/** Switches the Radar topic (the map follows). The full chart shows at once; no roll call runs. */
export async function setTopic(topic: number, signal: AbortSignal): Promise<void> {
  const h = useHome.getState();
  if (h.topic === topic) return;
  const flies = h.mapView !== (topic === 2 ? "world" : "us");
  const landed = flies ? nextEvent("map-flight-done", { signal, timeoutMs: 1500 }) : Promise.resolve(true);
  h.setTopic(topic);
  useHome.getState().completeRollCall();
  await landed;
}

export async function setRadarTab(tab: "vote" | "trend", signal: AbortSignal): Promise<void> {
  const h = useHome.getState();
  if (h.radarTab === tab) return;
  const flies = h.topic === 0;
  const landed = flies ? nextEvent("map-flight-done", { signal, timeoutMs: 1500 }) : Promise.resolve(true);
  h.setRadarTab(tab);
  await landed;
}

/** Replays the roll call; resolves when every seat has filled. On abort, the chart fills at once. */
export async function rollCall(signal: AbortSignal): Promise<void> {
  useHome.getState().startRollCall();
  const full = () => useHome.getState().rollFilled >= useHome.getState().rollTotal;
  if (!full()) {
    await untilAbort(
      new Promise<void>((resolve) => {
        const off = useHome.subscribe(() => {
          if (!full()) return;
          off();
          resolve();
        });
      }),
      signal,
    );
  }
  if (signal.aborted) useHome.getState().completeRollCall();
}

/** Opens the state card on the map. */
export async function openStateCard(code: string): Promise<void> {
  useHome.getState().setDetail({ kind: "state", code, x: 0, y: 0 });
  await frames(2);
}

export function closeStateCard(): void {
  useHome.getState().setDetail(null);
}

/** The fixed live record arrives now: an activity row and its arc. Resolves when the arc has drawn. */
export async function triggerLiveRecord(signal: AbortSignal): Promise<void> {
  const drawn = nextEvent("arc-drawn", { signal, timeoutMs: 2000 });
  useLive.getState().inject(FIXED_RECORD);
  await drawn;
}
