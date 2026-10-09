"use client";

import { CameraControls, Html, Line } from "@react-three/drei";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Line2, LineMaterial, LineSegments2 } from "three-stdlib";
import { EDGES, NODES, NODE_BY_ID, edgesOf, otherEnd, PLANES, PLANE_RADIUS, type Plane, type StrataEdge, type StrataNode } from "./graph";
import { EDGE_GEOM, pointFrom } from "./geometry";
import { NodeCard, EdgeChip } from "./cards";
import s from "./strata.module.css";
import { EDGE_OPACITY, NODE_OPACITY, type Visual } from "./visual";

/** Token values (DESIGN.md section 1). WebGL needs numbers, so they are read once here. */
const C = {
  bg: "#101418",
  teal: "#598b97",
  tealBright: "#7fb6c2",
  orange: "#f89b45",
  text2: "#adb7bd",
  text3: "#7d8990",
};

/** Matte node colors per plane. Hue says nothing; the plane says the kind. */
const NODE_COLOR: Record<StrataNode["plane"], string> = {
  bills: "#6f9ea9",
  people: "#a6b9bf",
  orgs: "#8796a0",
  records: "#9aa6ad",
};

export const DEFAULT_CAMERA: [number, number, number] = [22.5, 11.5, 28];
export const DEFAULT_TARGET: [number, number, number] = [0, -0.6, 0];
const FOCUS_DISTANCE = 27;

/** Orange above 1.0: only these pixels pass the bloom threshold. */
const HOT_ORANGE = new THREE.Color(C.orange).multiplyScalar(2.6);

/* ---------- Planes ---------- */

function planeGeometry(): THREE.BufferGeometry {
  const pts: number[] = [];
  const rings = [2.4, 4.8, 7.2];
  const seg = 128;
  for (const r of rings) {
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2;
      const a1 = ((i + 1) / seg) * Math.PI * 2;
      pts.push(r * Math.cos(a0), 0, r * Math.sin(a0), r * Math.cos(a1), 0, r * Math.sin(a1));
    }
  }
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * Math.PI * 2;
    const inner = k % 2 === 0 ? 1.2 : 4.8;
    pts.push(inner * Math.cos(a), 0, inner * Math.sin(a), PLANE_RADIUS * Math.cos(a), 0, PLANE_RADIUS * Math.sin(a));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

function rimGeometry(): THREE.BufferGeometry {
  const pts: number[] = [];
  const seg = 256;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2;
    const a1 = ((i + 1) / seg) * Math.PI * 2;
    pts.push(PLANE_RADIUS * Math.cos(a0), 0, PLANE_RADIUS * Math.sin(a0), PLANE_RADIUS * Math.cos(a1), 0, PLANE_RADIUS * Math.sin(a1));
  }
  // Ticks on the rim, every 5 degrees, longer every 30.
  for (let d = 0; d < 360; d += 5) {
    const a = (d * Math.PI) / 180;
    const len = d % 30 === 0 ? 0.42 : 0.16;
    pts.push(PLANE_RADIUS * Math.cos(a), 0, PLANE_RADIUS * Math.sin(a), (PLANE_RADIUS + len) * Math.cos(a), 0, (PLANE_RADIUS + len) * Math.sin(a));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

const GRID_GEOM = planeGeometry();
const RIM_GEOM = rimGeometry();
const LABEL_DEG = 152;

function StratumPlane({ plane, active }: { plane: Plane; active: boolean }) {
  const grid = useRef<THREE.LineBasicMaterial>(null);
  const rim = useRef<THREE.LineBasicMaterial>(null);
  const disc = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => {
    if (grid.current) grid.current.opacity = THREE.MathUtils.damp(grid.current.opacity, active ? 0.16 : 0.085, 10, dt);
    if (rim.current) rim.current.opacity = THREE.MathUtils.damp(rim.current.opacity, active ? 0.5 : 0.26, 10, dt);
    if (disc.current) disc.current.opacity = THREE.MathUtils.damp(disc.current.opacity, active ? 0.05 : 0.028, 10, dt);
  });
  const a = (LABEL_DEG * Math.PI) / 180;
  const count = NODES.filter((n) => n.plane === plane.id).length;
  return (
    <group position={[0, plane.y, 0]}>
      <mesh rotation-x={-Math.PI / 2} renderOrder={-2}>
        <circleGeometry args={[PLANE_RADIUS, 96]} />
        <meshBasicMaterial ref={disc} color={C.teal} transparent opacity={0.028} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments geometry={GRID_GEOM} renderOrder={-1}>
        <lineBasicMaterial ref={grid} color={C.teal} transparent opacity={0.085} depthWrite={false} />
      </lineSegments>
      <lineSegments geometry={RIM_GEOM} renderOrder={-1}>
        <lineBasicMaterial ref={rim} color={C.tealBright} transparent opacity={0.26} depthWrite={false} />
      </lineSegments>
      <Html position={[(PLANE_RADIUS + 0.7) * Math.cos(a), 0, (PLANE_RADIUS + 0.7) * Math.sin(a)]} zIndexRange={[5, 0]} style={{ pointerEvents: "none" }}>
        <div className={s.planeLabel} data-active={active || undefined} data-declutter={50}>
          <span>{plane.label}</span>
          <span className={s.planeCount}>{count}</span>
        </div>
      </Html>
    </group>
  );
}

/* ---------- Nodes ---------- */

const SPHERE = new THREE.SphereGeometry(1, 32, 20);
const RING = new THREE.RingGeometry(1.55, 1.62, 64);

function NodeMesh({
  node,
  role,
  hovered,
  onFocus,
  onHover,
}: {
  node: StrataNode;
  role: Visual["node"] extends Map<string, infer R> ? R : never;
  hovered: boolean;
  onFocus: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const base = useMemo(() => new THREE.Color(NODE_COLOR[node.plane]), [node.plane]);
  const orange = useMemo(() => new THREE.Color(C.orange), []);
  const teal = useMemo(() => new THREE.Color(C.tealBright), []);
  const target = useMemo(() => new THREE.Color(), []);
  const black = useMemo(() => new THREE.Color(0), []);

  useFrame((_, dt) => {
    const m = mat.current;
    const r = ring.current;
    if (!m || !r || !group.current) return;
    const op = hovered ? 1 : NODE_OPACITY[role];
    m.opacity = THREE.MathUtils.damp(m.opacity, op, 14, dt);
    const isFocus = role === "focus";
    target.copy(isFocus ? orange : base);
    m.color.lerp(target, 1 - Math.exp(-14 * dt));
    m.emissive.lerp(isFocus ? orange : black, 1 - Math.exp(-10 * dt));
    m.emissiveIntensity = isFocus ? 0.55 : 0;
    m.depthWrite = m.opacity > 0.6;
    // Footprint ring on the plane: orange on the path, teal on hover.
    const ringOp = isFocus || role === "path" ? 0.9 : hovered ? 0.7 : role === "near" ? 0.35 : role === "dim" ? 0.06 : role === "context" ? 0.12 : 0.22;
    r.opacity = THREE.MathUtils.damp(r.opacity, ringOp, 14, dt);
    r.color.lerp(isFocus || role === "path" ? orange : teal, 1 - Math.exp(-14 * dt));
    const s = THREE.MathUtils.damp(group.current.scale.x, hovered || isFocus ? 1.18 : 1, 14, dt);
    group.current.scale.setScalar(s);
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onHover(node.id);
    document.body.style.cursor = "pointer";
  };
  const out = () => {
    onHover(null);
    document.body.style.cursor = "";
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 4) return;
    onFocus(node.id);
  };

  return (
    <group position={node.position}>
      <group ref={group}>
        <mesh geometry={SPHERE} scale={node.radius * 0.8}>
          <meshStandardMaterial ref={mat} color={base} roughness={0.92} metalness={0} transparent opacity={0.9} />
        </mesh>
      </group>
      <mesh geometry={RING} scale={node.radius * 0.8} rotation-x={-Math.PI / 2}>
        <meshBasicMaterial ref={ring} color={teal} transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      {/* A larger, invisible hit target, so small nodes are easy to click. */}
      <mesh scale={Math.max(node.radius * 2.2, 0.5)} onPointerOver={over} onPointerOut={out} onClick={click}>
        <sphereGeometry args={[1, 12, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------- Edges ---------- */

function EdgeLine({ edge, role, hovered }: { edge: StrataEdge; role: Visual["edge"] extends Map<string, infer R> ? R : never; hovered: boolean }) {
  const ref = useRef<Line2 | LineSegments2>(null);
  const geom = EDGE_GEOM.get(edge.id)!;
  const teal = useMemo(() => new THREE.Color(C.teal), []);
  const tealBright = useMemo(() => new THREE.Color(C.tealBright), []);
  const orange = useMemo(() => new THREE.Color(C.orange), []);
  useFrame((_, dt) => {
    const m = ref.current?.material as LineMaterial | undefined;
    if (!m) return;
    const path = role === "path";
    const op = path ? 1 : hovered ? 0.85 : EDGE_OPACITY[role];
    m.opacity = THREE.MathUtils.damp(m.opacity, op, 14, dt);
    m.color.lerp(path ? orange : hovered || role === "near" ? tealBright : teal, 1 - Math.exp(-14 * dt));
    m.linewidth = THREE.MathUtils.damp(m.linewidth, path ? 2 : hovered ? 1.6 : 1.1, 14, dt);
  });
  return <Line ref={ref} points={geom.points} color={C.teal} lineWidth={1.1} transparent opacity={0.3} depthWrite={false} />;
}

/** The slow pulse: one short bright dash that travels from the root to the focused node. */
function PathPulse({ pathEdges, reduced }: { pathEdges: Visual["pathEdges"]; reduced: boolean }) {
  const segs = useMemo(() => {
    const lengths = pathEdges.map((p) => EDGE_GEOM.get(p.id)!.length);
    return pathEdges.map((p, i) => {
      const edge = EDGES.find((e) => e.id === p.id)!;
      const g = EDGE_GEOM.get(p.id)!;
      const points = edge.source === p.from ? g.points : [...g.points].reverse();
      const start = lengths.slice(0, i).reduce((a, b) => a + b, 0);
      return { id: p.id, points, start, length: g.length };
    });
  }, [pathEdges]);
  const total = segs.reduce((a, s) => a + s.length, 0);
  const refs = useRef<(Line2 | LineSegments2 | null)[]>([]);
  const t0 = useRef<number | null>(null);
  const DASH = 1.1;
  const SPEED = 3.2;
  const REST = 1.6;
  useFrame(({ clock }) => {
    if (t0.current === null) t0.current = clock.elapsedTime;
    const cycle = total / SPEED + REST;
    const s = (((clock.elapsedTime - t0.current) % cycle) * SPEED);
    segs.forEach((seg, i) => {
      const m = refs.current[i]?.material as LineMaterial | undefined;
      if (!m) return;
      const u = s - seg.start;
      m.dashOffset = DASH - u;
      m.opacity = u < -DASH || u > seg.length + DASH ? 0 : 1;
    });
  });
  if (reduced || !segs.length) return null;
  return (
    <>
      {segs.map((seg, i) => (
        <Line
          key={seg.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          points={seg.points}
          color={HOT_ORANGE}
          lineWidth={3}
          dashed
          dashSize={DASH}
          gapSize={1000}
          transparent
          opacity={0}
          depthWrite={false}
          toneMapped={false}
        />
      ))}
    </>
  );
}

/* ---------- Camera ---------- */

function CameraRig({ focus, reduced, controls }: { focus: string | null; reduced: boolean; controls: React.RefObject<CameraControls | null> }) {
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    if (!focus) {
      void c.setLookAt(...DEFAULT_CAMERA, ...DEFAULT_TARGET, !reduced);
      return;
    }
    const n = NODE_BY_ID.get(focus)!;
    const pos = c.getPosition(new THREE.Vector3());
    const tgt = c.getTarget(new THREE.Vector3());
    const dir = pos.sub(tgt).normalize();
    // Keep the viewing angle but never look flat along a plane.
    if (dir.y < 0.22) dir.setY(0.22).normalize();
    // Aim between the node and its neighbors, so the card and its records share the frame.
    const t = new THREE.Vector3(...n.position);
    const near = edgesOf(focus).map((e) => NODE_BY_ID.get(otherEnd(e, focus))!);
    if (near.length) {
      const c = near.reduce((acc, m) => acc.add(new THREE.Vector3(...m.position)), new THREE.Vector3()).divideScalar(near.length);
      t.lerp(c, 0.4);
    }
    const p = t.clone().addScaledVector(dir, FOCUS_DISTANCE);
    void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, !reduced);
  }, [focus, reduced, controls]);
  return null;
}

/** Test hook for the screenshot script: the screen position of a node. */
function Probe() {
  const { camera, size } = useThree();
  useEffect(() => {
    (window as unknown as { __strata?: unknown }).__strata = {
      project(id: string) {
        const n = NODE_BY_ID.get(id);
        if (!n) return null;
        const v = new THREE.Vector3(...n.position).project(camera);
        return { x: ((v.x + 1) / 2) * size.width, y: ((1 - v.y) / 2) * size.height };
      },
    };
  }, [camera, size]);
  return null;
}

/**
 * Label declutter: every few frames, read the real screen boxes of the cards and
 * edge labels, keep them in priority order, and hide any that would overlap one already kept.
 */
function Declutter() {
  const { gl, events } = useThree();
  const tick = useRef(0);
  useFrame(() => {
    if (tick.current++ % 4 !== 0) return;
    // drei Html mounts labels in the events container (the canvas wrapper).
    const root = (events.connected as HTMLElement | undefined) ?? gl.domElement.parentElement;
    if (!root) return;
    const els = [...root.querySelectorAll<HTMLElement>("[data-declutter]")].sort(
      (a, b) => Number(a.dataset.declutter) - Number(b.dataset.declutter),
    );
    const kept: DOMRect[] = [];
    const pad = 4;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const hit = kept.some((k) => r.left < k.right + pad && r.right > k.left - pad && r.top < k.bottom + pad && r.bottom > k.top - pad);
      el.dataset.hidden = hit ? "true" : "false";
      if (!hit) kept.push(r);
    }
  });
  return null;
}

/* ---------- Scene ---------- */

export interface StrataSceneProps {
  visual: Visual;
  focus: string | null;
  hover: string | null;
  reduced: boolean;
  onFocus: (id: string | null) => void;
  onHover: (id: string | null) => void;
  controlsRef: React.RefObject<CameraControls | null>;
}

export default function StrataScene({ visual, focus, hover, reduced, onFocus, onHover, controlsRef }: StrataSceneProps) {
  const down = useRef<{ x: number; y: number } | null>(null);
  const activePlane = focus ? NODE_BY_ID.get(focus)!.plane : null;
  const hoverEdges = useMemo(() => new Set(hover ? EDGES.filter((e) => e.source === hover || e.target === hover).map((e) => e.id) : []), [hover]);
  const cardSet = useMemo(() => {
    const s = [...visual.cards];
    if (hover && !s.includes(hover)) s.push(hover);
    return s;
  }, [visual.cards, hover]);

  return (
    <Canvas
      flat
      dpr={[1, 2]}
      camera={{ fov: 30, position: DEFAULT_CAMERA, near: 0.5, far: 120 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onPointerMissed={(e) => {
        const d = down.current;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) onFocus(null);
      }}
    >
      <color attach="background" args={[C.bg]} />
      <fog attach="fog" args={[C.bg, 30, 64]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[-6, 14, 8]} intensity={1.35} />
      <directionalLight position={[8, -4, -6]} intensity={0.18} />

      {PLANES.map((p) => (
        <StratumPlane key={p.id} plane={p} active={p.id === activePlane} />
      ))}

      {EDGES.map((e) => (
        <EdgeLine key={e.id} edge={e} role={visual.edge.get(e.id)!} hovered={hoverEdges.has(e.id)} />
      ))}
      <PathPulse key={visual.path.join(">")} pathEdges={visual.pathEdges} reduced={reduced} />

      {NODES.map((n) => (
        <NodeMesh key={n.id} node={n} role={visual.node.get(n.id)!} hovered={hover === n.id} onFocus={onFocus} onHover={onHover} />
      ))}

      {cardSet.map((id, i) => {
        const n = NODE_BY_ID.get(id)!;
        return (
          <Html key={id} position={n.position} zIndexRange={[40, 10]} style={{ pointerEvents: "none" }}>
            <NodeCard
              node={n}
              variant={id === focus ? "focus" : visual.path.includes(id) ? "path" : "plain"}
              priority={id === hover ? 0 : id === focus ? 1 : visual.path.includes(id) ? 2 : 10 + i}
            />
          </Html>
        );
      })}

      {visual.edgeLabels.map(({ edgeId, from }) => {
        const ed = EDGES.find((e) => e.id === edgeId)!;
        const p = pointFrom(ed, from, 0.5);
        return (
          <Html key={edgeId} position={p} center zIndexRange={[9, 6]} style={{ pointerEvents: "none" }}>
            <EdgeChip label={ed.label} onPath={visual.edge.get(edgeId) === "path"} priority={visual.edge.get(edgeId) === "path" ? 3 : 5} />
          </Html>
        );
      })}

      <CameraControls
        ref={controlsRef}
        makeDefault
        smoothTime={0.42}
        draggingSmoothTime={0.12}
        minDistance={7}
        maxDistance={60}
        minPolarAngle={0.25}
        maxPolarAngle={1.42}
        dollySpeed={0.6}
      />
      <Probe />
      <Declutter />
      <CameraRig focus={focus} reduced={reduced} controls={controlsRef} />

      <EffectComposer multisampling={4}>
        <Bloom luminanceThreshold={1} luminanceSmoothing={0.1} intensity={0.9} mipmapBlur radius={0.55} />
      </EffectComposer>
    </Canvas>
  );
}
