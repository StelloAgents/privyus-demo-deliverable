import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { EntityType, XY } from "@/lib/types";
import { LINK_DISTANCE, NODE_SIZE, nodeBox } from "./geometry";

export interface LayoutNode {
  id: string;
  type: EntityType;
  /** The node this one grows out of. Undefined for the root. */
  parent?: string;
  /** Label text, for the collision box. */
  label?: string;
  sublabel?: string;
}

export interface LayoutInput {
  nodes: LayoutNode[];
  links: { source: string; target: string }[];
  /** Positions of nodes already on the canvas. */
  current: Record<string, XY>;
  /** Nodes the user dragged: they keep their place. */
  pinned?: Set<string>;
  rootId?: string;
  /** Starting alpha of the simulation. Default 0.6. */
  alpha?: number;
  /** Focus-path edges: no node may sit on them. */
  pathEdges?: { source: string; target: string }[];
  /** Edges whose label shows (the focus path). Their labels act as collision bodies. */
  labelEdges?: { source: string; target: string; label: string }[];
}

interface SimNode extends SimulationNodeDatum {
  id: string;
  type: EntityType;
  anchor?: XY;
  /** Collision radius: covers the node and its label box, plus 10px padding. */
  r: number;
  /** Node + label box size and the box center offset below the node center. */
  bw: number;
  bh: number;
  bdy: number;
  parent?: string;
}

/** Estimated size of an edge label chip (12px text, 8px side padding). */
export function edgeLabelSize(label: string): { w: number; h: number } {
  return { w: label.length * 6.6 + 18, h: 22 };
}

/**
 * Keeps node circles off focus-path edges. The edge is drawn as a slight
 * quadratic curve (control point offset by 7% of the length, see PrivyEdge),
 * so the force samples that curve and pushes a node away from its nearest point.
 */
function forcePathLines(edges: { source: string; target: string }[], gap = 20) {
  let nodes: SimNode[] = [];
  let byId = new Map<string, SimNode>();
  const force = (alpha: number) => {
    const k = Math.min(1, 0.5 + alpha * 4);
    for (const e of edges) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      const ax = a.x ?? 0;
      const ay = a.y ?? 0;
      const bx = b.x ?? 0;
      const by = b.y ?? 0;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const ux = (bx - ax) / len;
      const uy = (by - ay) / len;
      const cx = (ax + bx) / 2 - uy * len * 0.07;
      const cy = (ay + by) / 2 + ux * len * 0.07;
      for (const n of nodes) {
        if (n === a || n === b) continue;
        const nx = n.x ?? 0;
        const ny = n.y ?? 0;
        let best = Infinity;
        let px = 0;
        let py = 0;
        for (let t = 0.04; t <= 0.96; t += 0.04) {
          const m = 1 - t;
          const qx = m * m * ax + 2 * m * t * cx + t * t * bx;
          const qy = m * m * ay + 2 * m * t * cy + t * t * by;
          const d = (qx - nx) ** 2 + (qy - ny) ** 2;
          if (d < best) {
            best = d;
            px = qx;
            py = qy;
          }
        }
        const d = Math.sqrt(best);
        const min = NODE_SIZE[n.type] / 2 + gap;
        if (d >= min) continue;
        // Push away from the curve (perpendicular to the chord when exactly on it).
        const dx = d > 0.01 ? (nx - px) / d : -uy;
        const dy = d > 0.01 ? (ny - py) / d : ux;
        n.vx = (n.vx ?? 0) + dx * (min - d) * k;
        n.vy = (n.vy ?? 0) + dy * (min - d) * k;
      }
    }
  };
  force.initialize = (ns: SimNode[]) => {
    nodes = ns;
    byId = new Map(ns.map((n) => [n.id, n]));
  };
  return force;
}

/**
 * Keeps nodes (and their label boxes) off the labels of the given edges.
 * The label sits at the edge midpoint; a node box that overlaps it is pushed
 * out along the axis of least overlap.
 */
function forceEdgeLabels(edges: { source: string; target: string; w: number; h: number }[], pad = 10) {
  let nodes: SimNode[] = [];
  let byId = new Map<string, SimNode>();
  const force = (alpha: number) => {
    for (const e of edges) {
      const a = byId.get(e.source);
      const b = byId.get(e.target);
      if (!a || !b) continue;
      const mx = ((a.x ?? 0) + (b.x ?? 0)) / 2;
      const my = ((a.y ?? 0) + (b.y ?? 0)) / 2;
      for (const n of nodes) {
        if (n === a || n === b) continue;
        const cx = n.x ?? 0;
        const cy = (n.y ?? 0) + n.bdy;
        const hw = e.w / 2 + n.bw / 2 + pad;
        const hh = e.h / 2 + n.bh / 2 + pad;
        const dx = cx - mx;
        const dy = cy - my;
        const ox = hw - Math.abs(dx);
        const oy = hh - Math.abs(dy);
        if (ox <= 0 || oy <= 0) continue;
        const k = Math.min(1, 0.5 + alpha * 4);
        if (ox < oy) n.vx = (n.vx ?? 0) + Math.sign(dx || 1) * ox * k;
        else n.vy = (n.vy ?? 0) + Math.sign(dy || 1) * oy * k;
      }
    }
  };
  force.initialize = (ns: SimNode[]) => {
    nodes = ns;
    byId = new Map(ns.map((n) => [n.id, n]));
  };
  return force;
}

/** Deterministic random source, so the same data gives the same layout. */
function lcg(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const TAU = Math.PI * 2;

/**
 * Places new nodes on an arc around their parent, facing away from the
 * grandparent, then runs a force simulation to settle everything.
 * Existing nodes are anchored to their current places, so they only move
 * aside a little. Returns the target position of every node.
 */
export function computeLayout({ nodes, links, current, pinned, rootId, labelEdges, pathEdges, alpha = 0.6 }: LayoutInput): Record<string, XY> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const placed: Record<string, XY> = {};
  for (const n of nodes) if (current[n.id]) placed[n.id] = current[n.id];

  const root = rootId && byId.has(rootId) ? rootId : nodes[0]?.id;
  if (root && !placed[root]) placed[root] = { x: 0, y: 0 };

  // Group new nodes by parent, in input order.
  const groups = new Map<string, LayoutNode[]>();
  for (const n of nodes) {
    if (placed[n.id]) continue;
    const key = n.parent ?? root ?? "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(n);
  }

  // Seed positions: breadth-first so a parent is placed before its children.
  let guard = 0;
  while (groups.size && guard++ < 50) {
    for (const [parentId, kids] of Array.from(groups.entries())) {
      const p = placed[parentId];
      if (!p) continue;
      groups.delete(parentId);
      const parentNode = byId.get(parentId);
      const gp = parentNode?.parent ? placed[parentNode.parent] : undefined;

      // Existing children of this parent take angle slots too.
      const isRoot = parentId === root;
      const away = gp ? Math.atan2(p.y - gp.y, p.x - gp.x) : -Math.PI / 2;
      const k = kids.length;
      const ring = k > 9 && !isRoot ? 2 : 1;
      const span = isRoot ? TAU : Math.min(TAU * 0.75, Math.max(Math.PI / 3, (k / ring) * 0.5));
      kids.forEach((kid, i) => {
        const dist = LINK_DISTANCE[kid.type] * (ring === 2 && i % 2 ? 1.45 : 1);
        const t = isRoot ? i / k : k === 1 ? 0.5 : i / (k - 1);
        const angle = isRoot ? away + (k === 2 ? Math.PI / 2 + Math.PI * i : t * TAU) : away - span / 2 + t * span;
        placed[kid.id] = { x: p.x + Math.cos(angle) * dist, y: p.y + Math.sin(angle) * dist };
      });
    }
  }
  // Anything still not placed (no parent path): near the root.
  nodes.forEach((n, i) => {
    if (!placed[n.id]) placed[n.id] = { x: Math.cos(i) * 300, y: Math.sin(i) * 300 };
  });

  const simNodes: SimNode[] = nodes.map((n) => {
    const p = placed[n.id];
    const box = nodeBox(n.type, n.label ?? "", n.sublabel);
    // A circle around the node + label box. The label hangs below, so the
    // radius uses the half-diagonal of the box, reduced a little (boxes are not circles).
    const r = Math.max(NODE_SIZE[n.type] / 2 + 14, 0.82 * Math.hypot(box.w / 2, box.h / 2) + 10);
    const sn: SimNode = { id: n.id, type: n.type, x: p.x, y: p.y, r, bw: box.w, bh: box.h, bdy: box.dy, parent: n.parent };
    if (n.id === root || pinned?.has(n.id)) {
      sn.fx = p.x;
      sn.fy = p.y;
    }
    if (current[n.id]) sn.anchor = current[n.id];
    return sn;
  });

  const simLinks: SimulationLinkDatum<SimNode>[] = links
    .filter((l) => byId.has(l.source) && byId.has(l.target))
    .map((l) => ({ source: l.source, target: l.target }));

  const anchorStrength = (n: SimNode) => (n.anchor ? 0.35 : 0.02);
  const sim = forceSimulation<SimNode>(simNodes)
    .randomSource(lcg(7))
    .force(
      "link",
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks)
        .id((d) => d.id)
        .distance((l) => {
          const s = l.source as SimNode;
          const t = l.target as SimNode;
          // The child is the node whose parent is the other end; else the smaller type.
          const child =
            t.parent === s.id ? t : s.parent === t.id ? s : NODE_SIZE[s.type] < NODE_SIZE[t.type] ? s : t;
          return LINK_DISTANCE[child.type];
        })
        .strength(0.6),
    )
    .force("charge", forceManyBody<SimNode>().strength(-520).distanceMax(560))
    .force("pathLines", forcePathLines((pathEdges ?? []).filter((l) => byId.has(l.source) && byId.has(l.target))))
    .force(
      "edgeLabels",
      forceEdgeLabels(
        (labelEdges ?? [])
          .filter((l) => byId.has(l.source) && byId.has(l.target))
          .map((l) => ({ source: l.source, target: l.target, ...edgeLabelSize(l.label) })),
      ),
    )
    .force(
      "collide",
      forceCollide<SimNode>()
        .radius((d) => d.r)
        .strength(1)
        .iterations(3),
    )
    .force("x", forceX<SimNode>((d) => d.anchor?.x ?? d.x ?? 0).strength(anchorStrength))
    .force("y", forceY<SimNode>((d) => d.anchor?.y ?? d.y ?? 0).strength(anchorStrength))
    .alpha(alpha)
    .alphaDecay(0.03)
    .stop();

  for (let i = 0; i < 220; i++) sim.tick();

  const out: Record<string, XY> = {};
  for (const n of simNodes) out[n.id] = { x: Math.round(n.x ?? 0), y: Math.round(n.y ?? 0) };
  return out;
}
