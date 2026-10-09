import type { GraphNoteSpec } from "@/data/graph-notes";
import type { Catalog, Edge, Entity } from "@/lib/types";
import { computeFocus } from "../focus";
import type { OrbitContent, OrbitLayout, OrbitRing, RingKey } from "../orbit-layout";
import { resolveMarks, type OrbitMarks } from "./notes";

/**
 * What the orbit graph draws for a layout and a focus: each node's strength
 * and label, each edge's strength, and which rings are lit. Pure.
 */

/**
 * How strongly a node draws. "hint": a record of the center person's category
 * that the graph has not opened yet (a small dot at its date; hover names it).
 */
export type Tier = "center" | "full" | "second" | "dim" | "faint" | "ghost" | "anchor" | "hidden" | "hint";
/** The DOM label next to a node. */
export type LabelKind = "center" | "card" | "record" | "tag" | "ring" | "none";

export interface ViewNode {
  id: string;
  entity: Entity;
  tier: Tier;
  label: LabelKind;
  focused: boolean;
  onPath: boolean;
  x: number;
  y: number;
  z: number;
  /** Sphere radius (world units). */
  radius: number;
  parent?: string;
  day?: number;
  ring?: RingKey;
  /** The ring label text for an anchor ("Meetings · 5"). */
  ringText?: string;
  /** The category the record belongs to (a record of the center person). */
  category?: string;
  /** The note is about this record: it draws at full strength. */
  emphasis?: boolean;
}

export type EdgeTier = "path" | "focus" | "full" | "dim" | "faint" | "hidden";

export interface ViewEdge {
  id: string;
  a: string;
  b: string;
  tier: EdgeTier;
  label: string;
  /** The lowercase relationship phrase shows on this edge. */
  showLabel: boolean;
  day?: number;
}

export interface ViewRing extends OrbitRing {
  state: "active" | "normal" | "dim";
  /** Text of the ring label: "Cosponsors · 6". */
  text: string;
}

export interface OrbitView {
  centerId?: string;
  focusId?: string;
  nodes: ViewNode[];
  byId: Map<string, ViewNode>;
  /** The orange chain as drawn, each segment from the root side outward (pulses run along it). */
  pathSegs: [string, string][];
  edges: ViewEdge[];
  rings: ViewRing[];
  layout: OrbitLayout;
  /** The note of the answer on screen and what it marks (src/data/graph-notes.ts). */
  marks: OrbitMarks;
}

const RADIUS = { center: 0.34, major: 0.17, record: 0.13, second: 0.11, faint: 0.075, hint: 0.085 };
const MAJOR = new Set<Entity["type"]>(["person", "org", "bill", "topic"]);
/** At most this many edge labels show (the focus edges). */
const MAX_EDGE_LABELS = 8;

export function buildOrbitView(catalog: Catalog, rootId: string | undefined, g: OrbitContent, layout: OrbitLayout, notes: GraphNoteSpec[] = []): OrbitView {
  const realSet = new Set(g.entityIds);
  const realEdges = g.edgeIds
    .map((id) => catalog.edges[id])
    .filter((e): e is Edge => !!e && realSet.has(e.source) && realSet.has(e.target));
  const root = rootId && realSet.has(rootId) ? rootId : g.entityIds.find((id) => catalog.entities[id]?.type === "topic");
  const focusId = g.focusId && realSet.has(g.focusId) ? g.focusId : undefined;
  // The orange path runs from the root to the focus (DESIGN.md: one path).
  const focus = computeFocus(realEdges, root, focusId);
  const centerId = layout.centerId;
  const active = layout.activeRing;

  // The orange chain is the current focus chain, near the center only:
  // - a focused category: the spokes from its person to the records on its ring
  //   (Hartley to her meetings, Hartley to the contractors);
  // - else the path from the root to the focus, cut to the nodes on the rings
  //   and above them (Ukraine, S. 456, Hartley; Hartley to the private meeting).
  const near = (id: string) => {
    const r = layout.nodes.get(id)?.role;
    return r === "center" || r === "ring" || r === "lifted";
  };
  const pathEdges = new Set<string>();
  const segs: [string, string][] = [];
  if (active && centerId) {
    for (const e of layout.edges) {
      if (e.ghost || e.via !== layout.activeCategory) continue;
      const other = e.a === centerId ? e.b : e.b === centerId ? e.a : undefined;
      if (!other || layout.nodes.get(other)?.ring !== active) continue;
      pathEdges.add(e.id);
      segs.push([centerId, other]);
    }
  } else if (focusId) {
    // The last two steps of the path into the focus (data edges: Hartley, Meetings, the private meeting).
    const lastTwo = new Set<string>();
    const pe = realEdges.filter((e) => focus.pathEdges.has(e.id));
    for (let at = focusId, i = 0; i < 2; i++) {
      const e = pe.find((x) => !lastTwo.has(x.id) && (x.source === at || x.target === at));
      if (!e) break;
      lastTwo.add(e.id);
      at = e.source === at ? e.target : e.source;
    }
    // Root first: walk the drawn path edges from the end nearest the root.
    const drawn = layout.edges.filter((e) => !e.ghost && lastTwo.has(e.id) && near(e.a) && near(e.b));
    drawn.forEach((e) => pathEdges.add(e.id));
    const deg = new Map<string, number>();
    for (const e of drawn) for (const id of [e.a, e.b]) deg.set(id, (deg.get(id) ?? 0) + 1);
    let at = Array.from(deg.keys()).find((id) => deg.get(id) === 1 && id !== focusId && id !== centerId) ?? Array.from(deg.keys()).find((id) => id !== focusId);
    const used = new Set<string>();
    while (at) {
      const e = drawn.find((x) => !used.has(x.id) && (x.a === at || x.b === at));
      if (!e) break;
      used.add(e.id);
      const next: string = e.a === at ? e.b : e.a;
      segs.push([at, next]);
      at = next;
    }
  }
  const onPathSet = new Set<string>();
  for (const e of layout.edges) if (pathEdges.has(e.id)) onPathSet.add(e.a).add(e.b);

  // The category of each record on a ring of the center person (the spoke folds through it).
  const categoryOf = new Map<string, string>();
  for (const e of layout.edges) {
    if (!e.via || e.ghost) continue;
    const other = e.a === centerId ? e.b : e.b === centerId ? e.a : undefined;
    if (other && layout.nodes.get(other)?.role === "ring" && catalog.entities[e.via]?.categoryOf === centerId) categoryOf.set(other, e.via);
  }

  const nodes: ViewNode[] = [];
  const tierOf = new Map<string, Tier>();
  for (const n of layout.nodes.values()) {
    const entity = catalog.entities[n.id];
    if (!entity) continue;
    const onPath = onPathSet.has(n.id);
    const focused = n.id === focusId;
    let tier: Tier;
    if (n.role === "hidden") tier = "hidden";
    else if (n.role === "anchor") tier = "anchor";
    else if (n.role === "center") tier = "center";
    else if (n.ghost) tier = "ghost";
    else if (n.role === "band") tier = "faint";
    else if (n.role === "ring") tier = onPath || !active || n.ring === active ? "full" : "dim";
    else {
      // Lifted: the way back to the root draws as secondary; other context above a record
      // stays dim (unnamed dots at full strength would read as answers).
      tier = onPath ? "second" : "dim";
    }
    tierOf.set(n.id, tier);
    let label: LabelKind = "none";
    if (tier === "center") label = "center";
    else if (tier === "anchor") label = "ring";
    else if (tier === "full") label = MAJOR.has(entity.type) ? "card" : "record";
    // Lifted nodes are named only on the orange chain (hover names the others).
    else if (tier === "second" && onPath) label = "tag";
    const radius =
      tier === "center"
        ? RADIUS.center
        : tier === "faint" || tier === "ghost"
          ? RADIUS.faint
          : tier === "second" || (tier === "dim" && n.role === "lifted")
            ? RADIUS.second
            : MAJOR.has(entity.type)
              ? RADIUS.major
              : RADIUS.record;
    const ring = n.role === "anchor" ? layout.rings.find((r) => r.anchorId === n.id) : undefined;
    nodes.push({
      id: n.id,
      entity,
      tier,
      label,
      focused,
      onPath,
      x: n.x,
      y: n.y,
      z: n.z,
      radius,
      parent: n.parent,
      day: n.day,
      ring: n.ring,
      ringText: ring ? ringText(ring) : undefined,
      category: categoryOf.get(n.id),
    });
  }
  // The center person's records that the graph has not opened: a dot at their date on their ring.
  const anchorOf = new Map(layout.rings.filter((r) => r.anchorId).map((r) => [r.key, r.anchorId!]));
  const placed = new Set(nodes.map((n) => n.id));
  for (const h of layout.hints) {
    const entity = catalog.entities[h.id];
    if (!entity || placed.has(h.id)) continue;
    placed.add(h.id);
    tierOf.set(h.id, "hint");
    nodes.push({
      id: h.id,
      entity,
      tier: "hint",
      label: "record",
      focused: false,
      onPath: false,
      x: h.x,
      y: h.y,
      z: h.z,
      radius: RADIUS.hint,
      parent: centerId,
      day: h.day,
      ring: h.ring,
      category: anchorOf.get(h.ring),
    });
  }

  // Edges: the orange chain; the focus edges (spokes from the center); the rest.
  const focusEdges = new Set<string>();
  for (const e of layout.edges) {
    if (e.ghost || pathEdges.has(e.id)) continue;
    if (!active && (e.a === centerId || e.b === centerId)) focusEdges.add(e.id);
  }
  const edges: ViewEdge[] = layout.edges.map((e) => {
    const ta = tierOf.get(e.a);
    const tb = tierOf.get(e.b);
    let tier: EdgeTier;
    // Context in the outer band shows as dots only: no edges between band nodes.
    const bandA = ta === "ghost" || ta === "faint";
    const bandB = tb === "ghost" || tb === "faint";
    if (bandA && bandB) tier = "hidden";
    else if (e.ghost || bandA || bandB) tier = "faint";
    else if (pathEdges.has(e.id)) tier = "path";
    else if (focusEdges.has(e.id)) tier = "focus";
    else if (ta === "dim" || tb === "dim" || ta === "hidden" || tb === "hidden") tier = "dim";
    else tier = "full";
    return { id: e.id, a: e.a, b: e.b, tier, label: e.label, showLabel: false, day: e.day };
  });

  // Edge labels on the focus's own edges (the spokes from the center), unless
  // the ring label already says it (six "cosponsored by" spokes read as "Cosponsors · 6").
  const focusLabelled = edges.filter((e) => (e.tier === "path" || e.tier === "focus") && (e.a === centerId || e.b === centerId));
  const keyOf = (e: ViewEdge) => `${layout.nodes.get(e.a === centerId ? e.b : e.a)?.ring ?? "-"}|${e.label}`;
  const perRing = new Map<string, number>();
  for (const e of focusLabelled) perRing.set(keyOf(e), (perRing.get(keyOf(e)) ?? 0) + 1);
  let shown = 0;
  for (const e of focusLabelled) {
    if ((perRing.get(keyOf(e)) ?? 0) > 1 || shown >= MAX_EDGE_LABELS) continue;
    e.showLabel = true;
    shown++;
  }

  const rings: ViewRing[] = layout.rings.map((r) => ({
    ...r,
    state: !active ? "normal" : r.key === active ? "active" : "dim",
    text: ringText(r),
  }));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const marks = resolveMarks(catalog, { focusId: g.focusId, centerId, nodes, byId, anchoredRings: new Set(anchorOf.keys()) }, notes);
  for (const n of nodes) {
    if (marks.emphasis.has(n.id)) n.emphasis = true;
    // A record the note names shows its name (a lifted node is named only on the orange chain otherwise).
    if (marks.named.has(n.id) && n.label === "none") {
      n.label = "tag";
      if (n.tier === "dim") n.tier = "second";
    }
  }

  return { centerId, focusId, nodes, byId, pathSegs: segs, edges, rings, layout, marks };
}

function ringText(r: OrbitRing): string {
  return r.count > 0 ? `${r.label} · ${r.count}` : r.label;
}
