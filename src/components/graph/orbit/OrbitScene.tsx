"use client";

import { CameraControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { graphMotion } from "@/lib/graph-motion";
import { registerEdgeSampler, type EdgePoint } from "@/lib/graph-scene";
import { easeOutExpo } from "@/lib/motion";
import type { BuildCue } from "@/lib/store";
import { THEME_CHANGE_EVENT } from "@/lib/theme";
import { CLOCK_START, CLOCK_SWEEP, angleOfDay, monthOfDay, monthStart, type RingKey, RING_ORDER } from "../orbit-layout";
import type { OrbitBridge } from "./bridge";
import { BUILD, DEFAULT_STEP_MS, sweepAt, sweepFraction, sweepMsFor, sweepPassMs } from "./build";
import type { EdgeTier, OrbitView, Tier, ViewEdge, ViewNode } from "./model";
import { timeStore, timeVisibility } from "./time";

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

interface Palette {
  light: boolean;
  bg: THREE.Color;
  teal: THREE.Color;
  tealBright: THREE.Color;
  orange: THREE.Color;
  text3: THREE.Color;
  fill: THREE.Color;
  fillMajor: THREE.Color;
  fillCenter: THREE.Color;
}

/** Reads the theme tokens once (on mount and on a theme change), never per frame. */
function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => new THREE.Color(s.getPropertyValue(name).trim() || fallback);
  const light = document.documentElement.getAttribute("data-theme") === "light";
  const bg = v("--bg", "#101418");
  const teal = v("--teal", "#598b97");
  const base = light ? v("--surface-1", "#ffffff") : v("--surface-3", "#262d34");
  return {
    light,
    bg,
    teal,
    tealBright: v("--teal-bright", "#7fb6c2"),
    orange: v("--orange", "#f89b45"),
    text3: v("--text-3", "#7d8990"),
    // Matte node fills: the surface steps, tinted toward the brand teal.
    fill: base.clone().lerp(teal, light ? 0.34 : 0.22),
    fillMajor: base.clone().lerp(teal, light ? 0.5 : 0.42),
    fillCenter: light ? base.clone().lerp(teal, 0.22) : base.clone().lerp(v("--text-2", "#adb7bd"), 0.25),
  };
}

/** HDR color: only these values pass the bloom threshold (selective bloom on the orange path). */
const hdr = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

/* ------------------------------------------------------------------ */
/* Motion                                                              */
/* ------------------------------------------------------------------ */

/** Recenter: every node travels to its new place (DESIGN.md section 6, orbit graph). */
export const RECENTER_MS = 1000;
/** A new node grows out of its parent. */
const ENTER_MS = 640;
const STAGGER_MS = 40;
/** The note, its marker, and the dial stretch fade in once the graph is at rest. */
const MARK_FADE_MS = 240;
const SEG = 24;
/** Segments of a ring stroke. */
const RING_SEGS = 256;
const BEZIER_LIFT = 0.07;
const POLAR = (52 * Math.PI) / 180;
const FOV = 28;

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

interface NodeAnim {
  from: THREE.Vector3;
  to: THREE.Vector3;
  cur: THREE.Vector3;
  start: number;
  delay: number;
  dur: number;
  /** Grows in (scale from 0) instead of travelling only. */
  appear: boolean;
  /** 0..1: how far the node has grown in (edges draw with it). */
  grow: number;
  /** 0..1: window and playback filter (smoothed). */
  range: number;
  /** The final visibility: grow and range. */
  vis: number;
  /** Displayed scale (smoothed toward the target, so a press or a tier change eases). */
  scale: number;
  opacity: number;
  /** The scale it grows in from (a fraction of its size). */
  s0: number;
  /** Its label or card fades in from this time. */
  labelAt: number;
  /** A build phase held for a later reasoning step: it starts when that step's cue arrives. */
  phase?: { key: string; step: number };
  /** The tier it showed in the last view. */
  tier: Tier;
  /** A record that opens on its ring keeps its old look (tier and size) until the sweep passes it. */
  tierFrom?: Tier;
  radiusFrom?: number;
  tierAt: number;
  /** Its radius in the last view. */
  radius: number;
}

interface RingAnim {
  r: number;
  rFrom: number;
  rTo: number;
  op: number;
  start: number;
  /** The stroke draws itself clockwise from the clock origin (-Infinity: drawn). */
  sweepStart: number;
  sweepDur: number;
}

/** An edge that grows from the center to its record (Establish connections). */
interface EdgeAnim {
  /** The phase start (moves to the cue's arrival), plus this edge's place in the date order. */
  base: number;
  offset: number;
  /** Never before its record has landed. */
  min: number;
  dur: number;
  phase?: { key: string; step: number };
}

interface Anim {
  nodes: Map<string, NodeAnim>;
  rings: Map<RingKey, RingAnim>;
  /** The rings slide from the old place of the new center. */
  offsetFrom: THREE.Vector3;
  offset: THREE.Vector3;
  offsetStart: number;
  /** The last change settles at this time (performance.now()). */
  settleAt: number;
  tweening: boolean;
  centerId?: string;
  edges: Map<string, EdgeAnim>;
  edgeTier: Map<string, EdgeTier>;
  /** The ring keys of the last view. */
  ringKeys: Set<RingKey>;
  /** The one pulse around a new center. */
  pulseStart: number;
  /** The month dial draws with the sweep. */
  dialStart: number;
  dialDur: number;
  dialKey: string;
  /** The note and its marks fade in from this time (once the graph is at rest). */
  marksAt: number;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

function bezierPoint(a: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 + len * BEZIER_LIFT;
  const mz = (a.z + b.z) / 2;
  const u = 1 - t;
  return out.set(u * u * a.x + 2 * u * t * mx + t * t * b.x, u * u * a.y + 2 * u * t * my + t * t * b.y, u * u * a.z + 2 * u * t * mz + t * t * b.z);
}

function bezierInto(out: Float32Array, a: THREE.Vector3, b: THREE.Vector3, upto: number, tmp: THREE.Vector3) {
  for (let i = 0; i <= SEG; i++) {
    bezierPoint(a, b, (i / SEG) * upto, tmp);
    out[i * 3] = tmp.x;
    out[i * 3 + 1] = tmp.y;
    out[i * 3 + 2] = tmp.z;
  }
}

const TIER_OPACITY: Record<Tier, [number, number]> = {
  // [dark, light]
  hint: [0.42, 0.5],
  center: [1, 1],
  full: [1, 1],
  second: [0.9, 0.92],
  dim: [0.26, 0.3],
  faint: [0.3, 0.32],
  ghost: [0.2, 0.26],
  anchor: [0, 0],
  hidden: [0, 0],
};

const EDGE_OPACITY: Record<EdgeTier, [number, number]> = {
  path: [1, 1],
  focus: [0.55, 0.55],
  full: [0.34, 0.4],
  dim: [0.08, 0.1],
  faint: [0.028, 0.045],
  hidden: [0, 0],
};

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

export interface OrbitSceneProps {
  view: OrbitView;
  bridge: OrbitBridge;
  /** The store revision this view shows (reported to graphMotion once processed). */
  revision: number;
  /** Place everything at once (a loaded state, a deep link). */
  instant: boolean;
  /** Changes on every whole-graph load. */
  loadToken?: number;
  reduced: boolean;
  hover: string | null;
  pressed?: string;
  /** Re-fit the camera (the chat panel was resized). */
  refitToken: number;
  onReady?: () => void;
  /** The reasoning step of the last change (a played turn): the build-in follows it. */
  cue?: BuildCue;
}

/* ------------------------------------------------------------------ */
/* Nodes                                                               */
/* ------------------------------------------------------------------ */

interface NodeObj {
  group: THREE.Group;
  body: THREE.Mesh;
  bodyMat: THREE.MeshStandardMaterial;
  outline: THREE.Mesh;
  outlineMat: THREE.MeshBasicMaterial;
  rim?: THREE.Mesh;
}

const SPHERE = new THREE.SphereGeometry(1, 32, 24);
const OUTLINE = new THREE.RingGeometry(1.16, 1.0, 64);

function makeRim(color: THREE.Color, light: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: light ? color.clone() : hdr(color, 2.2) }, uAlpha: { value: light ? 0.55 : 0.9 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha; varying vec3 vN; varying vec3 vV;
      void main() {
        float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
        gl_FragColor = vec4(uColor * f, f * uAlpha);
      }`,
    transparent: true,
    depthWrite: false,
    blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
  });
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

function Scene({ view, bridge, revision, instant, loadToken, reduced, hover, pressed, refitToken, onReady, cue }: OrbitSceneProps) {
  const { scene, camera, size, gl } = useThree();
  const [palette, setPalette] = useState<Palette>(readPalette);
  useEffect(() => {
    const on = () => setPalette(readPalette());
    window.addEventListener(THEME_CHANGE_EVENT, on);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, on);
  }, []);

  // Presenter steps wait for this graph to come to rest.
  useEffect(() => graphMotion.mount(), []);

  const anim = useRef<Anim>({
    nodes: new Map(),
    rings: new Map(),
    offsetFrom: new THREE.Vector3(),
    offset: new THREE.Vector3(),
    offsetStart: 0,
    settleAt: 0,
    tweening: false,
    edges: new Map(),
    edgeTier: new Map(),
    ringKeys: new Set(),
    pulseStart: -Infinity,
    dialStart: -Infinity,
    dialDur: 1,
    dialKey: "",
    marksAt: -Infinity,
  });
  const viewRef = useRef(view);
  const hoverRef = useRef<string | null>(hover);
  hoverRef.current = hover;
  const pressedRef = useRef<string | undefined>(pressed);
  pressedRef.current = pressed;

  /* ------------------------------ objects ------------------------------ */

  const root = useMemo(() => new THREE.Group(), []);
  const ringGroup = useMemo(() => new THREE.Group(), []);
  const nodeGroup = useMemo(() => new THREE.Group(), []);
  const edgeGroup = useMemo(() => new THREE.Group(), []);
  useLayoutEffect(() => {
    root.add(ringGroup, edgeGroup, nodeGroup);
    scene.add(root);
    return () => {
      scene.remove(root);
    };
  }, [scene, root, ringGroup, nodeGroup, edgeGroup]);

  const nodeObjs = useRef(new Map<string, NodeObj>());
  const edgeObjs = useRef(
    new Map<string, { line: THREE.Line; mat: THREE.LineBasicMaterial; arr: Float32Array; fat?: { line: Line2; geo: LineGeometry; mat: LineMaterial } }>(),
  );
  const ringObjs = useRef(new Map<RingKey, { line: THREE.Line; mat: THREE.LineBasicMaterial }>());
  /** The dial's segments in sweep order (`fracs`: where each one starts along the sweep). */
  const dial = useRef<{ ticks: THREE.LineSegments; mat: THREE.LineBasicMaterial; fracs: number[] } | null>(null);
  /** The stretch of the dial the note marks, and the marker line through the records it links. */
  const arc = useRef<{ line: Line2; geo: LineGeometry; mat: LineMaterial; key: string } | null>(null);
  const marker = useRef<{ line: Line2; geo: LineGeometry; mat: LineMaterial; ids: string[]; arr: Float32Array } | null>(null);
  const pulse = useRef<{ mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial } | null>(null);
  const pulses = useRef<{ meshes: THREE.Mesh[]; geo: THREE.SphereGeometry; mat: THREE.MeshBasicMaterial } | null>(null);

  // Rings (one stroke per ring key, reused across centers so they slide and resize).
  // Each stroke starts at the clock origin, so a partial draw range is the sweep.
  useEffect(() => {
    const unit: THREE.Vector3[] = [];
    for (let i = 0; i <= RING_SEGS; i++) {
      const a = CLOCK_START + (i / RING_SEGS) * Math.PI * 2;
      unit.push(new THREE.Vector3(Math.cos(a), 0, Math.sin(a)));
    }
    for (const k of RING_ORDER) {
      const mat = new THREE.LineBasicMaterial({ color: palette.teal, transparent: true, opacity: 0, depthWrite: false, fog: true });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(unit), mat);
      line.visible = false;
      ringGroup.add(line);
      ringObjs.current.set(k, { line, mat });
    }
    // The one pulse around a new center: a flat ring in the orbit plane, toward where the rings will draw.
    const rootPulseMat = new THREE.MeshBasicMaterial({ color: palette.orange, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: true });
    const rootPulseMesh = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 128), rootPulseMat);
    rootPulseMesh.rotation.x = -Math.PI / 2;
    rootPulseMesh.visible = false;
    ringGroup.add(rootPulseMesh);
    pulse.current = { mesh: rootPulseMesh, mat: rootPulseMat };
    const pulseGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const pulseMat = new THREE.MeshBasicMaterial({ color: hdr(palette.orange, palette.light ? 1 : 3.2), toneMapped: false, transparent: true });
    const meshes = Array.from({ length: 8 }, () => {
      const m = new THREE.Mesh(pulseGeo, pulseMat);
      m.visible = false;
      edgeGroup.add(m);
      return m;
    });
    pulses.current = { meshes, geo: pulseGeo, mat: pulseMat };
    const objs = ringObjs.current;
    return () => {
      for (const o of objs.values()) {
        ringGroup.remove(o.line);
        o.line.geometry.dispose();
        o.mat.dispose();
      }
      objs.clear();
      ringGroup.remove(rootPulseMesh);
      rootPulseMesh.geometry.dispose();
      rootPulseMat.dispose();
      pulse.current = null;
      for (const m of meshes) edgeGroup.remove(m);
      pulseGeo.dispose();
      pulseMat.dispose();
      pulses.current = null;
    };
    // Built once; colors follow the palette in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ringGroup, edgeGroup]);

  /* ------------------------- palette (theme) -------------------------- */

  useEffect(() => {
    scene.background = palette.bg.clone();
    scene.fog = new THREE.Fog(palette.bg.clone(), 20, 44);
    for (const o of ringObjs.current.values()) o.mat.color.copy(palette.teal);
    if (pulses.current) pulses.current.mat.color.copy(hdr(palette.orange, palette.light ? 1 : 3.2));
    if (dial.current) dial.current.mat.color.copy(palette.text3);
    if (arc.current) arc.current.mat.color.copy(palette.tealBright);
    if (marker.current) marker.current.mat.color.copy(palette.tealBright);
    if (pulse.current) pulse.current.mat.color.copy(palette.orange);
    for (const [id, o] of nodeObjs.current) styleNode(id, o);
    for (const id of edgeObjs.current.keys()) styleEdgeColor(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette, scene]);

  const viewNode = (id: string): ViewNode | undefined => viewRef.current.byId.get(id);

  function styleNode(id: string, o: NodeObj) {
    const n = viewNode(id);
    if (!n) return;
    const p = palette;
    const fill = n.tier === "center" ? p.fillCenter : n.entity.type === "person" || n.entity.type === "org" ? p.fillMajor : p.fill;
    o.bodyMat.color.copy(fill);
    const orange = n.tier === "center" || n.onPath || n.focused;
    o.outlineMat.color.copy(orange ? (p.light ? p.orange : hdr(p.orange, n.tier === "center" ? 1.6 : 1.25)) : p.teal);
    if (n.tier === "center" && !o.rim) {
      o.rim = new THREE.Mesh(SPHERE, makeRim(p.orange, p.light));
      o.rim.scale.setScalar(1.05);
      o.group.add(o.rim);
    } else if (n.tier !== "center" && o.rim) {
      o.group.remove(o.rim);
      (o.rim.material as THREE.Material).dispose();
      o.rim = undefined;
    } else if (o.rim) {
      (o.rim.material as THREE.Material).dispose();
      o.rim.material = makeRim(p.orange, p.light);
    }
  }

  function styleEdgeColor(id: string) {
    const o = edgeObjs.current.get(id);
    if (!o) return;
    o.mat.color.copy(palette.teal);
    if (o.fat) o.fat.mat.color.copy(palette.light ? palette.orange : hdr(palette.orange, 1.35));
  }

  /* --------------------------- view changes --------------------------- */

  const lastRevision = useRef(-1);
  const lastLoad = useRef<number | undefined>(undefined);
  const firstView = useRef(true);
  const fitRef = useRef<(instant?: boolean) => void>(() => {});

  useEffect(() => {
    viewRef.current = view;
    const A = anim.current;
    const now = performance.now();
    const loaded = loadToken !== lastLoad.current;
    lastLoad.current = loadToken;
    const snap = reduced || instant || firstView.current || (loaded && instant);
    firstView.current = false;

    // The build-in follows the reasoning steps (the cue of a played turn): a phase
    // that belongs to a later step waits for that step's expected time, and starts
    // at once when the step's cue arrives (whichever comes first).
    const c = snap ? undefined : cue;
    const stepMs = c?.stepMs ?? DEFAULT_STEP_MS;
    const later = c ? Math.max(0, c.steps - 1 - c.step) : 0;
    const sweepDur = sweepMsFor(c?.stepMs);
    const connectPhase = c && later > 0 ? { key: c.key, step: c.step + 1 } : undefined;
    const contextPhase = c && later > 0 ? { key: c.key, step: c.steps - 1 } : undefined;
    const connectAt = connectPhase ? now + stepMs : now;
    const contextAt = contextPhase ? now + later * stepMs : now;
    const due = (p?: { key: string; step: number }) => !!p && !!c && p.key === c.key && p.step <= c.step;
    for (const a of A.nodes.values()) {
      if (snap) a.phase = undefined;
      else if (due(a.phase)) {
        a.start = Math.min(a.start, now);
        a.phase = undefined;
      }
    }
    for (const ea of A.edges.values()) {
      if (due(ea.phase)) {
        ea.base = Math.min(ea.base, now);
        ea.phase = undefined;
      }
    }
    if (snap) {
      A.edges.clear();
      A.pulseStart = -Infinity;
    }
    const wasEmpty = A.nodes.size === 0;

    // Rings: a new ring draws itself clockwise from the clock origin; the others
    // resize toward their new radii; the group slides from the new center's old place.
    if (view.centerId !== A.centerId) {
      const prev = view.centerId ? A.nodes.get(view.centerId) : undefined;
      A.offsetFrom.copy(snap || !prev ? new THREE.Vector3() : prev.from);
      A.offsetStart = now;
      A.centerId = view.centerId;
    }
    /** When the sweep (a new ring) or the scan (records joining a drawn ring) of each ring starts. */
    const ringStart = new Map<RingKey, number>();
    const freshRings = new Set<RingKey>();
    let fresh = 0;
    for (const k of RING_ORDER) {
      const vr = view.rings.find((r) => r.key === k);
      let ra = A.rings.get(k);
      if (!ra) {
        ra = { r: vr?.radius ?? 3, rFrom: vr?.radius ?? 3, rTo: vr?.radius ?? 3, op: 0, start: now, sweepStart: -Infinity, sweepDur: 1 };
        A.rings.set(k, ra);
      }
      if (!vr) continue;
      if (snap) {
        ra.r = ra.rFrom = ra.rTo = vr.radius;
        ra.op = ringTarget(vr.state);
        ra.sweepStart = -Infinity;
      } else if (!A.ringKeys.has(k)) {
        // A new ring draws at its own radius.
        ra.r = ra.rFrom = ra.rTo = vr.radius;
        ra.start = now;
        ra.op = ringTarget(vr.state);
        ra.sweepStart = now + fresh++ * BUILD.ringStaggerMs;
        ra.sweepDur = sweepDur;
        freshRings.add(k);
      } else if (vr.radius !== ra.rTo) {
        ra.rFrom = ra.op > 0.01 ? ra.r : vr.radius;
        ra.rTo = vr.radius;
        ra.start = now;
      }
      ringStart.set(k, freshRings.has(k) ? ra.sweepStart : now);
    }
    A.ringKeys = new Set(view.rings.map((r) => r.key));
    /** The time the sweep of `ring` passes the angle of (x, z). */
    const passAt = (ring: RingKey, x: number, z: number) => (ringStart.get(ring) ?? now) + sweepPassMs(sweepFraction(Math.atan2(z, x)), sweepDur);

    // Nodes: create or update objects.
    const seen = new Set<string>();
    const newIds: string[] = [];
    const context: { a: NodeAnim; f: number }[] = [];
    for (const n of view.nodes) {
      seen.add(n.id);
      let o = nodeObjs.current.get(n.id);
      if (!o) {
        const bodyMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true, fog: true });
        const body = new THREE.Mesh(SPHERE, bodyMat);
        const outlineMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: true });
        const outline = new THREE.Mesh(OUTLINE, outlineMat);
        outline.renderOrder = 2;
        const group = new THREE.Group();
        group.add(body, outline);
        nodeGroup.add(group);
        o = { group, body, bodyMat, outline, outlineMat };
        nodeObjs.current.set(n.id, o);
      }
      styleNode(n.id, o);
      const to = new THREE.Vector3(n.x, n.y, n.z);
      // Records on a ring (and the unopened records of the center person) show as the sweep passes their date.
      const ringRole = view.layout.nodes.get(n.id)?.role === "ring" || n.tier === "hint";
      const onRing = ringRole && !!n.ring && ringStart.has(n.ring) && (n.tier === "full" || n.tier === "dim" || n.tier === "hint");
      const pass = onRing ? passAt(n.ring!, n.x, n.z) : now;
      const a = A.nodes.get(n.id);
      if (!a) {
        const b: NodeAnim = {
          from: to.clone(),
          to,
          cur: to.clone(),
          start: now,
          delay: 0,
          dur: ENTER_MS,
          appear: !snap,
          grow: snap ? 1 : 0,
          range: 1,
          vis: snap ? 1 : 0,
          scale: snap ? 1 : 0,
          opacity: 0,
          s0: 0.35,
          labelAt: snap ? -Infinity : now,
          tier: n.tier,
          tierAt: -Infinity,
          radius: n.radius,
        };
        A.nodes.set(n.id, b);
        if (snap) continue;
        if (n.tier === "center" && wasEmpty) {
          // Set root node: the center scales in from 0.6 with one pulse; its label follows once it lands.
          b.dur = BUILD.rootMs;
          b.s0 = BUILD.rootScale0;
          b.labelAt = now + BUILD.rootLabelDelayMs;
          A.pulseStart = now;
        } else if (onRing) {
          // A record drops into place as the sweep passes its date; its card follows.
          b.from.y += BUILD.dropLift;
          b.cur.copy(b.from);
          b.start = pass;
          b.dur = BUILD.dropMs;
          b.s0 = BUILD.dropScale0;
          b.labelAt = pass + BUILD.cardDelayMs;
        } else if (n.tier === "anchor") {
          // A category's ring label shows as its ring starts to draw.
          const k = view.rings.find((r) => r.anchorId === n.id)?.key;
          const at = k ? (ringStart.get(k) ?? now) : now;
          b.start = at;
          b.dur = 1;
          b.labelAt = at;
        } else if (n.tier === "ghost" || n.tier === "faint") {
          // Context fades in last (Render), in date order.
          b.start = contextAt;
          b.dur = BUILD.contextMs;
          b.s0 = BUILD.dropScale0;
          b.labelAt = contextAt;
          b.phase = contextPhase;
          context.push({ a: b, f: sweepFraction(Math.atan2(n.z, n.x)) });
        } else {
          // Second hop: grows out of its parent, one by one.
          const parent = n.parent ? A.nodes.get(n.parent) : undefined;
          b.from.copy(parent?.cur ?? new THREE.Vector3());
          b.cur.copy(b.from);
          newIds.push(n.id);
        }
        continue;
      }
      if (snap) {
        a.from.copy(to);
        a.to.copy(to);
        a.cur.copy(to);
        a.appear = false;
        a.grow = 1;
        a.start = now - 10_000;
        a.delay = 0;
        a.labelAt = -Infinity;
      } else if (!a.to.equals(to)) {
        a.from.copy(a.cur);
        a.to.copy(to);
        a.start = now;
        a.delay = 0;
        a.dur = RECENTER_MS;
        if (onRing && (a.tier === "ghost" || a.tier === "faint")) {
          // Context that becomes a record joins its ring as the sweep passes its date.
          a.start = pass;
          a.dur = BUILD.joinMs;
          a.labelAt = pass + BUILD.joinMs * 0.45;
        }
      } else if (onRing && (a.tier === "ghost" || a.tier === "faint")) {
        a.labelAt = pass;
      }
      if (snap) {
        a.tierFrom = undefined;
        a.tierAt = -Infinity;
      } else if (a.tier === "hint" && n.tier !== "hint" && onRing) {
        // A record opens in place as the sweep passes its date: it brightens and grows, and its label follows.
        a.tierFrom = "hint";
        a.radiusFrom = a.radius;
        a.tierAt = pass;
        a.labelAt = pass + BUILD.cardDelayMs;
      }
      a.tier = n.tier;
      a.radius = n.radius;
    }
    // New second-hop nodes enter one by one; context in date order.
    if (!snap) newIds.forEach((id, i) => (A.nodes.get(id)!.delay = i * STAGGER_MS));
    context.sort((p, q) => p.f - q.f).forEach((x, i) => (x.a.delay = i * BUILD.contextStaggerMs));
    for (const [id, o] of nodeObjs.current) {
      if (seen.has(id)) continue;
      nodeGroup.remove(o.group);
      o.bodyMat.dispose();
      o.outlineMat.dispose();
      if (o.rim) (o.rim.material as THREE.Material).dispose();
      nodeObjs.current.delete(id);
      A.nodes.delete(id);
    }

    // Edges. A new connection grows from the center to its record at the next
    // step (Establish connections), in date order, once its record has landed.
    const eSeen = new Set<string>();
    const connect: { id: string; day: number; min: number }[] = [];
    const growing = new Set(newIds);
    const landed = (id: string) => {
      const a = A.nodes.get(id);
      if (!a) return now;
      const t0 = a.start + a.delay;
      return t0 + a.dur > now ? t0 + a.dur * 0.55 : now;
    };
    for (const e of view.edges) {
      eSeen.add(e.id);
      let o = edgeObjs.current.get(e.id);
      if (!o) {
        const arr = new Float32Array((SEG + 1) * 3);
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
        const mat = new THREE.LineBasicMaterial({ color: palette.teal, transparent: true, opacity: 0, depthWrite: false, fog: true });
        const line = new THREE.Line(geo, mat);
        line.frustumCulled = false;
        edgeGroup.add(line);
        o = { line, mat, arr };
        edgeObjs.current.set(e.id, o);
      }
      if (e.tier === "path" && !o.fat) {
        const geo = new LineGeometry();
        geo.setPositions(new Float32Array((SEG + 1) * 3));
        const mat = new LineMaterial({ linewidth: 2, transparent: true, depthWrite: false, toneMapped: false });
        mat.color.copy(palette.light ? palette.orange : hdr(palette.orange, 1.35));
        const line = new Line2(geo, mat);
        line.frustumCulled = false;
        line.renderOrder = 3;
        edgeGroup.add(line);
        o.fat = { line, geo, mat };
      } else if (e.tier !== "path" && o.fat) {
        edgeGroup.remove(o.fat.line);
        o.fat.geo.dispose();
        o.fat.mat.dispose();
        o.fat = undefined;
      }
      const prev = A.edgeTier.get(e.id);
      const real = e.tier !== "faint" && e.tier !== "hidden";
      if (!snap && real && (prev === undefined || prev === "faint" || prev === "hidden") && !growing.has(e.a) && !growing.has(e.b)) {
        connect.push({ id: e.id, day: e.day ?? Infinity, min: Math.max(landed(e.a), landed(e.b)) });
      }
      A.edgeTier.set(e.id, e.tier);
    }
    connect
      .sort((p, q) => p.day - q.day || p.id.localeCompare(q.id))
      .forEach((x, i) => A.edges.set(x.id, { base: connectAt, offset: i * BUILD.edgeStaggerMs, min: x.min, dur: BUILD.edgeMs, phase: connectPhase }));
    for (const [id, o] of edgeObjs.current) {
      if (eSeen.has(id)) continue;
      edgeGroup.remove(o.line);
      o.line.geometry.dispose();
      o.mat.dispose();
      if (o.fat) {
        edgeGroup.remove(o.fat.line);
        o.fat.geo.dispose();
        o.fat.mat.dispose();
      }
      edgeObjs.current.delete(id);
      A.edges.delete(id);
      A.edgeTier.delete(id);
    }

    // The dial (month ticks) draws with the first new ring's sweep; the hint dots
    // of unloaded records show as their ring's sweep passes them.
    const firstSweep = freshRings.size ? Math.min(...Array.from(freshRings, (k) => ringStart.get(k)!)) : now;
    const dialKey = view.centerId && view.rings.length ? `${view.centerId}|${view.layout.window.join("-")}|${view.layout.outerRadius}` : "";
    if (dialKey !== A.dialKey) {
      A.dialKey = dialKey;
      buildDial();
      A.dialStart = snap ? -Infinity : firstSweep;
      A.dialDur = sweepDur;
    } else if (snap) A.dialStart = -Infinity;
    // The note's stretch of the dial and its marker line.
    const arcKey = view.marks.arc && view.rings.length ? `${view.marks.arc.join("-")}|${view.layout.window.join("-")}|${view.layout.outerRadius}` : "";
    if (arcKey !== (arc.current?.key ?? "")) buildArc(arcKey);
    if (view.marks.marker.join("|") !== (marker.current?.ids.join("|") ?? "")) buildMarker(view.marks.marker);

    // The graph is at rest once every phase has played.
    let end = now;
    if (!snap) {
      end = now + RECENTER_MS;
      for (const a of A.nodes.values()) end = Math.max(end, a.start + a.delay + a.dur);
      for (const ra of A.rings.values()) end = Math.max(end, ra.sweepStart + ra.sweepDur);
      for (const ea of A.edges.values()) end = Math.max(end, Math.max(ea.base + ea.offset, ea.min) + ea.dur);
      end = Math.max(end, A.dialStart + A.dialDur, A.pulseStart + BUILD.pulseMs);
      for (const a of A.nodes.values()) if (a.tierAt > -Infinity) end = Math.max(end, a.tierAt + BUILD.labelFadeMs);
    }
    A.settleAt = end;
    // The note belongs to the answer: it shows once the graph has built it.
    A.marksAt = snap ? -Infinity : end;
    if (!snap && !A.tweening) {
      A.tweening = true;
      graphMotion.tweening(true);
    }
    if (snap && A.tweening) {
      A.tweening = false;
      graphMotion.tweening(false);
    }
    fitRef.current(snap);
    lastRevision.current = revision;
    graphMotion.processed(revision);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, revision, instant, loadToken, reduced, cue]);

  function ringTarget(state: "active" | "normal" | "dim"): number {
    const light = palette.light;
    return state === "active" ? (light ? 0.75 : 0.62) : state === "dim" ? (light ? 0.22 : 0.16) : light ? 0.45 : 0.36;
  }

  function buildDial() {
    const v = viewRef.current;
    if (dial.current) {
      ringGroup.remove(dial.current.ticks);
      dial.current.ticks.geometry.dispose();
      dial.current.mat.dispose();
      dial.current = null;
    }
    if (!v.centerId || v.rings.length === 0) return;
    const [w0, w1] = v.layout.window;
    const m0 = monthOfDay(w0);
    const m1 = monthOfDay(w1);
    const R = v.layout.outerRadius + 0.7;
    // Segments in sweep order, so a draw range is the part the sweep has passed.
    const segs: { f: number; p: number[] }[] = [];
    for (let m = m0; m <= m1; m++) {
      const a = angleOfDay(monthStart(m), v.layout.window);
      const len = m === m0 || m === m1 ? 0.3 : 0.14;
      segs.push({ f: sweepFraction(a), p: [Math.cos(a) * R, 0, Math.sin(a) * R, Math.cos(a) * (R + len), 0, Math.sin(a) * (R + len)] });
    }
    // The dial arc.
    for (let i = 0; i < 120; i++) {
      const a0 = CLOCK_START + (CLOCK_SWEEP * i) / 120;
      const a1 = CLOCK_START + (CLOCK_SWEEP * (i + 1)) / 120;
      segs.push({ f: sweepFraction(a0), p: [Math.cos(a0) * R, 0, Math.sin(a0) * R, Math.cos(a1) * R, 0, Math.sin(a1) * R] });
    }
    segs.sort((p, q) => p.f - q.f);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(segs.flatMap((s) => s.p), 3));
    const mat = new THREE.LineBasicMaterial({ color: palette.text3, transparent: true, opacity: 0, depthWrite: false, fog: true });
    const ticks = new THREE.LineSegments(geo, mat);
    ticks.frustumCulled = false;
    ringGroup.add(ticks);
    dial.current = { ticks, mat, fracs: segs.map((s) => s.f) };
  }

  /** The stretch of the dial the note marks: a brighter arc along the dial. */
  function buildArc(key: string) {
    const v = viewRef.current;
    if (arc.current) {
      ringGroup.remove(arc.current.line);
      arc.current.geo.dispose();
      arc.current.mat.dispose();
      arc.current = null;
    }
    if (!key || !v.marks.arc) return;
    const R = v.layout.outerRadius + 0.7;
    let a0 = angleOfDay(v.marks.arc[0], v.layout.window);
    let a1 = angleOfDay(v.marks.arc[1], v.layout.window);
    // A stretch of one day still shows as a short arc.
    const minArc = 0.03;
    if (a1 - a0 < minArc) {
      const m = (a0 + a1) / 2;
      a0 = m - minArc / 2;
      a1 = m + minArc / 2;
    }
    const n = 48;
    const pts: number[] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push(Math.cos(a) * R, 0, Math.sin(a) * R);
    }
    const geo = new LineGeometry();
    geo.setPositions(pts);
    const mat = new LineMaterial({ linewidth: 2.5, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    mat.color.copy(palette.tealBright);
    const line = new Line2(geo, mat);
    line.frustumCulled = false;
    line.renderOrder = 3;
    ringGroup.add(line);
    arc.current = { line, geo, mat, key };
  }

  /** The marker: a thin dashed line through the records the note links, in order. */
  function buildMarker(ids: string[]) {
    if (marker.current) {
      edgeGroup.remove(marker.current.line);
      marker.current.geo.dispose();
      marker.current.mat.dispose();
      marker.current = null;
    }
    if (ids.length < 2) return;
    const segs = (ids.length - 1) * SEG;
    const geo = new LineGeometry();
    geo.setPositions(new Float32Array((segs + 1) * 3));
    const mat = new LineMaterial({ linewidth: 1.5, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, dashed: true, dashSize: 0.14, gapSize: 0.09 });
    mat.color.copy(palette.tealBright);
    const line = new Line2(geo, mat);
    line.frustumCulled = false;
    line.renderOrder = 4;
    edgeGroup.add(line);
    marker.current = { line, geo, mat, ids, arr: new Float32Array((SEG + 1) * 3) };
  }

  // Dispose everything on unmount.
  useEffect(
    () => () => {
      for (const o of nodeObjs.current.values()) {
        o.bodyMat.dispose();
        o.outlineMat.dispose();
        if (o.rim) (o.rim.material as THREE.Material).dispose();
      }
      for (const o of edgeObjs.current.values()) {
        o.line.geometry.dispose();
        o.mat.dispose();
        o.fat?.geo.dispose();
        o.fat?.mat.dispose();
      }
      dial.current?.ticks.geometry.dispose();
      dial.current?.mat.dispose();
      arc.current?.geo.dispose();
      arc.current?.mat.dispose();
      marker.current?.geo.dispose();
      marker.current?.mat.dispose();
      if (anim.current.tweening) graphMotion.tweening(false);
    },
    [],
  );

  /* ------------------------------ camera ------------------------------ */

  const controls = useRef<CameraControls>(null);
  const fittedOnce = useRef(false);
  const flight = useRef<{ from: number[]; to: number[]; start: number; dur: number } | null>(null);

  const fitTarget = (): number[] => {
    const v = viewRef.current;
    const ins = bridge.insets;
    const w = Math.max(200, size.width);
    const h = Math.max(200, size.height);
    const pad = 28;
    const freeW = Math.max(160, w - ins.left - ins.right - pad * 2);
    const freeH = Math.max(160, h - ins.top - ins.bottom - pad * 2);
    const tanV = Math.tan(((FOV / 2) * Math.PI) / 180);
    const tanH = tanV * (w / h);
    // A focused category frames its own ring; the rings outside it fade off the edges.
    const active = v.rings.find((r) => r.state === "active");
    const R = active ? Math.min(v.layout.outerRadius + 1.0, active.radius + 1.9) : Math.max(v.layout.outerRadius + 1.0, 4.6);
    const dH = (R * w) / (freeW * tanH);
    const worldH = 2 * R * Math.cos(POLAR) * 1.12 + 1.6 * Math.sin(POLAR);
    const dV = (worldH * h) / (2 * freeH * tanV);
    const d = Math.max(dH, dV, 7);
    // Center the rings in the free area (below the header, above the controls).
    const perPx = (2 * d * tanV) / h;
    const ox = ((ins.right - ins.left) / 2) * perPx;
    const oy = ((ins.top - ins.bottom) / 2) * perPx + 0.35;
    return [d, POLAR, ox, oy];
  };

  useEffect(() => {
    const fit = (snap = false) => {
      const c = controls.current;
      if (!c) return;
      const to = fitTarget();
      if (snap || reduced) {
        flight.current = null;
        c.dollyTo(to[0], false);
        c.rotatePolarTo(to[1], false);
        c.setFocalOffset(to[2], to[3], 0, false);
        c.setTarget(0, 0, 0, false);
        return;
      }
      const fo = c.getFocalOffset(new THREE.Vector3());
      flight.current = { from: [c.distance, c.polarAngle, fo.x, fo.y], to, start: performance.now(), dur: RECENTER_MS };
      graphMotion.camera(RECENTER_MS + 30);
    };
    fitRef.current = fit;
    bridge.camera = {
      fit: (snap) => fit(snap),
      zoom: (dir) => {
        const c = controls.current;
        if (!c) return;
        flight.current = null;
        void c.dolly(dir * c.distance * 0.22, !reduced);
      },
    };
    if (!fittedOnce.current) {
      fittedOnce.current = true;
      fit(true);
    }
    return () => {
      bridge.camera = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge, size.width, size.height, reduced]);

  // A canvas resize or a chat resize re-fits at once.
  const firstSize = useRef(true);
  useEffect(() => {
    if (firstSize.current) {
      firstSize.current = false;
      return;
    }
    fitRef.current(true);
  }, [size.width, size.height]);
  const lastRefit = useRef(refitToken);
  useEffect(() => {
    if (lastRefit.current === refitToken) return;
    lastRefit.current = refitToken;
    fitRef.current(false);
  }, [refitToken]);

  /* ---------------------------- spotlight ----------------------------- */

  useEffect(() => {
    const v3 = new THREE.Vector3();
    return registerEdgeSampler(() => {
      const out: EdgePoint[] = [];
      const rect = gl.domElement.getBoundingClientRect();
      const A = anim.current;
      for (const e of viewRef.current.edges) {
        const a = A.nodes.get(e.a);
        const b = A.nodes.get(e.b);
        const o = edgeObjs.current.get(e.id);
        if (!a || !b || !o || !o.line.visible) continue;
        const weight = e.tier === "path" ? "path" : e.tier === "focus" || e.tier === "full" ? "full" : "faint";
        const pa = a.cur.clone().add(root.position);
        const pb = b.cur.clone().add(root.position);
        const len = pa.distanceTo(pb);
        const n = Math.max(4, Math.ceil(len * 4));
        for (let i = 0; i <= n; i++) {
          bezierPoint(pa, pb, i / n, v3).project(camera);
          const x = rect.left + ((v3.x + 1) / 2) * rect.width;
          const y = rect.top + ((1 - v3.y) / 2) * rect.height;
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) out.push({ x, y, weight });
        }
      }
      // The note's marker line counts as a full edge.
      const M = marker.current;
      if (M?.line.visible) {
        for (let i = 0; i < M.ids.length - 1; i++) {
          const a = A.nodes.get(M.ids[i]);
          const b = A.nodes.get(M.ids[i + 1]);
          if (!a || !b) continue;
          for (let k = 0; k <= 16; k++) {
            bezierPoint(a.cur, b.cur, k / 16, v3).project(camera);
            const x = rect.left + ((v3.x + 1) / 2) * rect.width;
            const y = rect.top + ((1 - v3.y) / 2) * rect.height;
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) out.push({ x, y, weight: "full" });
          }
        }
      }
      return out;
    });
  }, [gl, camera, root]);

  /* ------------------------------ frame ------------------------------- */

  const tmp = useMemo(() => new THREE.Vector3(), []);
  const tmp2 = useMemo(() => new THREE.Vector3(), []);
  const proj = useMemo(() => new THREE.Vector3(), []);
  const dims = useMemo(() => new WeakMap<HTMLElement, { w: number; h: number; text: string }>(), []);
  const readyFired = useRef(false);

  useFrame((state, delta) => {
    const now = performance.now();
    const A = anim.current;
    const v = viewRef.current;
    const light = palette.light ? 1 : 0;
    const damp = 1 - Math.exp(-delta * 12);

    // Camera flight (fixed duration, so a step always settles at the same time).
    const c = controls.current;
    if (c && flight.current) {
      const f = flight.current;
      const k = easeOutExpo(clamp01((now - f.start) / f.dur));
      const at = (i: number) => f.from[i] + (f.to[i] - f.from[i]) * k;
      c.dollyTo(at(0), false);
      c.rotatePolarTo(at(1), false);
      c.setFocalOffset(at(2), at(3), 0, false);
      c.setTarget(0, 0, 0, false);
      c.update(0);
      if (k >= 1) flight.current = null;
    }

    // Fog follows the camera distance: the far side of the rings recedes.
    const dist = camera.position.length();
    if (scene.fog instanceof THREE.Fog) {
      // Light mode fogs less: fog toward a light page washes thin teal lines out.
      scene.fog.near = dist * (palette.light ? 1.02 : 0.98);
      scene.fog.far = dist * (palette.light ? 3.4 : 2.1);
    }

    // Rings slide in from the old place of the new center.
    const ko = reduced ? 1 : easeOutExpo(clamp01((now - A.offsetStart) / RECENTER_MS));
    A.offset.copy(A.offsetFrom).multiplyScalar(1 - ko);
    ringGroup.position.copy(A.offset);

    const ts = timeStore.get();
    // The note and its marks fade in once the graph is at rest.
    const markK = reduced ? (now >= A.marksAt ? 1 : 0) : clamp01((now - A.marksAt) / MARK_FADE_MS);
    let moving = false;
    for (const n of v.nodes) {
      const a = A.nodes.get(n.id);
      const o = nodeObjs.current.get(n.id);
      if (!a || !o) continue;
      const t = (now - a.start - a.delay) / a.dur;
      const k = reduced ? 1 : easeOutExpo(clamp01(t));
      if ((t < 1 || now < a.tierAt) && !reduced) moving = true;
      a.cur.lerpVectors(a.from, a.to, k);
      if (a.appear) {
        a.grow = k;
        if (k >= 1) a.appear = false;
      }
      const inRange = n.tier === "center" || n.onPath ? 1 : timeVisibility(ts, n.day);
      a.range += (inRange - a.range) * damp;
      if (Math.abs(inRange - a.range) < 0.002) a.range = inRange;
      a.vis = Math.min(a.grow, a.range);
      const isHover = hoverRef.current === n.id || pressedRef.current === n.id;
      const press = pressedRef.current === n.id ? 0.86 : 1;
      // A record that opens keeps its old look until the sweep passes its date.
      const held = now < a.tierAt && !!a.tierFrom;
      const tierNow = held ? a.tierFrom! : n.tier;
      // A record the note is about draws at full strength (an unopened one a little larger).
      const emph = n.emphasis ? markK : 0;
      const targetScale = (held ? (a.radiusFrom ?? n.radius) : n.radius) * press * (tierNow === "hint" ? 1 + 0.45 * emph : 1);
      a.scale += (targetScale - a.scale) * (reduced ? 1 : damp);
      const base = TIER_OPACITY[tierNow][light];
      const tierOp = base + (Math.max(base, 0.95) - base) * emph;
      const op = (isHover && (tierNow === "dim" || tierNow === "faint" || tierNow === "ghost" || tierNow === "hint") ? Math.max(tierOp, 0.75) : tierOp) * a.vis;
      a.opacity += (op - a.opacity) * (reduced ? 1 : Math.min(1, delta * 14));
      const show = a.opacity > 0.01 && n.tier !== "hidden" && n.tier !== "anchor";
      o.group.visible = show;
      if (!show) continue;
      o.group.position.copy(a.cur);
      const s = Math.max(0.0001, a.scale * (a.s0 + (1 - a.s0) * easeOutExpo(a.vis)));
      o.group.scale.setScalar(s);
      o.bodyMat.opacity = a.opacity;
      o.bodyMat.depthWrite = a.opacity > 0.95;
      const orange = n.tier === "center" || n.onPath || n.focused;
      o.outlineMat.opacity = a.opacity * (orange ? 1 : isHover ? 1 : n.tier === "second" ? 0.6 : 0.8);
      if (!orange) o.outlineMat.color.copy(isHover || emph > 0.5 || palette.light ? palette.tealBright : palette.teal);
      o.outline.quaternion.copy(camera.quaternion);
      o.outline.scale.setScalar(n.tier === "center" ? 1.08 : 1);
    }
    if (now - A.offsetStart < RECENTER_MS && !reduced) moving = true;

    // The one pulse around a new center (Set root node).
    if (pulse.current) {
      const P = pulse.current;
      const t = (now - A.pulseStart) / BUILD.pulseMs;
      const center = v.centerId ? A.nodes.get(v.centerId) : undefined;
      P.mesh.visible = !reduced && t >= 0 && t < 1 && !!center;
      if (P.mesh.visible && center) {
        const k = easeOutExpo(t);
        P.mesh.position.copy(center.cur).sub(A.offset);
        P.mesh.scale.setScalar(0.42 + 2.2 * k);
        P.mat.opacity = (palette.light ? 0.5 : 0.4) * Math.pow(1 - t, 2.5) * Math.min(1, t * 10);
      }
    }

    // Rings. A new ring draws itself clockwise from the clock origin.
    for (const k of RING_ORDER) {
      const ra = A.rings.get(k);
      const ro = ringObjs.current.get(k);
      if (!ra || !ro) continue;
      const vr = v.rings.find((r) => r.key === k);
      const kr = reduced ? 1 : easeOutExpo(clamp01((now - ra.start) / RECENTER_MS));
      ra.r = ra.rFrom + (ra.rTo - ra.rFrom) * kr;
      const target = vr ? ringTarget(vr.state) : 0;
      ra.op += (target - ra.op) * (reduced ? 1 : Math.min(1, delta * 6));
      if (Math.abs(target - ra.op) < 0.003) ra.op = target;
      const drawn = reduced ? 1 : sweepAt((now - ra.sweepStart) / ra.sweepDur);
      ro.line.scale.setScalar(ra.r);
      ro.mat.opacity = ra.op;
      ro.mat.color.copy(vr?.state === "active" ? palette.tealBright : palette.teal);
      ro.line.geometry.setDrawRange(0, drawn >= 1 ? Infinity : Math.ceil(drawn * RING_SEGS) + 1);
      ro.line.visible = ra.op > 0.004 && drawn > 0;
    }
    const settled = now >= A.settleAt;
    if (dial.current) {
      const D = dial.current;
      // The dial is the clock's scale: quiet, so the marked stretch stands out.
      const t = light ? 0.36 : 0.28;
      D.mat.opacity += (t - D.mat.opacity) * (reduced ? 1 : Math.min(1, delta * 8));
      // The ticks and the arc show as the sweep passes them.
      const p = reduced ? 1 : sweepAt((now - A.dialStart) / A.dialDur);
      let n = D.fracs.length;
      if (p < 1) {
        n = 0;
        while (n < D.fracs.length && D.fracs[n] <= p) n++;
      }
      D.ticks.geometry.setDrawRange(0, n * 2);
      D.ticks.visible = n > 0;
    }
    if (arc.current) {
      arc.current.mat.opacity = markK * (light ? 0.95 : 0.9);
      arc.current.mat.resolution.set(state.size.width, state.size.height);
      arc.current.line.visible = markK > 0.01;
    }
    if (marker.current) {
      const M = marker.current;
      const pts = M.ids.map((id) => A.nodes.get(id));
      M.line.visible = markK > 0.01 && pts.every((p) => !!p && p.vis > 0.5);
      if (M.line.visible) {
        M.mat.opacity = markK * (light ? 1 : 0.95);
        M.mat.resolution.set(state.size.width, state.size.height);
        const attr = M.geo.attributes.instanceStart as THREE.InterleavedBufferAttribute;
        const buf = attr.data.array as Float32Array;
        for (let i = 0; i < pts.length - 1; i++) {
          bezierInto(M.arr, pts[i]!.cur, pts[i + 1]!.cur, 1, tmp);
          for (let s = 0; s < SEG; s++) {
            const o = (i * SEG + s) * 6;
            for (let ci = 0; ci < 3; ci++) {
              buf[o + ci] = M.arr[s * 3 + ci];
              buf[o + 3 + ci] = M.arr[(s + 1) * 3 + ci];
            }
          }
        }
        attr.data.needsUpdate = true;
        // Dashes follow the line's length (recounted only while it moves).
        if (moving || !M.line.userData.dashed) {
          M.line.computeLineDistances();
          M.line.userData.dashed = true;
        }
      }
    }

    // Edges.
    let pathReady = 0;
    for (const e of v.edges) {
      const o = edgeObjs.current.get(e.id);
      const a = A.nodes.get(e.a);
      const b = A.nodes.get(e.b);
      if (!o || !a || !b) continue;
      // Grow from the parent toward the child.
      const aFirst = v.byId.get(e.a)?.parent !== e.b;
      const [p, q] = aFirst ? [a, b] : [b, a];
      let prog = Math.min(a.grow, b.grow) >= 1 ? 1 : Math.min(1, Math.max(0.001, aFirst ? b.grow : a.grow));
      // Establish connections: the edge grows from the center to its record.
      const ea = A.edges.get(e.id);
      if (ea && !reduced) {
        const te = (now - Math.max(ea.base + ea.offset, ea.min)) / ea.dur;
        if (te >= 1) A.edges.delete(e.id);
        else if (te <= 0) {
          o.line.visible = false;
          if (o.fat) o.fat.line.visible = false;
          continue;
        } else prog = Math.min(prog, Math.max(0.001, easeOutExpo(te)));
      }
      const vis = Math.min(a.range, b.range);
      const lit = hoverRef.current !== null && (e.a === hoverRef.current || e.b === hoverRef.current);
      const base = EDGE_OPACITY[e.tier][light];
      const op = (lit && e.tier !== "path" ? Math.max(base, 0.85) : base) * vis * Math.min(1, Math.max(a.vis, b.vis) * 1.5);
      if (e.tier === "path" && o.fat) {
        o.line.visible = false;
        o.fat.mat.opacity = op;
        o.fat.mat.resolution.set(state.size.width, state.size.height);
        o.fat.line.visible = op > 0.01;
        if (!o.fat.line.visible) continue;
        bezierInto(o.arr, p.cur, q.cur, prog, tmp);
        const attr = o.fat.geo.attributes.instanceStart as THREE.InterleavedBufferAttribute;
        const buf = attr.data.array as Float32Array;
        for (let s = 0; s < SEG; s++) {
          for (let ci = 0; ci < 3; ci++) {
            buf[s * 6 + ci] = o.arr[s * 3 + ci];
            buf[s * 6 + 3 + ci] = o.arr[(s + 1) * 3 + ci];
          }
        }
        attr.data.needsUpdate = true;
        if (prog >= 1 && vis > 0.98) pathReady++;
        continue;
      }
      if (o.fat) o.fat.line.visible = false;
      o.mat.opacity = op;
      o.mat.color.copy(lit ? palette.tealBright : e.tier === "focus" && v.layout.activeRing ? palette.tealBright : palette.teal);
      o.line.visible = op > 0.004;
      if (!o.line.visible) continue;
      bezierInto(o.arr, p.cur, q.cur, prog, tmp);
      (o.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }

    // Pulses run outward along the orange path (never with reduced motion).
    if (pulses.current) {
      const P = pulses.current;
      const order: [THREE.Vector3, THREE.Vector3][] = [];
      for (const [from, to] of v.pathSegs) {
        const p = A.nodes.get(from);
        const q = A.nodes.get(to);
        if (p && q) order.push([p.cur, q.cur]);
      }
      const on = !reduced && settled && pathReady > 0 && order.length > 0;
      const t = state.clock.elapsedTime * 0.38;
      P.meshes.forEach((m, j) => {
        if (!on || j >= Math.max(2, order.length * 2)) {
          m.visible = false;
          return;
        }
        const phase = (t + j / Math.max(2, order.length * 2)) % 1;
        const seg = Math.min(order.length - 1, Math.floor(phase * order.length));
        const local = phase * order.length - seg;
        bezierPoint(order[seg][0], order[seg][1], local, tmp2);
        m.position.copy(tmp2);
        m.scale.setScalar(0.6 + 0.4 * Math.sin(local * Math.PI));
        m.visible = true;
      });
    }

    // Motion report.
    if (A.tweening && !moving && now >= A.settleAt) {
      A.tweening = false;
      graphMotion.tweening(false);
    }

    project(state.size.width, state.size.height);

    if (!readyFired.current && lastRevision.current >= 0) {
      readyFired.current = true;
      onReady?.();
    }
  });

  /* ---------------------------- projector ----------------------------- */

  function project(W: number, H: number) {
    const v = viewRef.current;
    const A = anim.current;
    const ins = bridge.insets;
    const tanV = Math.tan(((FOV / 2) * Math.PI) / 180);
    type Alt = { x0: number; y0: number; transform: string };
  type Item = { el: HTMLElement; pri: number; x0: number; y0: number; x1: number; y1: number; keep?: boolean; ring?: boolean; alts?: Alt[]; soft?: boolean; least?: boolean };
    const items: Item[] = [];
    const measure = (el: HTMLElement) => {
      const text = el.textContent ?? "";
      let d = dims.get(el);
      if (!d || d.text !== text || d.w === 0) {
        d = { w: el.offsetWidth, h: el.offsetHeight, text };
        dims.set(el, d);
      }
      return d;
    };
    const toScreen = (p: THREE.Vector3) => {
      proj.copy(p).project(camera);
      return { x: ((proj.x + 1) / 2) * W, y: ((1 - proj.y) / 2) * H, behind: proj.z > 1 };
    };

    const now = performance.now();
    const centerA = v.centerId ? A.nodes.get(v.centerId) : undefined;
    const centerScreen = centerA ? toScreen(centerA.cur) : { x: W / 2, y: H / 2 };
    for (const n of v.nodes) {
      const els = bridge.nodes.get(n.id);
      const a = A.nodes.get(n.id);
      if (!els || !a) continue;
      const pos = n.tier === "anchor" ? tmp.copy(a.cur).add(A.offset) : a.cur;
      const s = toScreen(pos);
      const camDist = camera.position.distanceTo(pos);
      const rpx = n.tier === "anchor" ? 0 : (a.scale * (0.35 + 0.65 * easeOutExpo(a.vis)) * (H / 2)) / (camDist * tanV);
      const visible = n.tier === "anchor" ? a.vis > 0.5 : a.vis > 0.02 && n.tier !== "hidden";
      els.root.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)`;
      els.root.style.visibility = visible ? "visible" : "hidden";
      // A label or card fades in once its node has landed (labelAt).
      const lab = clamp01((now - a.labelAt) / BUILD.labelFadeMs);
      els.root.style.opacity = String(n.tier === "anchor" ? lab : Math.min(lab, clamp01(a.vis * 1.3 - 0.2)));
      if (els.hit) {
        const d = Math.max(20, rpx * 2 + 6);
        els.hit.style.width = els.hit.style.height = `${d.toFixed(1)}px`;
      }
      const label = els.label;
      if (!label) continue;
      if (!visible) {
        label.style.visibility = "hidden";
        continue;
      }
      const d = measure(label);
      const kind = label.dataset.kind;
      let x0: number;
      let y0: number;
      let alts: Alt[] | undefined;
      if (kind === "center") {
        // Above the center node (toward 12 o'clock, the gap in the clock that holds no
        // records); below or beside it when the cards around it need that room.
        const up = rpx + 6 + d.h;
        const down = rpx + 6;
        const side = rpx + 10;
        alts = [
          { x0: s.x - d.w / 2, y0: s.y - up, transform: `translate(-50%, ${(-up).toFixed(1)}px)` },
          { x0: s.x - d.w / 2, y0: s.y + down, transform: `translate(-50%, ${down.toFixed(1)}px)` },
          { x0: s.x + side, y0: s.y - d.h / 2, transform: `translate(${side.toFixed(1)}px, -50%)` },
          { x0: s.x - side - d.w, y0: s.y - d.h / 2, transform: `translate(${(-side - d.w).toFixed(1)}px, -50%)` },
        ];
        x0 = alts[0].x0;
        y0 = alts[0].y0;
      } else if (kind === "card") {
        const off = rpx + 8;
        // Cards sit on the outward side of their node (away from the center); the other side when that is taken.
        const outwardRight = s.x >= centerScreen.x - 2;
        const right = { x0: s.x + off, y0: s.y - d.h / 2, transform: `translate(${off.toFixed(1)}px, -50%)` };
        const left = { x0: s.x - off - d.w, y0: s.y - d.h / 2, transform: `translate(${(-off - d.w).toFixed(1)}px, -50%)` };
        const above = { x0: s.x - d.w / 2, y0: s.y - rpx - 4 - d.h, transform: `translate(-50%, ${(-rpx - 4 - d.h).toFixed(1)}px)` };
        const below = { x0: s.x - d.w / 2, y0: s.y + rpx + 4, transform: `translate(-50%, ${(rpx + 4).toFixed(1)}px)` };
        // Diagonal spots when the sides and the middle are taken (neighbors on the same ring).
        const up = s.y - rpx - 4 - d.h;
        const down = s.y + rpx + 4;
        const diag = (x0: number, y0: number) => ({ x0, y0, transform: `translate(${(x0 - s.x).toFixed(1)}px, ${(y0 - s.y).toFixed(1)}px)` });
        const outX0 = outwardRight ? s.x + 4 : s.x - 4 - d.w;
        const inX0 = outwardRight ? s.x - 4 - d.w : s.x + 4;
        alts = outwardRight
          ? [right, left, above, below, diag(outX0, up), diag(outX0, down), diag(inX0, up), diag(inX0, down)]
          : [left, right, above, below, diag(outX0, up), diag(outX0, down), diag(inX0, up), diag(inX0, down)];
        x0 = alts[0].x0;
        y0 = alts[0].y0;
      } else if (kind === "ring") {
        label.style.transform = "translate(-50%, -50%)";
        x0 = s.x - d.w / 2;
        y0 = s.y - d.h / 2;
      } else {
        // Under the node; above it when that is taken.
        const off = rpx + 3;
        const below = { x0: s.x - d.w / 2, y0: s.y + off, transform: `translate(-50%, ${off.toFixed(1)}px)` };
        const above = { x0: s.x - d.w / 2, y0: s.y - off - d.h, transform: `translate(-50%, ${(-off - d.h).toFixed(1)}px)` };
        alts = [below, above];
        x0 = below.x0;
        y0 = below.y0;
      }
      const hovered = hoverRef.current === n.id;
      const show = label.dataset.show === "1" || hovered;
      if (!show) {
        label.style.visibility = "hidden";
        continue;
      }
      const pri =
        // The center label always shows, but places itself after the cards around it.
        hovered ? 1000 : n.tier === "center" ? 450 : n.tier === "anchor" ? 800 : n.focused ? 780 : n.emphasis ? 750 : n.onPath ? 700 : n.tier === "full" ? 500 - (n.ring ? RING_ORDER.indexOf(n.ring) : 0) - proj.z : 300 - proj.z;
      items.push({ el: label, pri, x0, y0, x1: x0 + d.w, y1: y0 + d.h, keep: n.tier === "center" || hovered, ring: n.tier === "anchor", alts });
    }

    for (const e of v.edges) {
      const el = bridge.edgeLabels.get(e.id);
      if (!el) continue;
      const a = A.nodes.get(e.a);
      const b = A.nodes.get(e.b);
      const ok = !!a && !!b && a.vis > 0.95 && b.vis > 0.95 && a.grow >= 1 && b.grow >= 1 && performance.now() >= A.settleAt - 300;
      if (!ok) {
        el.style.visibility = "hidden";
        continue;
      }
      const [p, q] = v.byId.get(e.a)?.tier === "center" ? [a!.cur, b!.cur] : [b!.cur, a!.cur];
      bezierPoint(p, q, 0.56, tmp);
      const s = toScreen(tmp);
      const d = measure(el);
      el.style.transform = `translate3d(${(s.x - d.w / 2).toFixed(1)}px, ${(s.y - d.h / 2).toFixed(1)}px, 0)`;
      // Edge labels give way to the node cards (the cards are the content).
      items.push({ el, pri: e.tier === "path" ? 480 : 420, x0: s.x - d.w / 2, y0: s.y - d.h / 2, x1: s.x + d.w / 2, y1: s.y + d.h / 2 });
    }

    // Ring labels that are not category nodes, and the dial months.
    for (const r of v.rings) {
      const el = bridge.ringLabels.get(r.key);
      const ra = A.rings.get(r.key);
      if (!el || !ra) continue;
      tmp.set(0, 0, -ra.r).add(A.offset);
      const s = toScreen(tmp);
      const d = measure(el);
      el.style.transform = `translate3d(${(s.x - d.w / 2).toFixed(1)}px, ${(s.y - d.h / 2).toFixed(1)}px, 0)`;
      const on = ra.op > 0.05 && now >= ra.sweepStart;
      if (!on) {
        el.style.visibility = "hidden";
        continue;
      }
      // The ring's name shows as its stroke starts to draw.
      el.style.opacity = String(clamp01((now - ra.sweepStart) / BUILD.labelFadeMs));
      items.push({ el, pri: 800, x0: s.x - d.w / 2, y0: s.y - d.h / 2, x1: s.x + d.w / 2, y1: s.y + d.h / 2, ring: true });
    }
    const R = v.layout.outerRadius + 0.7;
    // The dial labels the answer needs (the months of its records, or the marked stretch).
    for (const el of bridge.dial.values()) {
      const a = angleOfDay(Number(el.dataset.day), v.layout.window);
      tmp.set(Math.cos(a) * (R + 0.15), 0, Math.sin(a) * (R + 0.15)).add(A.offset);
      const p = toScreen(tmp);
      const d = measure(el);
      // Just outside the dial, pushed outward on screen by the label's own size.
      let ux = p.x - centerScreen.x;
      let uy = p.y - centerScreen.y;
      const ul = Math.hypot(ux, uy) || 1;
      ux /= ul;
      uy /= ul;
      const push = 6 + Math.abs(ux) * (d.w / 2) + Math.abs(uy) * (d.h / 2);
      // Outward from the dial; when a card takes that spot, further out, then along the dial either way.
      const alts: Alt[] = [];
      for (const [k, t] of [[push, 0], [push + 26, 0], [push, 1], [push, -1], [push + 26, 1], [push + 26, -1]]) {
        const tx = -uy * t * (d.w / 2 + 10);
        const ty = ux * t * (d.w / 2 + 10);
        const x0 = p.x + ux * k + tx - d.w / 2;
        const y0 = p.y + uy * k + ty - d.h / 2;
        alts.push({ x0, y0, transform: `translate3d(${x0.toFixed(1)}px, ${y0.toFixed(1)}px, 0)` });
      }
      el.style.transform = alts[0].transform;
      // A month shows once the dial's sweep has passed it.
      el.style.opacity = reduced || sweepAt((now - A.dialStart) / A.dialDur) >= sweepFraction(a) ? "1" : "0";
      items.push({ el, pri: 450, soft: true, x0: alts[0].x0, y0: alts[0].y0, x1: alts[0].x0 + d.w, y1: alts[0].y0 + d.h, alts });
    }

    // The note's marks fade in once the graph is at rest.
    const markOp = String(reduced ? (now >= A.marksAt ? 1 : 0) : clamp01((now - A.marksAt) / MARK_FADE_MS));
    // Date chips next to the records the note links.
    for (const [id, el] of bridge.chips) {
      const a = A.nodes.get(id);
      const n = v.byId.get(id);
      if (!a || !n) continue;
      const s = toScreen(a.cur);
      const d = measure(el);
      const rpx = (a.scale * (H / 2)) / (camera.position.distanceTo(a.cur) * tanV);
      const off = rpx + 5;
      const at = (x0: number, y0: number): Alt => ({ x0, y0, transform: `translate3d(${x0.toFixed(1)}px, ${y0.toFixed(1)}px, 0)` });
      // Under or over the node (centered, or reaching either way), then beside it; further out when taken.
      const alts: Alt[] = [];
      // The side away from the center first (the center's label sits between them otherwise).
      const awayDown = s.y >= centerScreen.y;
      for (const k of [off, off + 18]) {
        const ys = awayDown ? [s.y + k, s.y - k - d.h] : [s.y - k - d.h, s.y + k];
        for (const y0 of ys) alts.push(at(s.x - d.w / 2, y0), at(s.x - 10, y0), at(s.x + 10 - d.w, y0));
      }
      alts.push(at(s.x + off + 2, s.y - d.h / 2), at(s.x - off - 2 - d.w, s.y - d.h / 2));
      el.style.opacity = markOp;
      items.push({ el, pri: 745, keep: true, soft: true, least: true, x0: alts[0].x0, y0: alts[0].y0, x1: alts[0].x0 + d.w, y1: alts[0].y0 + d.h, alts });
    }
    // The note: beside what it refers to, outward from the center, in the first free spot.
    let noteItem: Item | undefined;
    let noteAt: { x: number; y: number; r: number } | undefined;
    const N = bridge.note;
    const spec = v.marks.note;
    if (N && spec) {
      let p: { x: number; y: number } | undefined;
      let r = 3;
      if ("node" in spec.anchor) {
        const a = A.nodes.get(spec.anchor.node);
        if (a) {
          p = toScreen(a.cur);
          r = (a.scale * (H / 2)) / (camera.position.distanceTo(a.cur) * tanV) + 3;
        }
      } else {
        const ang = angleOfDay(spec.anchor.day, v.layout.window);
        p = toScreen(tmp.set(Math.cos(ang) * R, 0, Math.sin(ang) * R).add(A.offset));
      }
      if (p) {
        const d = measure(N.el);
        let ux = p.x - centerScreen.x;
        let uy = p.y - centerScreen.y;
        const len = Math.hypot(ux, uy) || 1;
        ux /= len;
        uy /= len;
        // Spots around the anchor, the note's nearest edge `gap` away: below, above, right, and
        // left (each above or below spot reaching outward or inward), the outward ones first.
        const gap = r + 18;
        const spots: { x0: number; y0: number; dx: number; dy: number }[] = [];
        const outX = ux >= 0 ? 1 : -1;
        for (const dy of [1, -1]) {
          const y0 = dy > 0 ? p.y + gap : p.y - gap - d.h;
          spots.push({ x0: outX > 0 ? p.x - 16 : p.x - d.w + 16, y0, dx: outX * 0.5, dy });
          spots.push({ x0: p.x - d.w / 2, y0, dx: 0, dy });
          spots.push({ x0: outX > 0 ? p.x - d.w + 16 : p.x - 16, y0, dx: -outX * 0.5, dy });
        }
        spots.push({ x0: p.x + gap, y0: p.y - d.h / 2, dx: 1, dy: 0 });
        spots.push({ x0: p.x - gap - d.w, y0: p.y - d.h / 2, dx: -1, dy: 0 });
        spots.sort((a, b) => b.dx * ux + b.dy * uy - (a.dx * ux + a.dy * uy));
        const alts: Alt[] = spots.map(({ x0, y0 }) => ({ x0, y0, transform: `translate3d(${x0.toFixed(1)}px, ${y0.toFixed(1)}px, 0)` }));
        N.el.style.opacity = markOp;
        noteItem = { el: N.el, pri: 490, keep: true, soft: true, least: true, x0: alts[0].x0, y0: alts[0].y0, x1: alts[0].x0 + d.w, y1: alts[0].y0 + d.h, alts };
        noteAt = { x: p.x, y: p.y, r };
        items.push(noteItem);
      }
    }

    // Node circles at full strength are obstacles too: an edge label, a tag, or
    // a month never covers one (cards may, the declutter keeps the stronger).
    const circles: { x0: number; y0: number; x1: number; y1: number; id: string }[] = [];
    for (const n of v.nodes) {
      if (n.tier !== "center" && n.tier !== "full" && !n.onPath && !n.emphasis) continue;
      const els = bridge.nodes.get(n.id);
      const hit = els?.hit;
      if (!hit || els.root.style.visibility === "hidden") continue;
      const tr = /translate3d\(([-\d.]+)px, ([-\d.]+)px/.exec(els.root.style.transform);
      if (!tr) continue;
      const cx = Number(tr[1]);
      const cy = Number(tr[2]);
      const r = Math.max(6, parseFloat(hit.style.width) / 2 - 3);
      circles.push({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r, id: n.id });
    }
    const softKinds = new Set(["record", "tag"]);

    // Declutter: a label that overlaps a stronger one hides, and so does a
    // label cut by the header, the controls, or the canvas edge (the center stays).
    items.sort((p, q) => q.pri - p.pri);
    const placed: Item[] = [];
    for (const it of items) {
      const kind = it.el.dataset.kind;
      const soft = it.soft || it.el.hasAttribute("data-edge-label") || it.pri <= 100 || (kind !== undefined && softKinds.has(kind));
      const own = it.el.closest("[data-node-id]")?.getAttribute("data-node-id");
      const w = it.x1 - it.x0;
      const h = it.y1 - it.y0;
      const free = (x0: number, y0: number) => {
        const x1 = x0 + w;
        const y1 = y0 + h;
        if (y0 < ins.top - 4 || y1 > H - ins.bottom || x0 < 4 || x1 > W - 4) return false;
        // Ring labels stack at 12 o'clock: their chips may touch (the 1px borders overlap).
        const my = (p: Item) => (it.ring && p.ring ? -2 : 2);
        if (placed.some((p) => x0 < p.x1 + 4 && x1 > p.x0 - 4 && y0 < p.y1 + my(p) && y1 > p.y0 - my(p))) return false;
        return !(soft && circles.some((c) => c.id !== own && x0 < c.x1 && x1 > c.x0 && y0 < c.y1 && y1 > c.y0));
      };
      let show = !!it.keep;
      const alt = it.alts?.find((a) => free(a.x0, a.y0));
      if (alt) {
        show = true;
        it.el.style.transform = alt.transform;
        it.x0 = alt.x0;
        it.y0 = alt.y0;
        it.x1 = alt.x0 + w;
        it.y1 = alt.y0 + h;
      } else if (!it.alts) show = show || free(it.x0, it.y0);
      else if (it.alts.length) {
        // No free spot: the one inside the canvas that covers the least (or the first).
        const inside = (a: Alt) => a.y0 >= ins.top - 4 && a.y0 + h <= H - ins.bottom && a.x0 >= 4 && a.x0 + w <= W - 4;
        const cover = (a: Alt) => placed.reduce((sum, p) => sum + Math.max(0, Math.min(a.x0 + w, p.x1) - Math.max(a.x0, p.x0)) * Math.max(0, Math.min(a.y0 + h, p.y1) - Math.max(a.y0, p.y0)), 0);
        const a = it.least ? (it.alts.filter(inside).sort((p, q) => cover(p) - cover(q))[0] ?? it.alts[0]) : it.alts[0];
        it.el.style.transform = a.transform;
        it.x0 = a.x0;
        it.y0 = a.y0;
        it.x1 = a.x0 + w;
        it.y1 = a.y0 + h;
      }
      it.el.style.visibility = show ? "visible" : "hidden";
      if (show) placed.push(it);
    }

    // The note's leader: a thin line from what it refers to, to the nearest point of the note.
    if (N && noteItem && noteAt) {
      const qx = Math.min(Math.max(noteAt.x, noteItem.x0), noteItem.x1);
      const qy = Math.min(Math.max(noteAt.y, noteItem.y0), noteItem.y1);
      const len = Math.hypot(qx - noteAt.x, qy - noteAt.y) || 1;
      const sx = noteAt.x + ((qx - noteAt.x) / len) * Math.min(noteAt.r, len);
      const sy = noteAt.y + ((qy - noteAt.y) / len) * Math.min(noteAt.r, len);
      if (N.leader) {
        N.leader.setAttribute("x1", sx.toFixed(1));
        N.leader.setAttribute("y1", sy.toFixed(1));
        N.leader.setAttribute("x2", qx.toFixed(1));
        N.leader.setAttribute("y2", qy.toFixed(1));
      }
      if (N.dot) {
        N.dot.setAttribute("cx", sx.toFixed(1));
        N.dot.setAttribute("cy", sy.toFixed(1));
      }
      const svg = N.leader?.ownerSVGElement;
      if (svg) svg.style.opacity = markOp;
    }
  }

  return (
    <>
      <ambientLight intensity={palette.light ? 0.95 : 0.55} />
      <directionalLight position={[-6, 12, 8]} intensity={palette.light ? 1.25 : 1.5} />
      <directionalLight position={[8, 3, -6]} intensity={palette.light ? 0.25 : 0.35} color={palette.teal} />
      <CameraControls
        ref={controls}
        makeDefault
        smoothTime={0.3}
        draggingSmoothTime={0.1}
        minDistance={5}
        maxDistance={70}
        minPolarAngle={0.3}
        maxPolarAngle={1.3}
        onStart={() => {
          flight.current = null;
        }}
      />
      <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.08} intensity={palette.light ? 0 : 0.8} radius={0.55} />
      </EffectComposer>
    </>
  );
}

/** Load with next/dynamic (ssr: false): WebGL needs the browser. */
export default function OrbitScene(props: OrbitSceneProps) {
  return (
    <Canvas
      flat
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.5, far: 160, position: [0, 12, 17] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      className="!absolute inset-0"
      aria-hidden="true"
    >
      <Scene {...props} />
    </Canvas>
  );
}

export type { ViewEdge };
