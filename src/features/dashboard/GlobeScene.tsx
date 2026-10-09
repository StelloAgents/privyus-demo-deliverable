"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef, useState } from "react";
import { emit } from "@/lib/events";
import * as THREE from "three";
import ThreeGlobe from "three-globe";
import { THEME_CHANGE_EVENT, type Theme } from "@/lib/theme";
import { VIEW_CENTER, placesFor, type GlobeArc, type GlobePlace } from "./globe-data";
import type { UsArc } from "./usLinks";
import { STATE_PATHS, stateAt } from "./usStates";
import land from "./world-land.json";

/** Colors come from the CSS tokens, so the globe follows the theme. */
interface Palette {
  surface1: string;
  surface2: string;
  teal: string;
  tealBright: string;
  orange: string;
  text3: string;
  text2: string;
  border: string;
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    surface1: v("--surface-1", "#171c21"),
    surface2: v("--surface-2", "#1e242a"),
    teal: v("--teal", "#598b97"),
    tealBright: v("--teal-bright", "#7fb6c2"),
    orange: v("--orange", "#f89b45"),
    text3: v("--text-3", "#7d8990"),
    text2: v("--text-2", "#adb7bd"),
    border: v("--border", "#dce2e6"),
  };
}

/** "#7fb6c2" + 0.4 into "rgba(127,182,194,0.4)" (three-globe reads rgba alpha). */
function rgba(hex: string, alpha: number): string {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${alpha})`;
}

type ArcDatum = GlobeArc | UsArc | { startLat: number; startLng: number; endLat: number; endLng: number };
/** Light-mode land dots: a pale gray-blue, like a print map. */
const LIGHT_LAND = "#B9C4CB";
const isUsArc = (d: ArcDatum): d is UsArc => "tone" in d;
const isStoryArc = (d: ArcDatum): d is GlobeArc => "tooltip" in d;

const DEG = Math.PI / 180;
/** Sway around the view center. Peak speed matches one turn per 60s (6 degrees per second). */
const SWAY_AMPLITUDE = 34 * DEG;
const SWAY_PERIOD_S = (2 * Math.PI * 34) / 6;
const RESUME_AFTER_MS = 3000;
/** In "crop" framing the sway stays small, so the record band stays in view. */
const SWAY_CROP = 6 * DEG;
const SWAY_US = 3 * DEG;

export interface GlobeHover {
  text: string;
  /** Set in the US view when the pointer is over a state (not a marker). */
  state?: string;
  href?: string;
  /** Set when the pointer is on one arc. */
  arcId?: string;
  /** The arcs behind the hovered arc or city (for the detail card). */
  arcIds?: string[];
}

/** A DOM marker that rides on the globe (for example, one Senate seat). */
export interface GlobeMarker {
  id: string;
  lat: number;
  lng: number;
  node: React.ReactNode;
  /** Keep the marker inside the canvas (for wide labels). */
  clamp?: boolean;
}

export type GlobeView = "world" | "us";

export interface GlobeSceneProps {
  theme: Theme;
  reduced: boolean;
  paused: boolean;
  /** The arcs to draw. Keep the objects stable: a new object draws in as a new arc. */
  arcs: GlobeArc[];
  /** One arc to highlight (the others dim), for example from a hovered list row. */
  highlightId?: string | null;
  /**
   * "fit": the whole sphere fits with a margin.
   * "crop": a large sphere, cropped on purpose by the bottom and right edges (the Home hero).
   */
  framing?: "fit" | "crop";
  /** "us": the camera flies to the United States and the arcs give way to the markers. */
  view?: GlobeView;
  markers?: GlobeMarker[];
  /** Connections drawn in the US view. */
  usArcs?: UsArc[];
  /** Called once, after the first frame drawn with the land built (the page reveal waits for it). */
  onFirstFrame?: () => void;
  /** Pause the ambient drift (the user hovers the map or reads a card). */
  holdDrift?: boolean;
  onHover: (hover: GlobeHover | null) => void;
}

/** Crop framing per view: sphere center (share of width / height), radius (share of height), and the facing point. */
interface Frame {
  cx: number;
  cy: number;
  r: number;
  lat: number;
  lng: number;
}
const FRAMES: Record<GlobeView, Frame> = {
  world: { cx: 0.56, cy: 1.02, r: 0.96, lat: 20, lng: -16 },
  us: { cx: 0.5, cy: 0.62, r: 1.25, lat: 38, lng: -95 },
};
const FLIGHT_MS = 900;
/** A narrow field of view keeps the cropped sphere close to round. */
const CROP_FOV = 14;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface FrameState {
  cur: Frame;
  from: Frame;
  to: Frame;
  start: number;
}

const EMPTY_PLACES: GlobePlace[] = [];

/** Display names for the city labels. */
const LABEL_NAME: Record<string, string> = { Washington: "Washington DC" };

function applyColors(
  globe: ThreeGlobe,
  p: Palette,
  theme: Theme,
  highlightId?: string | null,
  hotPlace?: string,
  framing: "fit" | "crop" = "fit",
): number {
  const light = theme === "light";
  const crop = framing === "crop";
  const landAlpha = light ? (crop ? 0.85 : 0.6) : crop ? 0.8 : 0.48;
  // The atmosphere: created once; later theme changes only set its color uniform
  // (a new color or size through the setters would rebuild the mesh and recompile its shader).
  const glow = light ? p.border : p.teal;
  let atmosphere: (THREE.Mesh & { material: THREE.ShaderMaterial }) | null = null;
  globe.traverse((o) => {
    if ((o as THREE.Object3D & { __globeObjType?: string }).__globeObjType === "atmosphere") atmosphere = o as typeof atmosphere;
  });
  if (atmosphere) {
    (atmosphere as THREE.Mesh & { material: THREE.ShaderMaterial }).material.uniforms.color.value.set(glow);
  } else {
    globe.atmosphereColor(glow).atmosphereAltitude(crop ? 0.12 : 0.16);
  }
  globe
    // Land: dense teal dots, clearly readable; the ocean stays dark.
    // Light mode reads like a print graphic: small, pale, sparser land dots and a white ocean.
    .hexPolygonColor(() => rgba(light ? LIGHT_LAND : p.tealBright, landAlpha))

    .arcColor((d: object) => {
      const a = d as ArcDatum;
      if (isUsArc(a)) {
        // US connections: money (FEC) in teal-bright, lobbying and FARA contacts in text-2.
        const c = a.tone === "money" ? (light ? p.teal : p.tealBright) : p.text2;
        return a.faint ? rgba(c, light ? 0.4 : 0.32) : [rgba(c, 0.4), c];
      }
      if (!isStoryArc(a)) return rgba(p.teal, light ? 0.35 : 0.28);
      const dim = !!highlightId && a.id !== highlightId;
      const c = a.latest ? p.orange : light ? p.teal : p.tealBright;
      if (dim) return rgba(c, 0.1);
      // The hovered arc is solid along its length, so it reads brighter than the rest.
      if (highlightId && a.id === highlightId) return c;
      return [rgba(c, 0.35), c];
    })
    // The end point of the newest arc is the bright orange one.
    .pathColor(() => (light ? rgba(p.text3, 0.45) : rgba(p.tealBright, 0.28)))
    .pointColor((d: object) => ((d as GlobePlace).name === hotPlace ? p.orange : light ? p.teal : p.tealBright))
    .pointRadius((d: object) => ((d as GlobePlace).name === hotPlace ? (crop ? 0.9 : 1.05) : crop ? 0.55 : 0.7));
  const mat = globe.globeMaterial() as THREE.MeshPhongMaterial;
  // The ocean: darker than the panel in dark mode, so the land dots stand out.
  const ocean = crop && !light ? new THREE.Color(p.surface1).multiplyScalar(0.7) : new THREE.Color(light ? p.surface1 : p.surface2);
  mat.color.copy(ocean);
  mat.emissive.copy(ocean);
  // Light mode: a flat white sphere (no shading haze at the rim).
  mat.emissiveIntensity = light ? 1 : crop ? 0.5 : 0.25;
  mat.shininess = 4;
  mat.transparent = true;
  mat.opacity = light ? 1 : 0.94;
  return landAlpha;
}

/** A small stable hash, so each arc's dash starts at its own offset. */
function hashOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Arc width: the hovered arc is clearly thicker than the rest. */
function strokeOf(a: ArcDatum, highlightId: string | null | undefined, framing: "fit" | "crop" = "fit"): number | null {
  if (isUsArc(a)) return a.faint ? 0.22 : a.solid ? 0.36 : 0.42;
  if (!isStoryArc(a)) return null;
  const k = framing === "crop" ? 0.34 : 1;
  if (highlightId && a.id === highlightId) return 1.7 * k * (framing === "crop" ? 1.6 : 1);
  return (a.latest ? 1.05 : 0.85) * k;
}

/** Arcs with a moving dash: the story arcs and the live US connections (not the faint ones). */
const moving = (a: ArcDatum) => isStoryArc(a) || (isUsArc(a) && !a.faint && !a.solid);

function createGlobe(reduced: boolean, framing: "fit" | "crop" = "fit"): ThreeGlobe {
  // Up close ("crop"), low arcs stay over the land they connect.
  const crop = framing === "crop";
  const g = new ThreeGlobe({ animateIn: false })
    .showGlobe(true)
    .showAtmosphere(true)
    .hexPolygonsData((land as { features: object[] }).features)
    // Denser land dots up close, so the coastlines read.
    .hexPolygonResolution(crop ? 4 : 3)
    // One margin in both themes: a margin change rebuilds every land mesh (a theme switch must only recolor).
    .hexPolygonMargin(crop ? 0.56 : 0.62)
    .hexPolygonUseDots(true)
    .hexPolygonsTransitionDuration(0)
    .arcStroke((d: object) => strokeOf(d as ArcDatum, null, framing))
    // Up close ("crop"), the arcs hug the surface.
    .arcAltitude((d: object) => (isUsArc(d as ArcDatum) ? 0.05 : crop ? (isStoryArc(d as ArcDatum) ? 0.16 : 0.1) : null))
    .arcAltitudeAutoScale((d: object) => (isStoryArc(d as ArcDatum) ? 0.42 : 0.18))
    .arcDashLength((d: object) => (moving(d as ArcDatum) && !reduced ? 0.42 : 1))
    .arcDashGap((d: object) => (moving(d as ArcDatum) && !reduced ? 0.18 : 0))
    .arcDashInitialGap((d: object) => (isStoryArc(d as ArcDatum) ? (hashOf((d as GlobeArc).id) % 7) * 0.13 : 0))
    .arcDashAnimateTime((d: object) => (moving(d as ArcDatum) && !reduced ? (isUsArc(d as ArcDatum) ? 1400 : 2600) : 0))
    .arcsTransitionDuration(reduced ? 0 : 1100)
    .pointLat("lat")
    .pointLng("lng")
    .pointAltitude(0.012)
    .pointRadius(0.7)
    .pointsMerge(false)
    .pointsTransitionDuration(0)
    .pathPoints("points")
    .pathPointLat((p: [number, number]) => p[0])
    .pathPointLng((p: [number, number]) => p[1])
    .pathPointAlt(0.002)
    .pathStroke(null)
    .pathResolution(1)
    .pathTransitionDuration(0);
  return g;
}

/**
 * One globe per (reduced, framing), kept for the whole session: building the
 * land mesh is the costly part of opening Home (about 0.6s), so a return to
 * Home reuses it. Its data and colors are set again on each mount.
 */
const globeCache = new Map<string, ThreeGlobe>();
function sharedGlobe(reduced: boolean, framing: "fit" | "crop"): ThreeGlobe {
  const key = `${reduced}|${framing}`;
  let g = globeCache.get(key);
  if (!g) globeCache.set(key, (g = createGlobe(reduced, framing)));
  return g;
}

/** Walk up from a hit mesh to the three-globe object that carries the datum. */
function datumOf(obj: THREE.Object3D | null): { type: string; data: unknown } | null {
  let o: (THREE.Object3D & { __globeObjType?: string; __data?: unknown }) | null = obj;
  while (o) {
    if (o.__globeObjType === "arc" || o.__globeObjType === "point") return { type: o.__globeObjType, data: o.__data };
    o = o.parent;
  }
  return null;
}

function pick(e: ThreeEvent<PointerEvent>, all: GlobeArc[]): GlobeHover | null {
  for (const hit of e.intersections) {
    const d = datumOf(hit.object);
    if (!d) continue;
    if (d.type === "arc" && d.data && isStoryArc(d.data as ArcDatum)) {
      const a = d.data as GlobeArc;
      return { text: a.tooltip, href: a.href, arcId: a.id, arcIds: [a.id] };
    }
    if (d.type === "point" && d.data) {
      const p = d.data as GlobePlace;
      const arcs = all.filter((a) => p.arcIds.includes(a.id)).sort((a, b) => b.date.localeCompare(a.date));
      if (!arcs.length) continue;
      return { text: arcs.map((a) => a.tooltip).join("\n"), href: arcs[0].href, arcIds: arcs.map((a) => a.id) };
    }
  }
  return null;
}

/**
 * "fit": keeps the whole globe in view. "crop": a view offset puts the sphere's center at
 * the frame cx/cy of the canvas with radius r of its height, so the edges crop it.
 */
function CameraFit({ framing, frame }: { framing: "fit" | "crop"; frame: React.RefObject<FrameState> }) {
  const { camera, size } = useThree();
  const getState = useThree((s) => s.get);
  const apply = () => {
    // Read the camera from the store: three.js cameras are mutable objects by design.
    const cam = getState().camera as THREE.PerspectiveCamera;
    const W = Math.max(1, size.width);
    const H = Math.max(1, size.height);
    const f = frame.current.cur;
    const cx = f.cx * W;
    const cy = f.cy * H;
    const fullW = 2 * Math.max(cx, W - cx);
    const fullH = 2 * Math.max(cy, H - cy);
    const rPx = f.r * H;
    // A narrow field of view keeps the cropped sphere close to round (little perspective).
    cam.fov = CROP_FOV;
    cam.aspect = fullW / fullH;
    cam.setViewOffset(fullW, fullH, fullW / 2 - cx, fullH / 2 - cy, W, H);
    // Pixels per world unit at the sphere center: fullH / (2 d tan(fov/2)). Radius 100 maps to rPx.
    const dist = (100 * fullH) / (rPx * 2 * Math.tan((cam.fov / 2) * DEG));
    cam.position.setLength(dist);
    cam.updateProjectionMatrix();
  };
  useEffect(() => {
    if (framing === "crop") apply();
  });
  // Every frame: the framing eases during a flight, and R3F resets the aspect on resize.
  useFrame(() => {
    if (framing === "crop") apply();
  });
  useEffect(() => {
    if (framing === "crop") return;
    const cam = camera as THREE.PerspectiveCamera;
    cam.clearViewOffset();
    const aspect = size.width / Math.max(1, size.height);
    const fit = 2 * Math.tan((cam.fov / 2) * DEG) * Math.min(1, aspect);
    // The whole sphere and its atmosphere (radius ~118) fit with a margin.
    const dist = (2 * 118) / (0.88 * fit);
    cam.position.setLength(dist);
    cam.updateProjectionMatrix();
  }, [camera, size, framing]);
  return null;
}

const LABEL_SHIFT = {
  left: "translate(calc(-100% - 8px), -50%)",
  right: "translate(8px, -50%)",
  top: "translate(-50%, calc(-100% - 6px))",
  bottom: "translate(-50%, 6px)",
  bottomRight: "translate(6px, 4px)",
  bottomLeft: "translate(calc(-100% - 4px), 4px)",
};

/** Where each city label sits next to its point, so close cities do not overlap. */
const LABEL_SIDE: Record<string, keyof typeof LABEL_SHIFT> = {
  // Arcs arrive from the west and above, so labels sit below or beside the points.
  Washington: "left",
  Kyiv: "bottomRight",
  Warsaw: "top",
  Brussels: "bottomLeft",
  Tallinn: "right",
};

/**
 * Projects the city anchors to the screen each frame and moves the DOM labels there
 * (plain DOM, no extra React roots). Labels fade out on the far side of the globe.
 */
function LabelProjector({
  globe,
  places,
  labels,
}: {
  globe: ThreeGlobe;
  places: GlobePlace[];
  labels: React.RefObject<(HTMLDivElement | null)[]>;
}) {
  const anchors = useMemo(
    () =>
      places.map((p) => {
        const c = globe.getCoords(p.lat, p.lng, 0.02);
        return new THREE.Vector3(c.x, c.y, c.z);
      }),
    [globe, places],
  );
  const world = useMemo(() => new THREE.Vector3(), []);
  const normal = useMemo(() => new THREE.Vector3(), []);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    anchors.forEach((a, i) => {
      const el = labels.current?.[i];
      if (!el) return;
      world.copy(a).applyMatrix4(globe.matrixWorld);
      normal.copy(world).normalize();
      toCam.copy(camera.position).sub(world).normalize();
      const facing = normal.dot(toCam);
      world.project(camera);
      const x = ((world.x + 1) / 2) * size.width;
      const y = ((1 - world.y) / 2) * size.height;
      const side = LABEL_SIDE[places[i].name] ?? "right";
      // Keep the label inside the canvas with 12px padding.
      const w = el.offsetWidth;
      const left = side === "left" ? x - w - 8 : side === "bottomLeft" ? x - w - 4 : side === "top" || side === "bottom" ? x - w / 2 : x + 8;
      const dx = Math.max(0, 12 - left) - Math.max(0, left + w - (size.width - 12));
      el.style.transform = `translate(${(x + dx).toFixed(1)}px, ${y.toFixed(1)}px) ${LABEL_SHIFT[side]}`;
      el.style.opacity = String(Math.max(0, Math.min(1, (facing - 0.05) * 5)));
    });
  });
  return null;
}

/** Moves each DOM marker to its point on the globe every frame; hidden on the far side. */
const markerEls = new Map<string, HTMLElement>();
function MarkerProjector({ globe, markers }: { globe: ThreeGlobe; markers?: GlobeMarker[] }) {
  const anchors = useMemo(
    () =>
      (markers ?? []).map((m) => {
        const c = globe.getCoords(m.lat, m.lng, 0.006);
        return { id: m.id, v: new THREE.Vector3(c.x, c.y, c.z) };
      }),
    [globe, markers],
  );
  const world = useMemo(() => new THREE.Vector3(), []);
  const normal = useMemo(() => new THREE.Vector3(), []);
  const toCam = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, size }) => {
    for (const a of anchors) {
      const el = markerEls.get(a.id);
      if (!el) continue;
      world.copy(a.v).applyMatrix4(globe.matrixWorld);
      normal.copy(world).normalize();
      toCam.copy(camera.position).sub(world).normalize();
      const facing = normal.dot(toCam);
      world.project(camera);
      const x = ((world.x + 1) / 2) * size.width;
      const y = ((1 - world.y) / 2) * size.height;
      let cx = x;
      if (el.dataset.clamp) {
        const half = el.offsetWidth / 2 + 32; // at least 32px from the panel edges
        cx = Math.max(half, Math.min(size.width - half, x));
      }
      el.style.transform = `translate(${cx.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
      el.style.visibility = facing > 0.15 ? "visible" : "hidden";
    }
  });
  return null;
}

function GlobeObject({
  theme,
  reduced,
  paused,
  onHover,
  onFirstFrame,
  arcs,
  usArcs,
  holdDrift,
  markers,
  highlightId,
  framing = "fit",
  places,
  labels,
  view = "world",
  frame,
}: GlobeSceneProps & {
  places: GlobePlace[];
  labels: React.RefObject<(HTMLDivElement | null)[]>;
  frame: React.RefObject<FrameState>;
}) {
  const globe = useMemo(() => sharedGlobe(reduced, framing), [reduced, framing]);

  // Data: a new arc object draws in with the arc transition; existing arcs stay.
  useEffect(() => {
    globe.arcsData(view === "us" ? (usArcs ?? []) : arcs).pointsData(view === "us" ? [] : places);
    // Faint state borders in the US view, so the seat pairs read as states.
    globe.pathsData(view === "us" ? STATE_PATHS : []);
  }, [globe, arcs, usArcs, places, view]);

  // In the US view the land dots step back, so the vote markers lead. The fade runs with the flight.
  const landFade = useRef({ from: 1, to: 1, start: 0 });
  const landAlpha = useRef(1);
  const recolorFrames = useRef(0);
  useEffect(() => {
    const f = landFade.current;
    const now = performance.now();
    const k = Math.min(1, (now - f.start) / FLIGHT_MS);
    f.from = f.from + (f.to - f.from) * k;
    f.to = view === "us" ? 0.38 : 1;
    f.start = now;
  }, [view]);
  useFrame(() => {
    const f = landFade.current;
    const k = reduced ? 1 : Math.min(1, (performance.now() - f.start) / FLIGHT_MS);
    // After a recolor, re-apply the fade for a few frames (three-globe resets the opacity on its next update).
    const settling = recolorFrames.current > 0;
    if (settling) recolorFrames.current -= 1;
    if (k >= 1 && f.from === f.to && !settling) return;
    const o = f.from + (f.to - f.from) * k;
    const base = landAlpha.current;
    globe.traverse((obj) => {
      const o3 = obj as THREE.Mesh & { __globeObjType?: string };
      if (o3.__globeObjType !== "hexPolygon") return;
      const mats = Array.isArray(o3.material) ? o3.material : [o3.material];
      for (const m of mats) {
        if (!m) continue;
        m.transparent = true;
        m.opacity = base * o;
      }
    });
    if (k >= 1) f.from = f.to;
  });
  const tilt = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const clock = useRef(0);
  const ampRef = useRef(0);
  const speedRef = useRef(1);
  const dragging = useRef(false);
  const resumeAt = useRef(0);
  const [palette, setPalette] = useState<Palette | null>(null);

  // Theme: recolor the existing globe in place. Nothing is re-created, so nothing jumps.
  // Recolor in place (no geometry rebuild). On a theme switch this runs synchronously in the
  // theme-change event, so the view transition captures the new globe colors in its new frame.
  const recolor = useRef<(t: Theme) => void>(() => {});
  useEffect(() => {
    recolor.current = (t: Theme) => {
    const start = performance.now();
    const p = readPalette();
    landAlpha.current = applyColors(globe, p, t, highlightId, arcs.find((a) => a.latest)?.to, framing);
    recolorFrames.current = 12;
    globe.arcStroke((d: object) => strokeOf(d as ArcDatum, highlightId, framing));
    setPalette(p);
    (window as unknown as { __recolorMs?: number }).__recolorMs = Math.round(performance.now() - start);
    };
    recolor.current(theme);
  }, [globe, theme, highlightId, arcs, framing]);
  useEffect(() => {
    const on = (e: Event) => recolor.current(((e as CustomEvent).detail?.theme as Theme) ?? theme);
    window.addEventListener(THEME_CHANGE_EVENT, on);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, on);
  }, [theme]);

  useEffect(() => {
    if (paused) globe.pauseAnimation();
    else globe.resumeAnimation();
  }, [globe, paused]);

  // The globe is shared across mounts (sharedGlobe): it is never destroyed.

  // First-frame signal: wait until the land mesh exists, then two more frames.
  const firstFrame = useRef({ seen: 0, done: false });
  useFrame(() => {
    const f = firstFrame.current;
    if (f.done) return;
    if (!f.seen) {
      let land = false;
      globe.traverse((o) => {
        if ((o as THREE.Object3D & { __globeObjType?: string }).__globeObjType === "hexPolygon") land = true;
      });
      if (!land) return;
    }
    f.seen += 1;
    if (f.seen >= 3) {
      f.done = true;
      onFirstFrame?.();
    }
  });
  const zAxis = useMemo(() => new THREE.Vector3(0, 0, 1), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  /** The flight (by start time) whose end was announced. */
  const flightDone = useRef(-1);
  useFrame(({ camera }, dt) => {
    if (!spin.current || !tilt.current) return;
    const fs = frame.current;
    // Ease the framing toward the target view (a cut under reduced motion).
    const k = reduced ? 1 : Math.min(1, (performance.now() - fs.start) / FLIGHT_MS);
    const e = easeInOut(k);
    const flying = k < 1;
    if (!flying && flightDone.current !== fs.start) {
      flightDone.current = fs.start;
      emit("map-flight-done");
    }
    (Object.keys(fs.cur) as (keyof Frame)[]).forEach((key) => {
      fs.cur[key] = fs.from[key] + (fs.to[key] - fs.from[key]) * e;
    });
    if (flying || view === "us") {
      // Bring a dragged camera back to the front during the flight.
      const len = camera.position.length();
      dir.copy(camera.position).normalize().lerp(zAxis, flying ? Math.min(1, dt * 6) : 1).normalize();
      camera.position.copy(dir.multiplyScalar(len));
    }
    const center = framing === "crop" ? fs.cur : VIEW_CENTER;
    tilt.current.rotation.x = center.lat * DEG;
    // A slow drift in both views (smaller over the US). It pauses while held (hover, a card, a drag).
    // Hover or an open card slows the drift to 15% (eased over ~600ms in, ~800ms out); a drag stops it.
    const stopped = dragging.current || performance.now() < resumeAt.current;
    const speedTarget = holdDrift ? 0.15 : 1;
    const rate = speedTarget < speedRef.current ? 1 / 0.6 : 1 / 0.8;
    const stepK = Math.min(1, dt * rate * 2.2);
    speedRef.current += (speedTarget - speedRef.current) * stepK;
    const target = reduced ? 0 : view === "us" ? SWAY_US : framing === "crop" ? SWAY_CROP : SWAY_AMPLITUDE;
    ampRef.current += (target - ampRef.current) * Math.min(1, dt * 1.5);
    if (!stopped && !reduced) clock.current += Math.min(dt, 0.1) * speedRef.current;
    const sway = ampRef.current * Math.sin((2 * Math.PI * clock.current) / SWAY_PERIOD_S);
    spin.current.rotation.y = -center.lng * DEG + sway;
  });

  const local = useMemo(() => new THREE.Vector3(), []);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (view === "us") {
      // The state under the pointer, from the first hit on the sphere.
      const hitGlobe = e.intersections[0];
      if (!hitGlobe) return onHover(null);
      local.copy(hitGlobe.point);
      globe.worldToLocal(local);
      const g = globe.toGeoCoords({ x: local.x, y: local.y, z: local.z });
      const code = stateAt(g.lat, g.lng);
      onHover(code ? { text: code, state: code } : null);
      return;
    }
    const hit = pick(e, arcs);
    onHover(hit);
  };


  return (
    <>
      <ambientLight intensity={2.2} />
      <directionalLight position={[-200, 160, 260]} intensity={1.1} />
      {palette ? <color attach="background" args={[palette.surface1]} /> : null}
      <group ref={tilt} rotation={[(framing === "crop" ? frame.current.cur.lat : VIEW_CENTER.lat) * DEG, 0, 0]}>
        <group ref={spin} rotation={[0, -(framing === "crop" ? frame.current.cur.lng : VIEW_CENTER.lng) * DEG, 0]}>
          <primitive object={globe} onPointerMove={onMove} onPointerOut={() => onHover(null)} />
        </group>
      </group>
      <LabelProjector globe={globe} places={places} labels={labels} />
      <MarkerProjector globe={globe} markers={markers} />
      <OrbitControls
        enabled={view === "world"}
        enableZoom={false}
        enablePan={false}
        enableDamping
        rotateSpeed={0.45}
        minPolarAngle={Math.PI / 2 - 0.55}
        maxPolarAngle={Math.PI / 2 + 0.55}
        onStart={() => {
          dragging.current = true;
        }}
        onEnd={() => {
          dragging.current = false;
          resumeAt.current = performance.now() + RESUME_AFTER_MS;
        }}
      />
    </>
  );
}

/** The globe scene. Load it with next/dynamic (ssr: false): WebGL needs the browser. */
export default function GlobeScene(props: GlobeSceneProps) {
  const light = props.theme === "light";
  const labels = useRef<(HTMLDivElement | null)[]>([]);
  const view = props.view ?? "world";
  const allPlaces = useMemo(() => placesFor(props.arcs), [props.arcs]);
  const places = view === "us" ? EMPTY_PLACES : allPlaces;
  const frame = useRef<FrameState>({ cur: { ...FRAMES[view] }, from: { ...FRAMES[view] }, to: { ...FRAMES[view] }, start: 0 });
  useEffect(() => {
    const f = frame.current;
    f.from = { ...f.cur };
    f.to = { ...FRAMES[view] };
    f.start = performance.now();
  }, [view]);
  return (
    <>
      <Canvas
        flat
        dpr={[1, 1.75]}
        frameloop={props.paused ? "never" : "always"}
        camera={{ fov: 34, near: 1, far: 2000, position: [0, 0, 420] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        className="!absolute inset-0"
      >
        <CameraFit framing={props.framing ?? "fit"} frame={frame} />
        <GlobeObject {...props} places={places} labels={labels} frame={frame} />
        {/* Bloom picks up only bright things (arcs, city points, the rim). Off in light mode, so it never washes out. */}
        {/* Always mounted (a theme switch must not rebuild the pipeline); off in light mode by intensity 0. */}
        <EffectComposer multisampling={0} frameBufferType={THREE.UnsignedByteType}>
          <Bloom mipmapBlur luminanceThreshold={0.4} luminanceSmoothing={0.2} intensity={light ? 0 : 0.55} radius={0.5} />
        </EffectComposer>
      </Canvas>
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        {places.map((p, i) => (
          <div
            key={p.name}
            ref={(el) => {
              labels.current[i] = el;
            }}
            className={
              props.framing === "crop"
                ? "absolute top-0 left-0 text-[13px] leading-4 font-medium whitespace-nowrap text-fg-1"
                : "t-meta absolute top-0 left-0 whitespace-nowrap text-fg-2"
            }
            style={{ opacity: 0 }}
          >
            {LABEL_NAME[p.name] ?? p.name}
          </div>
        ))}
      </div>
      {props.markers?.length ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {props.markers.map((m) => (
            <div
              key={m.id}
              ref={(el) => {
                if (el) markerEls.set(m.id, el);
                else markerEls.delete(m.id);
              }}
              data-clamp={m.clamp ? "1" : undefined}
              className="pointer-events-auto absolute top-0 left-0"
              style={{ visibility: "hidden" }}
            >
              {m.node}
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
