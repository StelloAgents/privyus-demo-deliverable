import type { Catalog, Edge, Entity, XY } from "@/lib/types";

/**
 * The orbit layout (Orbit + Chronos). A pure function of the graph content and
 * the focus: the same content always gives the same positions, so a turn that
 * streams step by step ends exactly where a replayed state starts.
 *
 * - The focused entity sits at the center (0, 0, 0). A focused category node
 *   (Votes, Meetings, ...) centers its person and makes its ring the active one.
 * - One concentric ring per relationship type (Legislation, Sponsor,
 *   Cosponsors, Meetings, Contributions, ...). A person's category nodes are
 *   the anchors and labels of their rings.
 * - A record's angle on its ring is its date, clockwise from the start of the
 *   clock window (the months that the records on screen span). Records of the
 *   same month line up across rings. Undated records take a stable seeded angle.
 * - Second-hop nodes float above their parent record; everything further away,
 *   and the faint ghost context, sits in an outer band.
 *
 * Coordinates: x right, y up, z toward the viewer (the far side of a ring is -z).
 */

export type RingKey =
  | "legislation"
  | "sponsor"
  | "cosponsors"
  | "attendees"
  | "orgs"
  | "meetings"
  | "contributions"
  | "votes"
  | "trips"
  | "opinions"
  | "others"
  | "topics"
  | "ties";

/** Inner to outer. */
export const RING_ORDER: RingKey[] = [
  "legislation",
  "sponsor",
  "cosponsors",
  "attendees",
  "orgs",
  "meetings",
  "contributions",
  "votes",
  "trips",
  "opinions",
  "others",
  "topics",
  "ties",
];

const RING_LABEL: Record<RingKey, string> = {
  legislation: "Legislation",
  sponsor: "Sponsor",
  cosponsors: "Cosponsors",
  attendees: "Attendees",
  orgs: "Organizations",
  meetings: "Meetings",
  contributions: "Contributions",
  votes: "Bills",
  trips: "Trips",
  opinions: "Opinions",
  others: "Others",
  topics: "Topics",
  ties: "Ties",
};

export type OrbitRole = "center" | "ring" | "lifted" | "band" | "anchor" | "hidden";

export interface OrbitNode {
  id: string;
  x: number;
  y: number;
  z: number;
  role: OrbitRole;
  /** Hops from the center over the drawn edges (0 center, 1 ring, 2 lifted, 3 band or further). */
  hop: number;
  ghost: boolean;
  ring?: RingKey;
  /** The day (days since 1970-01-01) of the edge that places it, when it has one. */
  day?: number;
  /** The node it grows out of (the BFS parent toward the center). */
  parent?: string;
}

export interface OrbitRing {
  key: RingKey;
  label: string;
  radius: number;
  /** The category node that labels this ring (when the center is its person). */
  anchorId?: string;
  /** Records on the ring: the category's records in the catalog, or the nodes on it. */
  count: number;
}

/** A drawn edge. A person's category edges fold into it: Hartley to a meeting, with the meeting edge's id and label. */
export interface OrbitEdge {
  id: string;
  a: string;
  b: string;
  label: string;
  /** The ring this edge runs along from the center (a spoke). */
  ring?: RingKey;
  day?: number;
  ghost: boolean;
  /** The category the edge folds through. */
  via?: string;
}

/** An unloaded record of a category ring: a faint dot where the record will appear. */
export interface OrbitHint {
  id: string;
  x: number;
  y: number;
  z: number;
  ring: RingKey;
  day?: number;
}

export interface OrbitLayout {
  centerId?: string;
  /** The focused category's ring (its records are at full strength, the other rings dim). */
  activeRing?: RingKey;
  activeCategory?: string;
  nodes: Map<string, OrbitNode>;
  rings: OrbitRing[];
  edges: OrbitEdge[];
  hints: OrbitHint[];
  /** The clock window, in days: [start, end). */
  window: [number, number];
  /** The outermost ring, and the radius of the faint outer band. */
  outerRadius: number;
  bandRadius: number;
}

export interface OrbitConfig {
  catalog: Catalog;
  rootId?: string;
  /** Category id per record (detail) id. */
  recordCategory: Map<string, string>;
  /** Catalog records per category id: every edge from the category to a node that is not its person. */
  categoryRecords: Map<string, { id: string; edge: Edge }[]>;
}

/** The graph content that decides the layout. */
export interface OrbitContent {
  entityIds: string[];
  edgeIds: string[];
  ghostEntityIds?: string[];
  ghostEdgeIds?: string[];
  focusId?: string;
}

/* ------------------------------------------------------------------ */
/* Clock                                                               */
/* ------------------------------------------------------------------ */

const DAY_MS = 86_400_000;
export const toDay = (iso: string): number => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / DAY_MS);
const monthIndex = (day: number) => {
  const d = new Date(day * DAY_MS);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
};
export const monthStart = (m: number): number => Math.round(Date.UTC(Math.floor(m / 12), m % 12, 1) / DAY_MS);
/** The month index (year * 12 + month) of a day. */
export const monthOfDay = monthIndex;

/** The gap at 12 o'clock (the far side) holds the ring labels; time runs clockwise over the rest. */
export const CLOCK_GAP = (36 * Math.PI) / 180;
export const CLOCK_START = -Math.PI / 2 + CLOCK_GAP / 2;
export const CLOCK_SWEEP = Math.PI * 2 - CLOCK_GAP;
/** The smallest clock window, in months. */
const MIN_WINDOW_MONTHS = 6;

export function angleOfDay(day: number, window: [number, number]): number {
  const t = (day - window[0]) / Math.max(1, window[1] - window[0]);
  return CLOCK_START + Math.min(1, Math.max(0, t)) * CLOCK_SWEEP;
}

/** A stable angle for an undated item, from its id. */
function seededAngle(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return CLOCK_START + ((h >>> 0) / 4294967296) * CLOCK_SWEEP;
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

/** Height of second-hop nodes above their parent record. */
export const LIFT = 1.25;
const BAND_GAP = 1.5;

/** The inner ring leaves room for the center's label; more rings sit closer together. */
function ringRadii(n: number): number[] {
  if (n === 0) return [];
  if (n === 1) return [3.8];
  const r0 = 3.5;
  const gap = Math.min(1.35, 5.0 / (n - 1));
  return Array.from({ length: n }, (_, i) => r0 + i * gap);
}

/**
 * Spreads angles inside [lo, hi] so neighbors keep at least `gap` apart. Keeps
 * the order (date order). Deterministic.
 */
function spreadBounded(items: { id: string; a: number }[], gap: number, lo: number, hi: number): void {
  items.sort((p, q) => p.a - q.a || p.id.localeCompare(q.id));
  const n = items.length;
  if (n === 0) return;
  const g = n > 1 ? Math.min(gap, (hi - lo) / (n - 1)) : gap;
  // Pull apart symmetrically first (a small cluster stays centered on its dates).
  for (let pass = 0; pass < 60; pass++) {
    let moved = false;
    for (let i = 1; i < n; i++) {
      const d = items[i].a - items[i - 1].a;
      if (d < g - 1e-9) {
        const push = (g - d) / 2;
        items[i - 1].a -= push;
        items[i].a += push;
        moved = true;
      }
    }
    if (!moved) break;
  }
  // Then keep the whole set inside the sweep.
  if (items[0].a < lo) items[0].a = lo;
  for (let i = 1; i < n; i++) items[i].a = Math.max(items[i].a, items[i - 1].a + g);
  if (items[n - 1].a > hi) items[n - 1].a = hi;
  for (let i = n - 2; i >= 0; i--) items[i].a = Math.min(items[i].a, items[i + 1].a - g);
}

/* ------------------------------------------------------------------ */
/* Config                                                              */
/* ------------------------------------------------------------------ */

export function makeOrbitConfig(catalog: Catalog, rootId?: string): OrbitConfig {
  const recordCategory = new Map<string, string>();
  const categoryRecords = new Map<string, { id: string; edge: Edge }[]>();
  for (const e of Object.values(catalog.edges)) {
    for (const [c, r] of [
      [e.source, e.target],
      [e.target, e.source],
    ]) {
      const cat = catalog.entities[c];
      const rec = catalog.entities[r];
      if (!cat || !rec || cat.type !== "category" || cat.categoryOf === r) continue;
      if (!categoryRecords.has(c)) categoryRecords.set(c, []);
      categoryRecords.get(c)!.push({ id: r, edge: e });
      if (rec.type === "detail") recordCategory.set(r, c);
    }
  }
  return { catalog, rootId, recordCategory, categoryRecords };
}

/** The ring key of a category node. */
export function categoryRing(cat: Entity): RingKey {
  const key = cat.label.toLowerCase() as RingKey;
  return RING_ORDER.includes(key) ? key : "others";
}

function ringOf(cfg: OrbitConfig, e: OrbitEdge, center: Entity, other: Entity): RingKey {
  const { catalog } = cfg;
  if (e.via) return categoryRing(catalog.entities[e.via]);
  if (other.type === "topic") return "topics";
  if (other.type === "bill") return center.type === "topic" ? "legislation" : "votes";
  if (center.type === "bill" && other.type === "person") return /^sponsor/.test(e.label) ? "sponsor" : "cosponsors";
  if (other.type === "detail") {
    const cat = cfg.recordCategory.get(other.id);
    return cat ? categoryRing(catalog.entities[cat]) : "ties";
  }
  if (other.type === "category") return categoryRing(other);
  if (/attended/.test(e.label)) return "attendees";
  if (other.type === "org") return "orgs";
  return "ties";
}

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

let cache = new WeakMap<OrbitConfig, Map<string, OrbitLayout>>();

/** Forgets every cached orbit layout (the determinism check compares uncached runs). */
export function clearOrbitLayoutCache(): void {
  cache = new WeakMap();
}

/** The orbit layout of `g`. Memoized: the store and the renderer share one result per graph. */
export function orbitLayout(cfg: OrbitConfig, g: OrbitContent): OrbitLayout {
  const key = JSON.stringify([g.entityIds, g.edgeIds, g.ghostEntityIds ?? [], g.ghostEdgeIds ?? [], g.focusId ?? null]);
  let m = cache.get(cfg);
  if (!m) cache.set(cfg, (m = new Map()));
  const hit = m.get(key);
  if (hit) return hit;
  const out = computeOrbit(cfg, g);
  if (m.size > 300) m.delete(m.keys().next().value!);
  m.set(key, out);
  return out;
}

/** Store positions (x, z as x, y) for every entity on the graph, ghosts included. */
export function orbitPositions(cfg: OrbitConfig, g: OrbitContent): Record<string, XY> {
  const L = orbitLayout(cfg, g);
  const out: Record<string, XY> = {};
  for (const [id, n] of L.nodes) out[id] = { x: round(n.x), y: round(n.z) };
  return out;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

function computeOrbit(cfg: OrbitConfig, g: OrbitContent): OrbitLayout {
  const { catalog } = cfg;
  const E = (id: string) => catalog.entities[id];
  const realSet = new Set(g.entityIds.filter((id) => E(id)));
  const ghostSet = new Set((g.ghostEntityIds ?? []).filter((id) => !realSet.has(id) && E(id)));
  const realEdgeIds = new Set(g.edgeIds);
  const realEdges = g.edgeIds
    .map((id) => catalog.edges[id])
    .filter((e): e is Edge => !!e && realSet.has(e.source) && realSet.has(e.target));
  const ghostEdges = (g.ghostEdgeIds ?? [])
    .filter((id) => !realEdgeIds.has(id))
    .map((id) => catalog.edges[id])
    .filter((e): e is Edge => !!e && (realSet.has(e.source) || ghostSet.has(e.source)) && (realSet.has(e.target) || ghostSet.has(e.target)));

  // Category nodes fold into rings when their person is on the graph.
  const folded = new Map<string, string>(); // category id -> person id
  for (const id of realSet) {
    const c = E(id);
    if (c.type === "category" && c.categoryOf && realSet.has(c.categoryOf)) folded.set(id, c.categoryOf);
  }

  // Drawn edges.
  const edges: OrbitEdge[] = [];
  for (const e of realEdges) {
    const cs = folded.get(e.source);
    const ct = folded.get(e.target);
    const day = e.date ? toDay(e.date) : undefined;
    if (cs || ct) {
      const cat = cs ? e.source : e.target;
      const person = folded.get(cat)!;
      const other = cs ? e.target : e.source;
      if (other === person || folded.has(other)) continue;
      edges.push({ id: e.id, a: person, b: other, label: e.label, day, ghost: false, via: cat });
    } else edges.push({ id: e.id, a: e.source, b: e.target, label: e.label, day, ghost: false });
  }
  for (const e of ghostEdges) {
    edges.push({ id: e.id, a: e.source, b: e.target, label: e.label, day: e.date ? toDay(e.date) : undefined, ghost: true });
  }
  edges.sort((p, q) => p.id.localeCompare(q.id));

  // Center.
  const root = cfg.rootId && realSet.has(cfg.rootId) ? cfg.rootId : g.entityIds.find((id) => E(id)?.type === "topic") ?? g.entityIds.find((id) => E(id));
  let centerId: string | undefined;
  let activeCategory: string | undefined;
  const focus = g.focusId && realSet.has(g.focusId) ? g.focusId : undefined;
  if (focus && folded.has(focus)) {
    activeCategory = focus;
    centerId = folded.get(focus);
  } else centerId = focus ?? root;
  if (centerId && folded.has(centerId)) centerId = folded.get(centerId);

  const nodes = new Map<string, OrbitNode>();
  const empty: OrbitLayout = {
    centerId,
    nodes,
    rings: [],
    edges,
    hints: [],
    window: [monthStart(2025 * 12), monthStart(2025 * 12 + 12)],
    outerRadius: 3.4,
    bandRadius: 5,
  };
  if (!centerId) return empty;
  const center = E(centerId);

  // Breadth-first hops over the real drawn edges (sorted, so the result does not depend on order).
  const adj = new Map<string, OrbitEdge[]>();
  for (const e of edges) {
    if (e.ghost) continue;
    for (const id of [e.a, e.b]) {
      if (!adj.has(id)) adj.set(id, []);
      adj.get(id)!.push(e);
    }
  }
  const hop = new Map<string, number>([[centerId, 0]]);
  const via = new Map<string, OrbitEdge>();
  let frontier = [centerId];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const e of adj.get(id) ?? []) {
        const o = e.a === id ? e.b : e.a;
        if (hop.has(o)) continue;
        hop.set(o, hop.get(id)! + 1);
        via.set(o, e);
        next.push(o);
      }
    }
    frontier = next.sort();
  }
  // A first-hop node reached by several edges takes the innermost ring.
  const ringFor = new Map<string, RingKey>();
  for (const [id, h] of hop) {
    if (h !== 1) continue;
    let best: { ring: RingKey; e: OrbitEdge } | undefined;
    for (const e of adj.get(centerId) ?? []) {
      if (e.a !== id && e.b !== id) continue;
      const ring = ringOf(cfg, e, center, E(id));
      if (!best || RING_ORDER.indexOf(ring) < RING_ORDER.indexOf(best.ring)) best = { ring, e };
    }
    if (best) {
      ringFor.set(id, best.ring);
      via.set(id, best.e);
    }
  }

  // Rings: the first-hop relationships, plus the center person's categories.
  const anchors = new Map<RingKey, string>();
  // A category with no records draws no ring (an empty ring answers nothing).
  for (const [cat, person] of folded) if (person === centerId && (cfg.categoryRecords.get(cat)?.length ?? 0) > 0) anchors.set(categoryRing(E(cat)), cat);
  const keys = RING_ORDER.filter((k) => anchors.has(k) || Array.from(ringFor.values()).includes(k));
  const radii = ringRadii(keys.length);
  const radiusOf = new Map(keys.map((k, i) => [k, radii[i]]));
  const outerRadius = radii.length ? radii[radii.length - 1] : 3.4;
  const bandRadius = Math.max(outerRadius + BAND_GAP, 5.4);

  // Unloaded records of the anchored rings.
  const hintItems: { id: string; ring: RingKey; day?: number }[] = [];
  for (const [ring, cat] of anchors) {
    for (const r of cfg.categoryRecords.get(cat) ?? []) {
      if (hop.get(r.id) === 1 && ringFor.get(r.id) === ring) continue;
      if (realSet.has(r.id) && hop.has(r.id)) continue;
      hintItems.push({ id: r.id, ring, day: r.edge.date ? toDay(r.edge.date) : undefined });
    }
  }

  // Days of every placed item, for the clock window.
  const dayOf = (id: string) => via.get(id)?.day;
  const ghostDay = new Map<string, number>();
  for (const e of edges) {
    if (!e.ghost || e.day === undefined) continue;
    for (const id of [e.a, e.b]) if (ghostSet.has(id) && !ghostDay.has(id)) ghostDay.set(id, e.day);
  }
  // The clock spans the records on the rings (and the context around them), so they spread around it.
  const days: number[] = [];
  for (const [id, h] of hop) if (h === 1 && dayOf(id) !== undefined) days.push(dayOf(id)!);
  for (const h of hintItems) if (h.day !== undefined) days.push(h.day);
  for (const e of edges) {
    if (!e.ghost || e.day === undefined) continue;
    const parent = ghostSet.has(e.a) ? e.b : e.a;
    if ((hop.get(parent) ?? 9) <= 1) days.push(e.day);
  }
  let window: [number, number];
  if (days.length) {
    let m0 = monthIndex(Math.min(...days));
    let m1 = monthIndex(Math.max(...days)) + 1;
    const pad = MIN_WINDOW_MONTHS - (m1 - m0);
    if (pad > 0) {
      m0 -= Math.floor(pad / 2);
      m1 += Math.ceil(pad / 2);
    }
    window = [monthStart(m0), monthStart(m1)];
  } else window = empty.window;
  const inWindow = (day?: number): day is number => day !== undefined && day >= window[0] && day < window[1];
  const angle = (id: string, day?: number) => (inWindow(day) ? angleOfDay(day, window) : day === undefined ? seededAngle(id) : angleOfDay(day, window));
  /** Context outside the clock window takes a seeded angle (clamping would pile it at the ends). */
  const bandAngle = (id: string, day?: number) => (inWindow(day) ? angleOfDay(day, window) : seededAngle(id));

  nodes.set(centerId, { id: centerId, x: 0, y: 0, z: 0, role: "center", hop: 0, ghost: false });

  // First hop: on its ring, at the angle of its date (hints share the spread, so a record lands on its dot).
  const hints: OrbitHint[] = [];
  const lo = CLOCK_START;
  const hi = CLOCK_START + CLOCK_SWEEP;
  for (const ring of keys) {
    const r = radiusOf.get(ring)!;
    const items: { id: string; a: number; hint?: boolean; day?: number }[] = [];
    for (const [id, k] of ringFor) if (k === ring) items.push({ id, a: angle(id, dayOf(id)), day: dayOf(id) });
    for (const h of hintItems) if (h.ring === ring) items.push({ id: h.id, a: angle(h.id, h.day), hint: true, day: h.day });
    // A few records of one date still spread out, in date order.
    spreadBounded(items, Math.max(1.15 / r, items.length <= 6 ? Math.min(0.9, 2.6 / items.length) : 0), lo, hi);
    for (const it of items) {
      const x = r * Math.cos(it.a);
      const z = r * Math.sin(it.a);
      if (it.hint) hints.push({ id: it.id, x, y: 0, z, ring, day: it.day });
      else nodes.set(it.id, { id: it.id, x, y: 0, z, role: "ring", hop: 1, ghost: false, ring, day: it.day, parent: centerId });
    }
  }

  // A spoke to an outer ring never runs through a node on an inner ring: the
  // outer node turns aside just enough (records of one month still line up closely).
  const placed = Array.from(nodes.values()).filter((n) => n.role === "ring");
  for (const n of placed.sort((p, q) => Math.hypot(p.x, p.z) - Math.hypot(q.x, q.z) || p.id.localeCompare(q.id))) {
    const r = Math.hypot(n.x, n.z);
    let a = Math.atan2(n.z, n.x);
    for (const m of placed) {
      const rm = Math.hypot(m.x, m.z);
      if (rm >= r - 0.01) continue;
      const am = Math.atan2(m.z, m.x);
      const need = 0.7 / rm;
      let d = a - am;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      if (Math.abs(d) < need) a = am + (d >= 0 ? need : -need);
    }
    n.x = r * Math.cos(a);
    n.z = r * Math.sin(a);
  }

  // Ring anchors (the category nodes): at the top of their ring, in the label gap.
  for (const [ring, cat] of anchors) {
    const r = radiusOf.get(ring)!;
    nodes.set(cat, { id: cat, x: 0, y: 0, z: -r, role: "anchor", hop: 1, ghost: false, ring, parent: centerId });
  }

  // Second hop: lifted above the parent record, fanned along its ring.
  const kids = new Map<string, string[]>();
  for (const [id, h] of hop) {
    if (h !== 2) continue;
    const e = via.get(id)!;
    const p = e.a === id ? e.b : e.a;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p)!.push(id);
  }
  // The way back to the root always floats (it carries the orange path); a crowd of other children goes to the band.
  const rootChain = new Set<string>();
  for (let at = root; at && at !== centerId && hop.has(at); ) {
    rootChain.add(at);
    const e = via.get(at);
    at = e ? (e.a === at ? e.b : e.a) : undefined;
  }
  const toBand: string[] = [];
  for (const p of Array.from(kids.keys()).sort()) {
    let list = kids.get(p)!.sort();
    const pp = nodes.get(p);
    if (!pp) {
      toBand.push(...list);
      continue;
    }
    if (list.length > 6) {
      toBand.push(...list.filter((id) => !rootChain.has(id)));
      list = list.filter((id) => rootChain.has(id));
      if (!list.length) continue;
    }
    const r = Math.hypot(pp.x, pp.z) + 0.3;
    const a0 = Math.atan2(pp.z, pp.x);
    const step = 1.0 / r;
    list.forEach((id, i) => {
      const a = a0 + (i - (list.length - 1) / 2) * step;
      nodes.set(id, {
        id,
        x: r * Math.cos(a),
        y: LIFT + (list.length > 2 ? (i % 2) * 0.32 : 0),
        z: r * Math.sin(a),
        role: "lifted",
        hop: 2,
        ghost: false,
        day: dayOf(id),
        parent: p,
      });
    });
  }

  // The outer band: real nodes further away, then the ghost context.
  const band: { id: string; a: number; ghost: boolean; day?: number; parent?: string }[] = [];
  for (const [id, h] of hop) {
    if (h >= 3 || toBand.includes(id)) {
      const e = via.get(id);
      band.push({ id, a: bandAngle(id, dayOf(id)), ghost: false, day: dayOf(id), parent: e ? (e.a === id ? e.b : e.a) : undefined });
    }
  }
  for (const id of realSet) {
    if (hop.has(id) || folded.has(id)) continue;
    band.push({ id, a: bandAngle(id, undefined), ghost: false });
  }
  for (const id of ghostSet) {
    const parent = edges.find((e) => e.ghost && (e.a === id || e.b === id));
    band.push({
      id,
      a: bandAngle(id, ghostDay.get(id)),
      ghost: true,
      day: ghostDay.get(id),
      parent: parent ? (parent.a === id ? parent.b : parent.a) : undefined,
    });
  }
  spreadBounded(band, 0.6 / bandRadius, lo, hi);
  band.forEach((it, i) => {
    const r = bandRadius + (i % 3) * 0.4;
    nodes.set(it.id, {
      id: it.id,
      x: r * Math.cos(it.a),
      y: -0.15,
      z: r * Math.sin(it.a),
      role: "band",
      hop: hop.get(it.id) ?? 9,
      ghost: it.ghost,
      day: it.day,
      parent: it.parent,
    });
  });

  // Folded categories of a person who is not the center: hidden, at the person's place.
  for (const [cat, person] of folded) {
    if (nodes.has(cat)) continue;
    const p = nodes.get(person);
    nodes.set(cat, { id: cat, x: p?.x ?? 0, y: p?.y ?? 0, z: p?.z ?? 0, role: "hidden", hop: 9, ghost: false, parent: person });
  }

  const rings: OrbitRing[] = keys.map((k) => {
    const anchorId = anchors.get(k);
    const onRing = Array.from(ringFor.values()).filter((r) => r === k).length;
    return {
      key: k,
      label: anchorId ? E(anchorId).label : RING_LABEL[k],
      radius: radiusOf.get(k)!,
      anchorId,
      count: anchorId ? (cfg.categoryRecords.get(anchorId)?.length ?? onRing) : onRing,
    };
  });

  return {
    centerId,
    activeRing: activeCategory ? categoryRing(E(activeCategory)) : undefined,
    activeCategory,
    nodes,
    rings,
    edges,
    hints,
    window,
    outerRadius,
    bandRadius,
  };
}
