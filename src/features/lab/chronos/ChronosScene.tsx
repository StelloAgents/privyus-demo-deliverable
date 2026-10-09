"use client";

import { Billboard, CameraControls, Html } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import {
  ABROAD_LABEL_XZ,
  ACTIVE_STATES,
  DEPTH_BASE,
  DEPTH_SPAN,
  EDGES,
  MAP_RINGS,
  NODES,
  NODE_BY_ID,
  PLACED,
  ROOT_ID,
  T_START,
  T_END,
  anchorXZ,
  depthHeight,
  edgeAt,
  focusPath,
  formatDay,
  formatMonth,
  neighbors,
  nodeAt,
  timeT,
  type ChronosEdge,
  type ChronosNode,
} from "./data";
import { Avatar } from "./Glyph";
import { revealedCount, useChronos } from "./store";

/* ------------------------------------------------------------------ palette */

export interface Palette {
  bg: string;
  surface1: string;
  surface2: string;
  border: string;
  teal: string;
  tealBright: string;
  orange: string;
  text1: string;
  text3: string;
}

export function readPalette(): Palette {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bg: v("--bg", "#101418"),
    surface1: v("--surface-1", "#171c21"),
    surface2: v("--surface-2", "#1e242a"),
    border: v("--border", "#2a3239"),
    teal: v("--teal", "#598b97"),
    tealBright: v("--teal-bright", "#7fb6c2"),
    orange: v("--orange", "#f89b45"),
    text1: v("--text-1", "#f2f4f5"),
    text3: v("--text-3", "#7d8990"),
  };
}

/* ------------------------------------------------------------------ shared live layout */

/** Animated per-node state, written once per frame by <Driver/> and read by nodes and edges. */
interface Live {
  pos: THREE.Vector3;
  h: number;
  reveal: number;
  dim: number;
}
const live = new Map<string, Live>(
  NODES.map((n) => {
    const p = PLACED.get(n.id)!;
    return [n.id, { pos: new THREE.Vector3(p.x, p.flat, p.z), h: p.flat, reveal: 1, dim: 1 }];
  }),
);
const edgeProgress = new Map<string, number>(EDGES.map((e) => [e.id, 1]));

const damp = THREE.MathUtils.damp;

/** The set of nodes that stay bright for the current focus or hover. */
function litSet(focusId: string | null, hoverId: string | null): Set<string> | null {
  const id = focusId ?? hoverId;
  if (!id) return null;
  const s = neighbors(id);
  s.add(id);
  if (focusId && hoverId) {
    s.add(hoverId);
  }
  const path = focusPath(focusId);
  for (const e of EDGES) {
    if (path.has(e.id)) {
      s.add(e.s);
      s.add(e.t);
    }
  }
  return s;
}

function Driver() {
  const lit = useRef<Set<string> | null>(null);
  const focusId = useChronos((s) => s.focusId);
  const hoverId = useChronos((s) => s.hoverId);
  useEffect(() => {
    lit.current = litSet(focusId, hoverId);
  }, [focusId, hoverId]);

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05);
    const { t, depth } = useChronos.getState();
    for (const n of NODES) {
      const L = live.get(n.id)!;
      const p = PLACED.get(n.id)!;
      const targetH = depth ? depthHeight(n) : p.flat;
      L.h = damp(L.h, targetH, 5, dt);
      L.pos.set(p.x, L.h, p.z);
      const on = nodeAt.get(n.id)! <= t;
      L.reveal = on ? damp(L.reveal, 1, 9, dt) : damp(L.reveal, 0, 18, dt);
      const set = lit.current;
      const dimTarget = !set || set.has(n.id) ? 1 : 0.22;
      L.dim = damp(L.dim, dimTarget, 14, dt);
    }
    for (const e of EDGES) {
      const on = edgeAt.get(e.id)! <= t;
      const cur = edgeProgress.get(e.id)!;
      edgeProgress.set(e.id, on ? Math.min(1, cur + dt / 0.55) : 0);
    }
  }, -1);
  return null;
}

/* ------------------------------------------------------------------ map */

const MapBase = memo(function MapBase({ palette }: { palette: Palette }) {
  const focusId = useChronos((s) => s.focusId);
  const focusState = focusId ? NODE_BY_ID.get(focusId)?.anchor : undefined;

  const { fillAll, fillActive, outline, grid } = useMemo(() => {
    const toShape = (ring: [number, number][]) => new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z)));
    const all: THREE.BufferGeometry[] = [];
    const active: THREE.BufferGeometry[] = [];
    const seg: number[] = [];
    for (const { code, ring } of MAP_RINGS) {
      const g = new THREE.ShapeGeometry(toShape(ring), 1);
      (ACTIVE_STATES.has(code) ? active : all).push(g);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        seg.push(a[0], 0.004, a[1], b[0], 0.004, b[1]);
      }
    }
    const outlineGeo = new THREE.BufferGeometry();
    outlineGeo.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    // A sparse dot grid on the ground: it shows only where no state fill covers it (the oceans).
    const pts: number[] = [];
    for (let x = -7.5; x <= 8.5; x += 0.25) for (let z = -4.5; z <= 4.5; z += 0.25) pts.push(x, -0.01, z);
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return { fillAll: mergeGeometries(all), fillActive: mergeGeometries(active), outline: outlineGeo, grid: gridGeo };
  }, []);

  const focusFill = useMemo(() => {
    if (!focusState || focusState.startsWith("ABROAD")) return null;
    const rings = MAP_RINGS.filter((r) => r.code === focusState);
    if (!rings.length) return null;
    return mergeGeometries(rings.map(({ ring }) => new THREE.ShapeGeometry(new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z))), 1)));
  }, [focusState]);

  const land = new THREE.Color(palette.surface1);
  const landActive = new THREE.Color(palette.surface1).lerp(new THREE.Color(palette.surface2), 0.45);

  return (
    <group>
      <points geometry={grid}>
        <pointsMaterial color={palette.text3} size={1.4} sizeAttenuation={false} transparent opacity={0.22} depthWrite={false} />
      </points>
      <mesh geometry={fillAll} rotation-x={-Math.PI / 2}>
        <meshBasicMaterial color={land} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={fillActive} rotation-x={-Math.PI / 2} position-y={0.001}>
        <meshBasicMaterial color={landActive} side={THREE.DoubleSide} />
      </mesh>
      {focusFill && (
        <mesh geometry={focusFill} rotation-x={-Math.PI / 2} position-y={0.002}>
          <meshBasicMaterial color={palette.teal} transparent opacity={0.16} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      <lineSegments geometry={outline}>
        <lineBasicMaterial color={palette.teal} transparent opacity={0.34} />
      </lineSegments>
      <Anchors palette={palette} />
    </group>
  );
});

const ANCHOR_LABELS: { anchor: string; label: string }[] = [
  { anchor: "OH", label: "Ohio" },
  { anchor: "DC", label: "Washington, DC" },
  { anchor: "WA", label: "Washington State" },
  { anchor: "TX", label: "Texas" },
];

function Anchors({ palette }: { palette: Palette }) {
  const anchors = useMemo(() => {
    const set = new Set(NODES.map((n) => n.anchor));
    return [...set].map((a) => ({ a, xz: anchorXZ(a), context: NODES.filter((n) => n.anchor === a).every((n) => n.kind === "context") }));
  }, []);
  return (
    <group>
      {anchors.map(({ a, xz, context }) => (
        <group key={a} position={[xz[0], 0.006, xz[1]]} rotation-x={-Math.PI / 2}>
          <mesh>
            <ringGeometry args={[context ? 0.03 : 0.05, context ? 0.042 : 0.066, 32]} />
            <meshBasicMaterial color={palette.tealBright} transparent opacity={context ? 0.35 : 0.8} />
          </mesh>
        </group>
      ))}
      {ANCHOR_LABELS.map(({ anchor, label }) => {
        const [x, z] = anchorXZ(anchor);
        return (
          <Html key={anchor} position={[x, 0, z]} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
            <div className="chronos-ground">{label}</div>
          </Html>
        );
      })}
      <Html position={[ABROAD_LABEL_XZ[0], 0, ABROAD_LABEL_XZ[1]]} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div className="chronos-ground">Abroad · Europe</div>
      </Html>
    </group>
  );
}

/* ------------------------------------------------------------------ depth guides */

const BOX = { x0: -6.4, x1: 7.6, z0: -3.4, z1: 3.4 };

function rectPoints(y: number): number[] {
  const { x0, x1, z0, z1 } = BOX;
  return [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1, x0, y, z0];
}

/** In the time-depth view: faint year planes, a date ruler, and the playhead plane. */
function DepthGuides({ palette }: { palette: Palette }) {
  const group = useRef<THREE.Group>(null);
  const play = useRef<THREE.Group>(null);
  const fade = useRef(0);
  const marks = useMemo(
    () =>
      [Date.UTC(2025, 0, 1), Date.UTC(2025, 6, 1), Date.UTC(2026, 0, 1), Date.UTC(2026, 6, 1)].map((ms) => ({
        ms,
        y: DEPTH_BASE + timeT(ms) * DEPTH_SPAN,
        label: formatMonth(ms),
      })),
    [],
  );
  const planes = useMemo(
    () =>
      marks.map((m) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(rectPoints(m.y), 3));
        return g;
      }),
    [marks],
  );
  const playGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(rectPoints(0), 3));
    return g;
  }, []);
  const ruler = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pts = [BOX.x1, 0, BOX.z0, BOX.x1, DEPTH_BASE + DEPTH_SPAN, BOX.z0];
    for (const m of marks) pts.push(BOX.x1, m.y, BOX.z0, BOX.x1 - 0.18, m.y, BOX.z0);
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, [marks]);
  const labelRef = useRef<HTMLDivElement>(null);

  useFrame((_, dt) => {
    const { depth, t } = useChronos.getState();
    fade.current = damp(fade.current, depth ? 1 : 0, 6, Math.min(dt, 0.05));
    const g = group.current;
    if (!g) return;
    g.visible = fade.current > 0.01;
    g.traverse((o) => {
      const m = (o as THREE.Line).material as THREE.LineBasicMaterial | undefined;
      if (m && "userData" in m && m.userData.base !== undefined) m.opacity = m.userData.base * fade.current;
    });
    if (play.current) play.current.position.y = DEPTH_BASE + timeT(t) * DEPTH_SPAN;
    const o = String(fade.current);
    document.querySelectorAll<HTMLElement>(".chronos-ruler-mark").forEach((el) => (el.style.opacity = o));
    if (labelRef.current) {
      labelRef.current.style.opacity = o;
      labelRef.current.textContent = formatDay(t);
    }
  });

  return (
    <group ref={group}>
      {planes.map((g, i) => (
        <lineLoop key={i} geometry={g}>
          <lineBasicMaterial color={palette.tealBright} transparent opacity={0} userData={{ base: 0.07 }} depthWrite={false} />
        </lineLoop>
      ))}
      <lineSegments geometry={ruler}>
        <lineBasicMaterial color={palette.text3} transparent opacity={0} userData={{ base: 0.7 }} />
      </lineSegments>
      {marks.map((m) => (
        <Html key={m.ms} position={[BOX.x1 + 0.1, m.y, BOX.z0]} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
          <div className="chronos-ruler chronos-ruler-mark" style={{ opacity: 0 }}>
            {m.label}
          </div>
        </Html>
      ))}
      <group ref={play}>
        <lineLoop geometry={playGeo}>
          <lineBasicMaterial color={palette.text1} transparent opacity={0} userData={{ base: 0.2 }} depthWrite={false} />
        </lineLoop>
        <Html position={[BOX.x1 + 0.1, 0, BOX.z0]} zIndexRange={[6, 0]} style={{ pointerEvents: "none" }}>
          <div ref={labelRef} className="chronos-ruler chronos-ruler-now" style={{ opacity: 0 }} />
        </Html>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ nodes */

type CardMode = "full" | "compact" | null;

const ORANGE_HDR = 1;

function NodeMesh({ node, palette, card }: { node: ChronosNode; palette: Palette; card: CardMode }) {
  const p = PLACED.get(node.id)!;
  const group = useRef<THREE.Group>(null);
  const fill = useRef<THREE.MeshBasicMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const halo = useRef<THREE.MeshBasicMaterial>(null);
  const leaderObj = useMemo(() => {
    const g = new LineGeometry();
    g.setPositions([0, 0, 0, 0, 1, 0]);
    const m = new LineMaterial({ color: palette.teal, linewidth: 1, transparent: true, opacity: 0.4, depthWrite: false });
    const l = new Line2(g, m);
    l.frustumCulled = false;
    return l;
  }, [palette.teal]);
  const leaderRef = useRef<Line2>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const setFocus = useChronos((s) => s.setFocus);
  const setHover = useChronos((s) => s.setHover);
  const focusId = useChronos((s) => s.focusId);
  const hoverId = useChronos((s) => s.hoverId);
  const focused = focusId === node.id;
  const hovered = hoverId === node.id;
  const context = node.kind === "context";
  const r = p.r;

  const orange = useMemo(() => new THREE.Color(palette.orange).multiplyScalar(ORANGE_HDR), [palette.orange]);
  const teal = useMemo(() => new THREE.Color(palette.teal), [palette.teal]);
  const tealBright = useMemo(() => new THREE.Color(palette.tealBright), [palette.tealBright]);

  useFrame(() => {
    const L = live.get(node.id)!;
    const g = group.current;
    if (!g) return;
    g.position.copy(L.pos);
    const s = Math.max(0.0001, 0.6 + 0.4 * L.reveal);
    g.scale.setScalar(s);
    g.visible = L.reveal > 0.02;
    const base = context ? 0.45 : 1;
    const a = L.reveal * L.dim * base;
    if (fill.current) fill.current.opacity = a;
    if (ring.current) {
      ring.current.opacity = a;
      ring.current.color.copy(focused ? orange : hovered ? tealBright : teal);
    }
    if (halo.current) halo.current.opacity = focused ? 0.14 * L.reveal : 0;
    // Leader line from the node down to its ground anchor.
    const lo = leaderRef.current;
    if (!lo) return;
    const geo = lo.geometry as LineGeometry;
    const arr = (geo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.array as Float32Array;
    arr[0] = L.pos.x;
    arr[1] = L.pos.y - r;
    arr[2] = L.pos.z;
    arr[3] = p.ground[0];
    arr[4] = 0.005;
    arr[5] = p.ground[1];
    (geo.attributes.instanceStart as THREE.InterleavedBufferAttribute).data.needsUpdate = true;
    const lm = lo.material as LineMaterial;
    lm.opacity = L.reveal * L.dim * (context ? 0.18 : focused ? 0.75 : 0.32);
    lm.color.copy(focused ? tealBright : teal);
    lo.visible = L.reveal > 0.02;
    if (cardRef.current) cardRef.current.style.opacity = String(Math.min(1, L.reveal * 1.2) * (card === "full" ? 1 : 0.35 + 0.65 * L.dim));
  });

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (live.get(node.id)!.reveal < 0.5) return;
    setHover(node.id);
    document.body.style.cursor = "pointer";
  };
  const onOut = () => {
    if (useChronos.getState().hoverId === node.id) setHover(null);
    document.body.style.cursor = "";
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (live.get(node.id)!.reveal < 0.5) return;
    setFocus(node.id);
  };

  return (
    <>
      <primitive ref={leaderRef} object={leaderObj} />
      <group ref={group}>
        <Billboard>
          <mesh renderOrder={2}>
            <circleGeometry args={[r * 1.7, 48]} />
            <meshBasicMaterial ref={halo} color={palette.orange} transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} renderOrder={3}>
            <circleGeometry args={[r * 1.6, 32]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh renderOrder={3}>
            <circleGeometry args={[r, 48]} />
            <meshBasicMaterial ref={fill} color={palette.surface2} transparent depthWrite={false} />
          </mesh>
          <mesh renderOrder={4}>
            <ringGeometry args={[r * (node.kind === "member" ? 0.84 : 0.8), r, 64]} />
            <meshBasicMaterial ref={ring} color={palette.teal} transparent toneMapped={false} depthWrite={false} />
          </mesh>
          {node.kind === "record" && (
            <mesh renderOrder={4}>
              <circleGeometry args={[r * 0.28, 24]} />
              <meshBasicMaterial color={palette.tealBright} transparent opacity={0.9} depthWrite={false} />
            </mesh>
          )}
        </Billboard>
        {card && (
          <Html position={[0, r * 1.15, 0]} zIndexRange={card === "full" ? [30, 20] : [19, 10]} style={{ pointerEvents: "none" }}>
            <div ref={cardRef} className={card === "full" ? "chronos-card-anchor chronos-card-anchor-full" : "chronos-card-anchor"}>
              <FaceCard node={node} mode={card} onClick={() => setFocus(node.id)} />
            </div>
          </Html>
        )}
      </group>
    </>
  );
}

function FaceCard({ node, mode, onClick }: { node: ChronosNode; mode: "full" | "compact"; onClick: () => void }) {
  if (mode === "compact") {
    return (
      <button type="button" className="chronos-card chronos-card-compact" onClick={onClick}>
        <Avatar initials={node.initials} glyph={node.glyph} size={22} />
        <span className="min-w-0">
          <span className="chronos-card-name">{node.label}</span>
          <span className="chronos-card-sub">{node.sub}</span>
        </span>
      </button>
    );
  }
  const n = neighbors(node.id).size;
  return (
    <div className="chronos-card chronos-card-full">
      <Avatar initials={node.initials} glyph={node.glyph} size={40} focused />
      <div className="min-w-0">
        <div className="chronos-card-title">{node.label}</div>
        <div className="chronos-card-sub2">{node.sub}</div>
        <div className="chronos-card-meta">
          {[node.category, node.source, `${n} connection${n === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ edges */

const SEGS = 36;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Vector3();

function arcPoint(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3) {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    u * u * a.z + 2 * u * t * c.z + t * t * b.z,
  );
}

function controlPoint(a: THREE.Vector3, b: THREE.Vector3, out: THREE.Vector3) {
  const d = Math.hypot(a.x - b.x, a.z - b.z);
  out.set((a.x + b.x) / 2, Math.max(a.y, b.y) + 0.1 + d * 0.13, (a.z + b.z) / 2);
  return out;
}

function EdgeArc({ edge, palette, role, showLabel }: { edge: ChronosEdge; palette: Palette; role: "base" | "lit" | "path"; showLabel: boolean }) {
  const line = useMemo(() => {
    const g = new LineGeometry();
    g.setPositions(new Array((SEGS + 1) * 3).fill(0));
    const m = new LineMaterial({ color: palette.teal, linewidth: 1, transparent: true, opacity: 0.5, depthWrite: false });
    const l = new Line2(g, m);
    l.frustumCulled = false;
    l.renderOrder = 1;
    return l;
  }, [palette.teal]);
  const lineRef = useRef<Line2>(null);
  const labelGroup = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const context = NODE_BY_ID.get(edge.t)?.kind === "context" || NODE_BY_ID.get(edge.s)?.kind === "context";
  const orange = useMemo(() => new THREE.Color(palette.orange).multiplyScalar(ORANGE_HDR), [palette.orange]);
  const teal = useMemo(() => new THREE.Color(palette.teal), [palette.teal]);
  const tealBright = useMemo(() => new THREE.Color(palette.tealBright), [palette.tealBright]);
  const op = useRef(0.4);

  useFrame((_, dt) => {
    const A = live.get(edge.s)!;
    const B = live.get(edge.t)!;
    _a.copy(A.pos);
    _b.copy(B.pos);
    controlPoint(_a, _b, _c);
    const ln = lineRef.current;
    if (!ln) return;
    const geo = ln.geometry as LineGeometry;
    const attr = geo.attributes.instanceStart as THREE.InterleavedBufferAttribute;
    const arr = attr.data.array as Float32Array;
    let px = _a.x;
    let py = _a.y;
    let pz = _a.z;
    for (let i = 1; i <= SEGS; i++) {
      arcPoint(_a, _c, _b, i / SEGS, _q);
      const o = (i - 1) * 6;
      arr[o] = px;
      arr[o + 1] = py;
      arr[o + 2] = pz;
      arr[o + 3] = _q.x;
      arr[o + 4] = _q.y;
      arr[o + 5] = _q.z;
      px = _q.x;
      py = _q.y;
      pz = _q.z;
    }
    attr.data.needsUpdate = true;
    const prog = edgeProgress.get(edge.id)!;
    // Ease the draw so each arc lands softly on its target.
    const eased = 1 - Math.pow(1 - prog, 3);
    geo.instanceCount = Math.max(0, Math.round(eased * SEGS));
    ln.visible = prog > 0;
    const m = ln.material as LineMaterial;
    const dim = Math.min(A.dim, B.dim);
    const target = role === "path" ? 1 : role === "lit" ? 0.9 : (context ? 0.22 : 0.5) * dim;
    op.current = damp(op.current, target, 14, Math.min(dt, 0.05));
    m.opacity = op.current * Math.min(A.reveal, B.reveal, 1);
    m.color.copy(role === "path" ? orange : role === "lit" ? tealBright : teal);
    m.linewidth = role === "path" ? 2 : role === "lit" ? 1.5 : 1;
    if (labelGroup.current) {
      arcPoint(_a, _c, _b, 0.5, _q);
      labelGroup.current.position.copy(_q);
    }
    if (labelRef.current) labelRef.current.style.opacity = String(prog >= 1 ? 1 : 0);
  });

  return (
    <>
      <primitive ref={lineRef} object={line} />
      {showLabel && (
        <group ref={labelGroup}>
          <Html center zIndexRange={[9, 6]} style={{ pointerEvents: "none" }}>
            <div ref={labelRef} className={role === "path" ? "chronos-edge chronos-edge-path" : "chronos-edge"}>
              {edge.label}
            </div>
          </Html>
        </group>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ cards and roles */

const OVERVIEW_CARDS = ["hartley", "s456", "ukraine", "meeting-private", "aegis", "boreal", "redwood", "trip-kyiv"];
const MAX_NEIGHBOR_CARDS = 9;
const MAX_LABELS = 8;
const MAX_CARDS = 15;

function Graph({ palette }: { palette: Palette }) {
  const focusId = useChronos((s) => s.focusId);
  const hoverId = useChronos((s) => s.hoverId);
  const count = useChronos((s) => revealedCount(s.t));
  const t = useChronos.getState().t;

  const { cards, roles, labels } = useMemo(() => {
    void count;
    const revealed = (id: string) => nodeAt.get(id)! <= t;
    const cards = new Map<string, CardMode>();
    if (focusId) {
      cards.set(focusId, "full");
      const near = [...neighbors(focusId)].filter(revealed);
      // People and organizations first, then records by date.
      near.sort((a, b) => {
        const A = NODE_BY_ID.get(a)!;
        const B = NODE_BY_ID.get(b)!;
        const rank = (n: ChronosNode) => (n.kind === "member" ? 0 : n.kind === "person" || n.kind === "org" ? 1 : n.kind === "bill" ? 2 : 3);
        return rank(A) - rank(B) || (B.date ?? "").localeCompare(A.date ?? "");
      });
      for (const id of [ROOT_ID, ...near]) if (cards.size < Math.min(MAX_CARDS, MAX_NEIGHBOR_CARDS + 1) && !cards.has(id) && revealed(id)) cards.set(id, "compact");
    } else {
      for (const id of OVERVIEW_CARDS) if (revealed(id)) cards.set(id, "compact");
    }
    if (hoverId && !cards.has(hoverId)) cards.set(hoverId, "compact");

    const path = focusPath(focusId);
    const roles = new Map<string, "base" | "lit" | "path">();
    const labels = new Set<string>();
    for (const e of EDGES) {
      const touchesFocus = !!focusId && (e.s === focusId || e.t === focusId);
      const touchesHover = !!hoverId && (e.s === hoverId || e.t === hoverId);
      roles.set(e.id, path.has(e.id) ? "path" : touchesFocus || touchesHover ? "lit" : "base");
      // Labels: the focus path first, then focus edges whose far end carries a card.
      if (path.has(e.id) || (touchesFocus && cards.has(e.s === focusId ? e.t : e.s) && labels.size < MAX_LABELS)) labels.add(e.id);
    }
    return { cards, roles, labels };
  }, [focusId, hoverId, count, t]);

  return (
    <group>
      {EDGES.map((e) => (
        <EdgeArc key={e.id} edge={e} palette={palette} role={roles.get(e.id)!} showLabel={labels.has(e.id)} />
      ))}
      {NODES.map((n) => (
        <NodeMesh key={n.id} node={n} palette={palette} card={cards.get(n.id) ?? null} />
      ))}
    </group>
  );
}

/* ------------------------------------------------------------------ camera */

const OVERVIEW = { pos: [1.4, 7.4, 9.4] as const, target: [1.4, 0.5, 0.0] as const };
const OVERVIEW_DEPTH = { pos: [2.4, 6.4, 13.2] as const, target: [1.8, 2.6, 0.0] as const };

function finalPos(id: string, depth: boolean): THREE.Vector3 {
  const n = NODE_BY_ID.get(id)!;
  const p = PLACED.get(id)!;
  return new THREE.Vector3(p.x, depth ? depthHeight(n) : p.flat, p.z);
}

function Rig({ reduced }: { reduced: boolean }) {
  const controls = useRef<CameraControls>(null);
  const focusId = useChronos((s) => s.focusId);
  const depth = useChronos((s) => s.depth);
  const resetTick = useChronos((s) => s.resetTick);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const anim = !reduced;
    if (!focusId) {
      const v = depth ? OVERVIEW_DEPTH : OVERVIEW;
      void c.setLookAt(v.pos[0], v.pos[1], v.pos[2], v.target[0], v.target[1], v.target[2], anim);
      return;
    }
    const target = finalPos(focusId, depth);
    // Keep the viewer's current heading; settle at a readable distance and tilt.
    const dir = new THREE.Vector3();
    c.getPosition(dir);
    const cur = new THREE.Vector3();
    c.getTarget(cur);
    dir.sub(cur);
    dir.y = 0;
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, 1);
    dir.normalize();
    const kind = NODE_BY_ID.get(focusId)!.kind;
    const dist = kind === "member" ? 9 : 7;
    const pos = target.clone().addScaledVector(dir, dist * 0.72).add(new THREE.Vector3(0, dist * 0.7, 0));
    void c.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, anim);
  }, [focusId, depth, resetTick, reduced, camera]);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      smoothTime={reduced ? 0 : 0.42}
      draggingSmoothTime={0.08}
      minDistance={2}
      maxDistance={26}
      maxPolarAngle={Math.PI * 0.46}
      dollySpeed={0.6}
    />
  );
}

/* ------------------------------------------------------------------ scene */

export interface ChronosSceneProps {
  palette: Palette;
  reduced: boolean;
}

export default function ChronosScene({ palette, reduced }: ChronosSceneProps) {
  const setFocus = useChronos((s) => s.setFocus);
  return (
    <Canvas
      dpr={[1, 2]}
      flat
      camera={{ fov: 34, position: [...OVERVIEW.pos], near: 0.1, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => setFocus(null)}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={[palette.bg]} />
      <fog attach="fog" args={[palette.bg, 16, 34]} />
      <Driver />
      <MapBase palette={palette} />
      <DepthGuides palette={palette} />
      <Graph palette={palette} />
      <Rig reduced={reduced} />
    </Canvas>
  );
}

export { T_START, T_END };
