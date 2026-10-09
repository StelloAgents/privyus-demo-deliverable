"use client";

/* Graph lab prototype (superseded by components/graph/orbit, kept for the Alternative Designs page): frame-loop mutation of three.js objects is intended here. */
/* eslint-disable react-hooks/immutability, react-hooks/use-memo */

import { Billboard, CameraControls, Html } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { BadgeDollarSign, Building2, Flag, Handshake, Plane, ScrollText, Vote, type LucideIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { easeOutExpo } from "@/lib/motion";
import {
  MONTH_COUNT,
  PATH_EDGES,
  PATH_NODES,
  RINGS,
  angleOfDay,
  edges,
  edgesOf,
  layoutFor,
  monthLabel,
  monthStartDay,
  nodeById,
  nodes,
  toDay,
  type LabEdge,
  type LabNode,
  type Layout,
  type RingKind,
} from "./data";
import { growDays, timeStore } from "./time";

/* --------------------------------------------------------------- palette */

interface Palette {
  bg: THREE.Color;
  teal: THREE.Color;
  tealBright: THREE.Color;
  orange: THREE.Color;
  text3: THREE.Color;
  fill: THREE.Color;
  fillPerson: THREE.Color;
  fillFocus: THREE.Color;
}

function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => new THREE.Color(s.getPropertyValue(name).trim() || fallback);
  const bg = v("--bg", "#101418");
  const teal = v("--teal", "#598b97");
  return {
    bg,
    teal,
    tealBright: v("--teal-bright", "#7fb6c2"),
    orange: v("--orange", "#f89b45"),
    text3: v("--text-3", "#7d8990"),
    // Matte node fills: the surface steps, tinted toward the brand teal.
    fill: v("--surface-3", "#262d34").lerp(teal, 0.22),
    fillPerson: v("--surface-3", "#262d34").lerp(teal, 0.42),
    fillFocus: v("--surface-3", "#262d34").lerp(v("--text-2", "#adb7bd"), 0.25),
  };
}

/** HDR orange: only these values pass the bloom threshold (selective bloom on the focus path). */
const hdr = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

/* ------------------------------------------------------------- animation */

const TRANSITION_S = 1.15;
const SEG = 28;
const PATH_SET = new Set<string>(PATH_NODES);
const DIAL_R = 8.4;

interface Anim {
  layout: Layout;
  from: Map<string, THREE.Vector3>;
  cur: Map<string, THREE.Vector3>;
  t0: number;
  ringFrom: THREE.Vector3;
  ringCur: THREE.Vector3;
  /** Smoothed window filter, per node (0 hidden, 1 shown). */
  range: Map<string, number>;
  /** Final reveal, per node: window filter times playback growth. */
  vis: Map<string, number>;
  progress: number;
}

const toV = (p: { x: number; y: number; z: number }) => new THREE.Vector3(p.x, p.y, p.z);

function createAnim(focus: string): Anim {
  const layout = layoutFor(focus);
  const cur = new Map<string, THREE.Vector3>();
  for (const [id, p] of layout.pos) cur.set(id, toV(p));
  return {
    layout,
    from: new Map([...cur].map(([k, v]) => [k, v.clone()])),
    cur,
    t0: -10,
    ringFrom: new THREE.Vector3(),
    ringCur: new THREE.Vector3(),
    range: new Map(nodes.map((n) => [n.id, 1])),
    vis: new Map(nodes.map((n) => [n.id, 1])),
    progress: 1,
  };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);

/* ------------------------------------------------------------------ props */

export interface OrbitSceneProps {
  focus: string;
  hover: string | null;
  onFocus: (id: string) => void;
  onHover: (id: string | null) => void;
}

interface NodeRefs {
  group: THREE.Group;
  outline?: THREE.MeshBasicMaterial;
  html?: HTMLDivElement | null;
}

/* ---------------------------------------------------------------- helpers */

const ICON: Record<LabNode["kind"], LucideIcon | null> = {
  person: null,
  member: null,
  org: Building2,
  bill: ScrollText,
  topic: Flag,
  meeting: Handshake,
  money: BadgeDollarSign,
  vote: Vote,
  trip: Plane,
};

function radiusOf(n: LabNode, focus: boolean, near: boolean) {
  if (focus) return 0.36;
  if (n.context || !near) return 0.09;
  if (n.kind === "person" || n.kind === "org" || n.kind === "bill" || n.kind === "topic") return 0.17;
  return 0.13;
}

/** Quadratic bezier from a to b, lifted at the middle, written for t in [0, upto]. */
function bezierInto(out: Float32Array, a: THREE.Vector3, b: THREE.Vector3, upto: number, lift: number) {
  const mx = (a.x + b.x) / 2;
  const mz = (a.z + b.z) / 2;
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const my = (a.y + b.y) / 2 + len * lift;
  for (let i = 0; i <= SEG; i++) {
    const t = (i / SEG) * upto;
    const u = 1 - t;
    out[i * 3] = u * u * a.x + 2 * u * t * mx + t * t * b.x;
    out[i * 3 + 1] = u * u * a.y + 2 * u * t * my + t * t * b.y;
    out[i * 3 + 2] = u * u * a.z + 2 * u * t * mz + t * t * b.z;
  }
}
function bezierAt(a: THREE.Vector3, b: THREE.Vector3, t: number, lift: number, out: THREE.Vector3) {
  const len = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  const m = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + len * lift, (a.z + b.z) / 2);
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * m.x + t * t * b.x,
    u * u * a.y + 2 * u * t * m.y + t * t * b.y,
    u * u * a.z + 2 * u * t * m.z + t * t * b.z,
  );
}
const LIFT = 0.08;

/** Edge orientation: grow from the end nearer the focus. */
function orient(ed: LabEdge, layout: Layout): [string, string] {
  const ds = layout.pos.get(ed.source)?.depth ?? 9;
  const dt = layout.pos.get(ed.target)?.depth ?? 9;
  return ds <= dt ? [ed.source, ed.target] : [ed.target, ed.source];
}
const edgeDay = (ed: LabEdge) => Math.max(toDay(ed.date), toDay(nodeById.get(ed.source)!.date), toDay(nodeById.get(ed.target)!.date));

/* ------------------------------------------------------------- the driver */

/** One frame loop for everything: layout transition, window filter, playback reveal. */
function Driver({ anim, focus, nodeRefs }: { anim: React.RefObject<Anim>; focus: string; nodeRefs: Map<string, NodeRefs> }) {
  useFrame((state, delta) => {
    const A = anim.current;
    const now = state.clock.elapsedTime;
    const k = A.t0 < 0 ? 1 : easeOutExpo(clamp01((now - A.t0) / TRANSITION_S));
    A.progress = k;
    for (const [id, p] of A.layout.pos) {
      const from = A.from.get(id)!;
      A.cur.get(id)!.set(from.x + (p.x - from.x) * k, from.y + (p.y - from.y) * k, from.z + (p.z - from.z) * k);
    }
    A.ringCur.copy(A.ringFrom).multiplyScalar(1 - k);

    const ts = timeStore.get();
    const grow = growDays(ts);
    const damp = 1 - Math.exp(-delta * 10);
    for (const n of nodes) {
      const day = toDay(n.date);
      const isFocus = n.id === focus;
      const inRange = isFocus || (day >= ts.start - 0.5 && day < ts.end + 0.5) ? 1 : 0;
      const r = A.range.get(n.id)!;
      const rr = r + (inRange - r) * damp;
      A.range.set(n.id, rr);
      const g = isFocus ? 1 : clamp01((ts.playhead - day) / grow + 0.15);
      const v = Math.min(rr, g);
      A.vis.set(n.id, v);
      const refs = nodeRefs.get(n.id);
      if (!refs) continue;
      const p = A.cur.get(n.id)!;
      refs.group.position.copy(p);
      const s = v < 0.001 ? 0.0001 : 0.35 + 0.65 * easeOutExpo(v);
      refs.group.scale.setScalar(s);
      refs.group.visible = v > 0.01;
      if (refs.html) refs.html.style.opacity = String(clamp01(v * 1.4 - 0.2));
    }
  });
  return null;
}

/* ----------------------------------------------------------------- nodes */

function NodeView({
  node,
  near,
  isFocus,
  isPath,
  isHover,
  label,
  palette,
  onFocus,
  onHover,
  register,
}: {
  node: LabNode;
  near: boolean;
  isFocus: boolean;
  isPath: boolean;
  isHover: boolean;
  label: "card" | "tag" | null;
  palette: Palette;
  onFocus: (id: string) => void;
  onHover: (id: string | null) => void;
  register: (id: string, r: Partial<NodeRefs>) => void;
}) {
  const r = radiusOf(node, isFocus, near);
  const faint = !!node.context || !near;
  const fill = isFocus ? palette.fillFocus : node.kind === "person" || node.kind === "member" ? palette.fillPerson : palette.fill;
  const outlineColor = isFocus || isPath ? palette.orange : isHover ? palette.tealBright : palette.teal;
  const outlineOpacity = isFocus || isPath ? 1 : isHover ? 1 : faint ? 0.22 : 0.75;
  const Icon = ICON[node.kind];

  const events = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      onFocus(node.id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      onHover(node.id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      onHover(null);
      document.body.style.cursor = "";
    },
  };

  return (
    <group ref={(g) => g && register(node.id, { group: g })}>
      {/* Hit target, larger than the small nodes */}
      <mesh {...events}>
        <sphereGeometry args={[Math.max(r * 1.6, 0.28), 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[r, 32, 32]} />
        <meshStandardMaterial color={fill} roughness={1} metalness={0} transparent={faint} opacity={faint ? 0.28 : 1} />
      </mesh>
      {isFocus && <RimShell radius={r} color={palette.orange} />}
      <Billboard>
        <mesh renderOrder={2}>
          <ringGeometry args={[r * 1.18, r * 1.18 + (isFocus ? 0.045 : 0.03), 64]} />
          <meshBasicMaterial
            ref={(m) => {
              if (m) register(node.id, { outline: m });
            }}
            color={isFocus || isPath ? hdr(outlineColor, isFocus ? 1.6 : 1.25) : outlineColor}
            toneMapped={false}
            transparent
            opacity={outlineOpacity}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
      {label && (
        <Html zIndexRange={[30, 0]} style={{ pointerEvents: "none" }}>
          <div
            ref={(el) => register(node.id, { html: el })}
            data-kind={label}
            data-off={label === "card" ? Math.round(r * 60 + 14) : 0}
            style={{ transform: label === "card" ? `translate(${Math.round(r * 60 + 14)}px, -50%)` : "translate(-50%, 12px)" }}
            className="pointer-events-auto"
          >
            {label === "card" ? (
              <button
                type="button"
                onClick={() => onFocus(node.id)}
                onPointerEnter={() => onHover(node.id)}
                onPointerLeave={() => onHover(null)}
                data-node={node.id}
                className={`flex max-w-[260px] items-center gap-2.5 rounded-card border bg-surface-1/95 py-1.5 pr-3 pl-1.5 text-left whitespace-nowrap transition-colors duration-[120ms] ${
                  isFocus ? "border-line-strong" : isHover ? "border-line-strong" : "border-line"
                }`}
              >
                <span
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-semibold ${
                    isFocus || isPath ? "border-orange text-fg-1" : "border-teal text-fg-2"
                  } bg-surface-2`}
                >
                  {node.initials ?? (Icon ? <Icon size={15} strokeWidth={1.5} /> : null)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] leading-[18px] font-semibold text-fg-1">{node.label}</span>
                  <span className="block truncate text-[12px] leading-4 font-medium text-fg-3">{node.sub}</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onFocus(node.id)}
                onPointerEnter={() => onHover(node.id)}
                onPointerLeave={() => onHover(null)}
                data-node={node.id}
                className={`block max-w-[180px] truncate rounded-[3px] px-1 text-[11px] leading-[15px] font-medium whitespace-nowrap transition-colors duration-[120ms] ${
                  isHover ? "bg-surface-2 text-fg-1" : isPath ? "text-orange-ink" : "text-fg-3"
                }`}
                style={{ textShadow: "0 0 4px var(--bg), 0 0 2px var(--bg)" }}
              >
                {node.label}
              </button>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}

/** A soft orange rim (fresnel) on the focused node only. */
function RimShell({ radius, color }: { radius: number; color: THREE.Color }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: hdr(color, 2.2) } },
        vertexShader: /* glsl */ `
          varying vec3 vN; varying vec3 vV;
          void main() {
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vN = normalize(normalMatrix * normal);
            vV = normalize(-mv.xyz);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
          void main() {
            float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
            gl_FragColor = vec4(uColor * f, f * 0.9);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [color],
  );
  return (
    <mesh material={mat} scale={1.04}>
      <sphereGeometry args={[radius, 48, 48]} />
    </mesh>
  );
}

/* ----------------------------------------------------------------- edges */

interface EdgeObj {
  ed: LabEdge;
  line: THREE.Line;
  mat: THREE.LineBasicMaterial;
  arr: Float32Array;
}

function Edges({ anim, focus, hover, palette }: { anim: React.RefObject<Anim>; focus: string; hover: string | null; palette: Palette }) {
  const group = useRef<THREE.Group>(null);
  const objs = useMemo<EdgeObj[]>(
    () =>
      edges
        .filter((ed) => !PATH_EDGES.has(ed.id))
        .map((ed) => {
          const arr = new Float32Array((SEG + 1) * 3);
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
          const mat = new THREE.LineBasicMaterial({ color: palette.teal, transparent: true, opacity: 0.5, depthWrite: false, fog: true });
          const line = new THREE.Line(geo, mat);
          line.frustumCulled = false;
          return { ed, line, mat, arr };
        }),
    [palette],
  );
  useLayoutEffect(() => {
    const g = group.current!;
    for (const o of objs) g.add(o.line);
    return () => {
      for (const o of objs) {
        g.remove(o.line);
        o.line.geometry.dispose();
        o.mat.dispose();
      }
    };
  }, [objs]);

  useFrame(() => {
    const A = anim.current;
    const ts = timeStore.get();
    const grow = growDays(ts);
    for (const o of objs) {
      const [a, b] = orient(o.ed, A.layout);
      const pa = A.layout.pos.get(a)!;
      const pb = A.layout.pos.get(b)!;
      const va = A.vis.get(a)!;
      const vb = A.vis.get(b)!;
      const prog = clamp01((ts.playhead - edgeDay(o.ed)) / grow);
      const vis = Math.min(A.range.get(a)!, A.range.get(b)!);
      const lit = hover !== null && (o.ed.source === hover || o.ed.target === hover);
      const touchesFocus = o.ed.source === focus || o.ed.target === focus;
      const base = !pa.near || !pb.near ? 0.05 : touchesFocus ? 0.42 : 0.3;
      o.mat.opacity = (lit ? 0.95 : base) * vis * Math.min(1, Math.max(va, vb) * 2);
      o.mat.color.copy(lit ? palette.tealBright : palette.teal);
      o.line.visible = o.mat.opacity > 0.005 && prog > 0.001;
      if (o.line.visible) {
        bezierInto(o.arr, A.cur.get(a)!, A.cur.get(b)!, prog, LIFT);
        (o.line.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
    }
  });
  return <group ref={group} />;
}

/** The focus chain in orange (2px), with directional pulses. Shown only when the whole chain is near the center. */
function FocusPath({ anim, palette }: { anim: React.RefObject<Anim>; palette: Palette }) {
  const group = useRef<THREE.Group>(null);
  const size = useThree((s) => s.size);
  const pathEdges = useMemo(() => edges.filter((ed) => PATH_EDGES.has(ed.id)), []);
  const objs = useMemo(
    () =>
      pathEdges.map((ed) => {
        const geo = new LineGeometry();
        const pts = new Float32Array((SEG + 1) * 3);
        geo.setPositions(pts);
        const mat = new LineMaterial({ color: hdr(palette.orange, 1.35).getHex(), linewidth: 2, transparent: true, depthWrite: false, toneMapped: false });
        mat.color.copy(hdr(palette.orange, 1.35));
        const line = new Line2(geo, mat);
        line.frustumCulled = false;
        line.renderOrder = 3;
        return { ed, geo, mat, line, pts };
      }),
    [pathEdges, palette],
  );
  const pulses = useMemo(() => {
    const geo = new THREE.SphereGeometry(0.045, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: hdr(palette.orange, 3.2), toneMapped: false, transparent: true });
    return { geo, mat, meshes: Array.from({ length: pathEdges.length * 2 }, () => new THREE.Mesh(geo, mat)) };
  }, [pathEdges, palette]);

  useLayoutEffect(() => {
    const g = group.current!;
    for (const o of objs) g.add(o.line);
    for (const m of pulses.meshes) g.add(m);
    return () => {
      for (const o of objs) {
        g.remove(o.line);
        o.geo.dispose();
        o.mat.dispose();
      }
      for (const m of pulses.meshes) g.remove(m);
      pulses.geo.dispose();
      pulses.mat.dispose();
    };
  }, [objs, pulses]);

  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame((state) => {
    const A = anim.current;
    const ts = timeStore.get();
    const grow = growDays(ts);
    const near = PATH_NODES.every((id) => A.layout.pos.get(id)!.near);
    let chainDone = true;
    objs.forEach((o, i) => {
      const [a, b] = orient(o.ed, A.layout);
      const prog = clamp01((ts.playhead - edgeDay(o.ed)) / grow);
      const vis = Math.min(A.range.get(a)!, A.range.get(b)!) * (near ? 1 : 0);
      o.mat.resolution.set(size.width, size.height);
      o.mat.opacity = vis;
      o.line.visible = vis > 0.01 && prog > 0.001;
      if (prog < 1 || vis < 0.99) chainDone = false;
      if (!o.line.visible) return;
      bezierInto(o.pts, A.cur.get(a)!, A.cur.get(b)!, prog, LIFT);
      const attr = o.geo.attributes.instanceStart as THREE.InterleavedBufferAttribute;
      const buf = attr.data.array as Float32Array;
      for (let s = 0; s < SEG; s++) {
        for (let c = 0; c < 3; c++) {
          buf[s * 6 + c] = o.pts[s * 3 + c];
          buf[s * 6 + 3 + c] = o.pts[(s + 1) * 3 + c];
        }
      }
      attr.data.needsUpdate = true;
      void i;
    });
    // Pulses travel outward along the chain, one edge after the other.
    const t = state.clock.elapsedTime * 0.42;
    pulses.meshes.forEach((m, j) => {
      const phase = (t + j / pulses.meshes.length) % 1;
      const seg = Math.min(objs.length - 1, Math.floor(phase * objs.length));
      const local = phase * objs.length - seg;
      const o = objs[seg];
      const [a, b] = orient(o.ed, A.layout);
      m.visible = chainDone && near && A.progress > 0.98;
      if (!m.visible) return;
      bezierAt(A.cur.get(a)!, A.cur.get(b)!, local, LIFT, tmp);
      m.position.copy(tmp);
      const fade = Math.sin(local * Math.PI);
      m.scale.setScalar(0.6 + 0.4 * fade);
    });
  });
  return <group ref={group} />;
}

/* ----------------------------------------------------------- rings + dial */

function Rings({ anim, palette }: { anim: React.RefObject<Anim>; palette: Palette }) {
  const group = useRef<THREE.Group>(null);
  const ringObjs = useMemo(
    () =>
      RINGS.map((ring) => {
        const pts: THREE.Vector3[] = [];
        for (let i = 0; i <= 256; i++) {
          const a = (i / 256) * Math.PI * 2;
          pts.push(new THREE.Vector3(Math.cos(a) * ring.radius, 0, Math.sin(a) * ring.radius));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({ color: palette.teal, transparent: true, opacity: 0, depthWrite: false, fog: true });
        return { ring, line: new THREE.Line(geo, mat), mat };
      }),
    [palette],
  );
  const dial = useMemo(() => {
    const pos: number[] = [];
    for (let m = 0; m <= MONTH_COUNT; m++) {
      const a = angleOfDay(monthStartDay(m));
      const len = m % 3 === 0 ? 0.32 : 0.14;
      pos.push(Math.cos(a) * DIAL_R, 0, Math.sin(a) * DIAL_R, Math.cos(a) * (DIAL_R + len), 0, Math.sin(a) * (DIAL_R + len));
    }
    // The dial arc itself
    const arc: THREE.Vector3[] = [];
    const a0 = angleOfDay(monthStartDay(0));
    const a1 = angleOfDay(monthStartDay(MONTH_COUNT));
    for (let i = 0; i <= 200; i++) {
      const a = a0 + ((a1 - a0) * i) / 200;
      arc.push(new THREE.Vector3(Math.cos(a) * DIAL_R, 0, Math.sin(a) * DIAL_R));
    }
    const tickGeo = new THREE.BufferGeometry();
    tickGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.LineBasicMaterial({ color: palette.text3, transparent: true, opacity: 0.45, depthWrite: false, fog: true });
    const arcMat = new THREE.LineBasicMaterial({ color: palette.text3, transparent: true, opacity: 0.22, depthWrite: false, fog: true });
    return { ticks: new THREE.LineSegments(tickGeo, mat), arc: new THREE.Line(new THREE.BufferGeometry().setFromPoints(arc), arcMat) };
  }, [palette]);
  const hand = useMemo(() => {
    // The playhead on the clock: an arc from the window start to now, and a short tick at now.
    const N = 160;
    const geo = new THREE.BufferGeometry();
    const arr = new Float32Array((N + 1 + 2) * 3);
    geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    const mat = new THREE.LineBasicMaterial({ color: palette.tealBright, transparent: true, opacity: 0, depthWrite: false });
    const tickGeo = new THREE.BufferGeometry();
    const tickArr = new Float32Array(6);
    tickGeo.setAttribute("position", new THREE.BufferAttribute(tickArr, 3));
    const line = new THREE.Line(geo, mat);
    const tick = new THREE.LineSegments(tickGeo, mat);
    line.add(tick);
    line.frustumCulled = false;
    tick.frustumCulled = false;
    return { line, mat, arr, geo, tickArr, tickGeo, N };
  }, [palette]);

  useLayoutEffect(() => {
    const g = group.current!;
    for (const r of ringObjs) g.add(r.line);
    g.add(dial.ticks, dial.arc, hand.line);
    return () => {
      for (const r of ringObjs) g.remove(r.line);
      g.remove(dial.ticks, dial.arc, hand.line);
    };
  }, [ringObjs, dial, hand]);

  useFrame((_, delta) => {
    const A = anim.current;
    group.current!.position.copy(A.ringCur);
    const damp = 1 - Math.exp(-delta * 6);
    for (const r of ringObjs) {
      const count = A.layout.rings.get(r.ring.kind) ?? 0;
      const target = count > 0 ? 0.42 : r.ring.kind === "ties" ? 0 : 0.12;
      r.mat.opacity += (target - r.mat.opacity) * damp;
      r.line.visible = r.mat.opacity > 0.005;
    }
    const ts = timeStore.get();
    const active = ts.playing || ts.playhead < ts.end - 0.5;
    hand.mat.opacity += ((active ? 0.9 : 0) - hand.mat.opacity) * damp;
    hand.line.visible = hand.mat.opacity > 0.01;
    const a = angleOfDay(ts.playhead);
    const a0 = angleOfDay(ts.start);
    for (let i = 0; i <= hand.N; i++) {
      const ai = a0 + ((a - a0) * i) / hand.N;
      hand.arr[i * 3] = Math.cos(ai) * DIAL_R;
      hand.arr[i * 3 + 1] = 0;
      hand.arr[i * 3 + 2] = Math.sin(ai) * DIAL_R;
    }
    hand.geo.setDrawRange(0, hand.N + 1);
    hand.geo.attributes.position.needsUpdate = true;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    hand.tickArr.set([c * (DIAL_R - 0.45), 0, sn * (DIAL_R - 0.45), c * (DIAL_R + 0.5), 0, sn * (DIAL_R + 0.5)]);
    hand.tickGeo.attributes.position.needsUpdate = true;
  });

  return (
    <group ref={group}>
      {RINGS.map((ring) => (
        <RingLabel key={ring.kind} kind={ring.kind} label={ring.label} radius={ring.radius} anim={anim} />
      ))}
      {Array.from({ length: MONTH_COUNT / 3 + 1 }, (_, i) => i * 3)
        .filter((m) => m < MONTH_COUNT)
        .map((m) => {
          const a = angleOfDay(monthStartDay(m));
          const r = DIAL_R + 0.62;
          return (
            <Html key={m} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
              <span className="text-[11px] leading-4 whitespace-nowrap text-fg-3 tabular-nums">{monthLabel(m, true)}</span>
            </Html>
          );
        })}
    </group>
  );
}

/** Ring name at 12 o'clock (the gap in the clock), with the record count for this focus. */
function RingLabel({ kind, label, radius, anim }: { kind: RingKind; label: string; radius: number; anim: React.RefObject<Anim> }) {
  const el = useRef<HTMLSpanElement>(null);
  const last = useRef<number>(-1);
  useFrame(() => {
    const count = anim.current.layout.rings.get(kind) ?? 0;
    if (!el.current) return;
    const target = count > 0 ? "1" : kind === "ties" ? "0" : "0.45";
    if (el.current.style.opacity !== target) el.current.style.opacity = target;
    if (last.current !== count) {
      last.current = count;
      el.current.dataset.count = String(count);
      el.current.textContent = count > 0 ? `${label} · ${count}` : label;
    }
  });
  return (
    <Html position={[0, 0, -radius]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <span
        ref={el}
        className="block -translate-y-[9px] rounded-[3px] bg-bg px-1.5 text-[11px] leading-4 font-medium whitespace-nowrap text-teal-bright transition-opacity duration-200"
      >
        {label}
      </span>
    </Html>
  );
}

/* ----------------------------------------------------------- edge labels */

/** Edge label elements, shared with the label declutter pass. */
const EDGE_LABEL_REFS = new Map<string, { g: THREE.Group | null; el: HTMLSpanElement | null }>();

function EdgeLabels({ anim, focus, hover }: { anim: React.RefObject<Anim>; focus: string; hover: string | null }) {
  const focusEdges = useMemo(() => edgesOf(focus), [focus]);
  const shown = useMemo(() => {
    if (focusEdges.length <= 8) return focusEdges;
    return focusEdges.filter((ed) => PATH_EDGES.has(ed.id) || ed.source === hover || ed.target === hover);
  }, [focusEdges, hover]);
  const refs = useRef(EDGE_LABEL_REFS);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const A = anim.current;
    const ts = timeStore.get();
    const grow = growDays(ts);
    for (const ed of shown) {
      const r = refs.current.get(ed.id);
      if (!r?.g) continue;
      const [a, b] = orient(ed, A.layout);
      bezierAt(A.cur.get(a)!, A.cur.get(b)!, 0.55, LIFT, tmp);
      r.g.position.copy(tmp);
      const prog = clamp01((ts.playhead - edgeDay(ed)) / grow);
      const vis = Math.min(A.vis.get(a)!, A.vis.get(b)!) * (prog > 0.9 ? 1 : 0) * (A.progress > 0.6 ? 1 : 0);
      if (r.el) r.el.style.opacity = String(vis);
    }
  });
  return (
    <>
      {shown.map((ed) => {
        const path = PATH_EDGES.has(ed.id);
        return (
          <group
            key={ed.id}
            ref={(g) => {
              const cur = refs.current.get(ed.id) ?? { g: null, el: null };
              refs.current.set(ed.id, { ...cur, g });
            }}
          >
            <Html center zIndexRange={[25, 0]} style={{ pointerEvents: "none" }}>
              <span
                ref={(el) => {
                  const cur = refs.current.get(ed.id) ?? { g: null, el: null };
                  refs.current.set(ed.id, { ...cur, el });
                }}
                className={`block rounded-[3px] border px-1.5 text-[11px] leading-[16px] font-medium whitespace-nowrap transition-opacity duration-200 ${
                  path ? "border-orange/70 text-orange-ink" : "border-teal/60 text-teal-bright"
                }`}
                style={{ background: "var(--label-bg)", opacity: 0 }}
              >
                {ed.label}
              </span>
            </Html>
          </group>
        );
      })}
    </>
  );
}

/* ------------------------------------------------------------- declutter */

/** Hides lower-priority labels that overlap a higher-priority one (screen space, every frame). */
function Declutter({ nodeRefs, focus, hover }: { nodeRefs: Map<string, NodeRefs>; focus: string; hover: string | null }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new THREE.Vector3(), []);
  const dims = useMemo(() => new Map<HTMLElement, [number, number]>(), []);
  useFrame(() => {
    const layout = layoutFor(focus);
    const items: { el: HTMLDivElement; pri: number; x0: number; y0: number; x1: number; y1: number }[] = [];
    for (const [id, r] of nodeRefs) {
      const el = r.html;
      if (!el || !el.isConnected) continue;
      if (!r.group.visible) {
        el.style.visibility = "hidden";
        continue;
      }
      let d = dims.get(el);
      if (!d || d[0] === 0) {
        d = [el.offsetWidth, el.offsetHeight];
        dims.set(el, d);
      }
      v.copy(r.group.position).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      const card = el.dataset.kind === "card";
      const off = Number(el.dataset.off ?? 0);
      const [w, h] = d;
      const x0 = card ? x + off : x - w / 2;
      const y0 = card ? y - h / 2 : y + 12;
      const p = layout.pos.get(id);
      const pri = id === hover ? 1000 : id === focus ? 900 : PATH_SET.has(id) ? 500 : p && p.depth === 1 ? 300 - v.z : 200 - v.z;
      items.push({ el, pri, x0, y0, x1: x0 + w, y1: y0 + h });
    }
    for (const [, r] of EDGE_LABEL_REFS) {
      const el = r.el;
      if (!r.g || !el || !el.isConnected || el.style.opacity === "0") continue;
      let d = dims.get(el);
      if (!d || d[0] === 0) {
        d = [el.offsetWidth, el.offsetHeight];
        dims.set(el, d);
      }
      v.copy(r.g.position).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      items.push({ el: el as unknown as HTMLDivElement, pri: 450, x0: x - d[0] / 2, y0: y - d[1] / 2, x1: x + d[0] / 2, y1: y + d[1] / 2 });
    }
    items.sort((a, b) => b.pri - a.pri);
    const placed: typeof items = [];
    for (const it of items) {
      const hit = placed.some((p) => it.x0 < p.x1 + 3 && it.x1 > p.x0 - 3 && it.y0 < p.y1 + 1 && it.y1 > p.y0 - 1);
      it.el.style.visibility = hit ? "hidden" : "visible";
      if (!hit) placed.push(it);
    }
  });
  return null;
}

/* ---------------------------------------------------------------- camera */

const POLAR = (55 * Math.PI) / 180;

function CameraRig({ focus }: { focus: string }) {
  const controls = useRef<CameraControls>(null);
  const first = useRef(true);
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const hub = edgesOf(focus).length > 8;
    const dist = hub ? 20.5 : 18.5;
    const az = first.current ? 0 : c.azimuthAngle;
    const x = dist * Math.sin(POLAR) * Math.sin(az);
    const z = dist * Math.sin(POLAR) * Math.cos(az);
    const y = dist * Math.cos(POLAR);
    // Aim a little in front of the center, so the far rings clear the header and the near dial clears the timeline.
    const tx = 0.9 * Math.sin(az);
    const tz = 0.9 * Math.cos(az);
    void c.setLookAt(x + tx, y, z + tz, tx, hub ? 0.5 : 0.4, tz, !first.current);
    first.current = false;
  }, [focus]);
  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={0.42}
      draggingSmoothTime={0.12}
      minDistance={6}
      maxDistance={34}
      minPolarAngle={0.25}
      maxPolarAngle={1.32}
    />
  );
}

/* ----------------------------------------------------------------- scene */

function Scene({ focus, hover, onFocus, onHover }: OrbitSceneProps) {
  const palette = useMemo(readPalette, []);
  const anim = useRef<Anim>(createAnim(focus));
  const nodeRefs = useMemo(() => new Map<string, NodeRefs>(), []);
  const register = useMemo(
    () => (id: string, r: Partial<NodeRefs>) => {
      const cur = nodeRefs.get(id);
      nodeRefs.set(id, { ...(cur ?? { group: r.group! }), ...r } as NodeRefs);
    },
    [nodeRefs],
  );
  const clock = useThree((s) => s.clock);

  // A new focus: every node travels to its new place; the rings slide from the old position of the new center.
  useEffect(() => {
    const A = anim.current;
    if (A.layout.focus === focus) return;
    A.from = new Map([...A.cur].map(([k, v]) => [k, v.clone()]));
    A.ringFrom = A.cur.get(focus)!.clone();
    A.layout = layoutFor(focus);
    A.t0 = clock.elapsedTime;
  }, [focus, clock]);

  const layout = layoutFor(focus);
  const pathNear = PATH_NODES.every((id) => layout.pos.get(id)!.near);
  const visibleCards = useMemo(() => new Set<string>([focus]), [focus]);

  return (
    <>
      <fog attach="fog" args={[palette.bg, 19, 40]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-6, 12, 8]} intensity={1.5} />
      <directionalLight position={[8, 3, -6]} intensity={0.35} color={palette.teal} />
      {/* The first drei Html in this canvas never attaches (seen in dev and prod); this empty one takes that slot. */}
      <Html>
        <span />
      </Html>
      <Driver anim={anim} focus={focus} nodeRefs={nodeRefs} />
      <Rings anim={anim} palette={palette} />
      <Edges anim={anim} focus={focus} hover={hover} palette={palette} />
      <FocusPath anim={anim} palette={palette} />
      {nodes.map((n) => {
        const p = layout.pos.get(n.id)!;
        const isCard = visibleCards.has(n.id) || (hover === n.id && !n.context);
        const isTag = !isCard && p.near && p.depth <= 2;
        return (
          <NodeView
            key={n.id}
            node={n}
            near={p.near}
            isFocus={n.id === focus}
            isPath={PATH_SET.has(n.id) && pathNear}
            isHover={hover === n.id}
            label={isCard ? "card" : isTag || hover === n.id ? "tag" : null}
            palette={palette}
            onFocus={onFocus}
            onHover={onHover}
            register={register}
          />
        );
      })}
      <EdgeLabels anim={anim} focus={focus} hover={hover} />
      <Declutter nodeRefs={nodeRefs} focus={focus} hover={hover} />
      <CameraRig focus={focus} />
      <EffectComposer multisampling={4} frameBufferType={THREE.HalfFloatType}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.08} intensity={0.85} radius={0.55} />
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
      camera={{ fov: 34, near: 0.5, far: 120, position: [0, 11, 16] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => props.onHover(null)}
      className="!absolute inset-0"
    >
      <Scene {...props} />
    </Canvas>
  );
}
