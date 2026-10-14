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
  /** A member the question is about (an organization's other contacts): named first, as a card. */
  answer?: boolean;
  /**
   * A person two steps out, above a shared contact date of the center (the firm lists them on
   * the same date): named with a tag at secondary strength, placed before the cards around it.
   */
  peer?: boolean;
  /**
   * The node sits on a crowded ring (more than CROWDED_RING records): at rest it shows as
   * its node and initials, and its name card shows on hover or keyboard focus. Never set on
   * the center, the orange chain, the focus, or a record the note is about.
   */
  crowded?: boolean;
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
  /** More than CROWDED_RING records on it: its records show their names on hover. */
  crowded?: boolean;
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

/** The most lifted members an organization-centered view names (more would crowd the labels). */
const MAX_NAMED_MEMBERS = 8;
const RADIUS = { center: 0.34, major: 0.17, contact: 0.22, record: 0.13, second: 0.11, faint: 0.075, hint: 0.085 };
/** The rings of an organization's contacts (orbit-layout: people grouped by kind). */
const CONTACT_RINGS = new Set<RingKey>(["senators", "house", "staff", "press"]);
const MAJOR = new Set<Entity["type"]>(["person", "org", "bill", "topic"]);
/** At most this many edge labels show (the focus edges). */
const MAX_EDGE_LABELS = 8;
/** A ring with more records than this names them on hover only (their cards would cover each other). */
export const CROWDED_RING = 8;

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
  //   (Wicker to his contacts, Wicker to the PACs);
  // - else the path from the root to the focus, cut to the nodes on the rings
  //   and above them (Ukraine, S. 5025, Wicker; Wicker to the June 9 contact).
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
    // The last two steps of the path into the focus (data edges: Wicker, Contacts, the June 9 contact).
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

  // A few members lifted at the third hop (orbit-layout) answer the question: they and the
  // records they float above are named, at secondary strength.
  const namedLifted = new Set<string>();
  for (const n of layout.nodes.values()) {
    if (n.role !== "lifted" || n.hop !== 3) continue;
    namedLifted.add(n.id);
    // Every lifted record that joins this person (Warner's two contacts), not only the one it floats above.
    for (const e of layout.edges) {
      const other = e.a === n.id ? e.b : e.b === n.id ? e.a : undefined;
      if (!e.ghost && other && layout.nodes.get(other)?.role === "lifted" && catalog.entities[other]?.type === "detail") namedLifted.add(other);
    }
  }

  // The people above a shared contact date of the center (the firm's rows of one day) answer
  // "who else is on this record": they are named, at secondary strength (two steps out).
  const peers = new Set<string>();
  for (const n of layout.nodes.values()) {
    if (n.role === "lifted" && n.hop === 2 && catalog.entities[n.id]?.type === "person" && n.parent && layout.nodes.get(n.parent)?.ring === "dates") {
      namedLifted.add(n.id);
      peers.add(n.id);
    }
  }

  // Centered on an organization (a FARA registrant), the few members lifted above its contact
  // records answer "who else did it contact": they are named too.
  // The members above its "Ties" records (the firm's dated contacts with other senators) are the
  // answer itself: they draw at full strength and are named first, as cards, before the records.
  const answers = new Set<string>();
  if (centerId && catalog.entities[centerId]?.type === "org") {
    const members = [...layout.nodes.values()].filter((n) => n.role === "lifted" && n.hop === 2 && catalog.entities[n.id]?.type === "person");
    if (members.length > 0 && members.length <= MAX_NAMED_MEMBERS) {
      for (const n of members) {
        namedLifted.add(n.id);
        if (n.parent && layout.nodes.get(n.parent)?.ring === "ties") answers.add(n.id);
      }
    }
  }

  // Records in common: centered on an organization, two or more bills lifted above its contacts,
  // each joining two or more of them (S. 5025 cosponsors, H.R. 5334 yes votes). The bills are the
  // shared records, named at full strength; the contacts on a shared bill stay full, and the
  // contacts on none dim.
  const sharedBills = new Map<string, Set<string>>();
  if (centerId && catalog.entities[centerId]?.type === "org") {
    for (const n of layout.nodes.values()) {
      if (n.role !== "lifted" || catalog.entities[n.id]?.type !== "bill") continue;
      const people = new Set<string>();
      for (const e of layout.edges) {
        if (e.ghost) continue;
        const other = e.a === n.id ? e.b : e.b === n.id ? e.a : undefined;
        if (other && catalog.entities[other]?.type === "person") people.add(other);
      }
      if (people.size >= 2) sharedBills.set(n.id, people);
    }
  }
  const inCommon = sharedBills.size >= 2;
  const sharers = new Set([...sharedBills.values()].flatMap((ps) => [...ps]));
  if (inCommon) for (const id of sharers) if (layout.nodes.get(id)?.role === "lifted") namedLifted.add(id);

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
    else if (n.role === "ring" && inCommon && n.ring && CONTACT_RINGS.has(n.ring) && !sharers.has(n.id) && !onPath) tier = "dim";
    else if (n.role === "ring") tier = onPath || !active || n.ring === active ? "full" : "dim";
    else if (answers.has(n.id) || (inCommon && sharedBills.has(n.id))) tier = "full";
    else {
      // Lifted: the way back to the root draws as secondary; other context above a record
      // stays dim (unnamed dots at full strength would read as answers).
      tier = onPath || namedLifted.has(n.id) ? "second" : "dim";
    }
    tierOf.set(n.id, tier);
    let label: LabelKind = "none";
    if (tier === "center") label = "center";
    else if (tier === "anchor") label = "ring";
    else if (tier === "full") label = MAJOR.has(entity.type) ? "card" : "record";
    // Lifted nodes are named only on the orange chain (hover names the others).
    else if (tier === "second" && (onPath || namedLifted.has(n.id))) label = "tag";
    const radius =
      tier === "center"
        ? RADIUS.center
        : tier === "faint" || tier === "ghost"
          ? RADIUS.faint
          : tier === "second" || (tier === "dim" && n.role === "lifted")
            ? RADIUS.second
            : MAJOR.has(entity.type)
              ? // An organization's contacts sit on many rings, so the camera is far: a larger node keeps initials legible.
                n.role === "ring" && n.ring && CONTACT_RINGS.has(n.ring)
                ? RADIUS.contact
                : RADIUS.major
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
      answer: answers.has(n.id) || undefined,
      peer: peers.has(n.id) || undefined,
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
    // Records in common: the links from each shared bill to its people lead; the firm's own
    // spokes recede (they are the last step's answer), and so do the contacts on no shared bill.
    else if (inCommon && (sharedBills.has(e.a) || sharedBills.has(e.b)) && tierOf.get(e.a) !== "dim" && tierOf.get(e.b) !== "dim") tier = "focus";
    else if (inCommon && (ta === "dim" || tb === "dim" || e.a === centerId || e.b === centerId)) tier = "dim";
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
  // An organization's contacts: the ring label ("Senators · 7") names the relationship already.
  for (const e of focusLabelled) {
    const ring = layout.nodes.get(e.a === centerId ? e.b : e.a)?.ring;
    if (ring && CONTACT_RINGS.has(ring)) continue;
    if ((perRing.get(keyOf(e)) ?? 0) > 1 || shown >= MAX_EDGE_LABELS) continue;
    e.showLabel = true;
    shown++;
  }

  // Crowded rings: more than CROWDED_RING records drawn on one ring (S. 5025's 17 cosponsors).
  const perRingNodes = new Map<RingKey, number>();
  for (const n of nodes) {
    if (layout.nodes.get(n.id)?.role !== "ring" || !n.ring || (n.tier !== "full" && n.tier !== "dim")) continue;
    perRingNodes.set(n.ring, (perRingNodes.get(n.ring) ?? 0) + 1);
  }
  const crowdedRings = new Set([...perRingNodes].filter(([, c]) => c > CROWDED_RING).map(([k]) => k));

  const rings: ViewRing[] = layout.rings.map((r) => ({
    ...r,
    state: !active ? "normal" : r.key === active ? "active" : "dim",
    text: ringText(r),
    crowded: crowdedRings.has(r.key) || undefined,
  }));

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const marks = resolveMarks(catalog, { focusId: g.focusId, centerId, nodes, byId, anchoredRings: new Set(anchorOf.keys()), window: layout.window }, notes);
  for (const n of nodes) {
    if (marks.emphasis.has(n.id)) n.emphasis = true;
    // A record the note names shows its name (a lifted node is named only on the orange chain otherwise).
    if (marks.named.has(n.id) && n.label === "none") {
      n.label = "tag";
      if (n.tier === "dim") n.tier = "second";
    }
    // On a crowded ring, a record names itself on hover only, unless it is the answer's own
    // (the orange chain, the focus, a record the note is about).
    if (n.ring && crowdedRings.has(n.ring) && layout.nodes.get(n.id)?.role === "ring" && (n.tier === "full" || n.tier === "dim") && !n.onPath && !n.focused && !n.emphasis && !n.answer) {
      n.crowded = true;
    }
  }

  return { centerId, focusId, nodes, byId, pathSegs: segs, edges, rings, layout, marks };
}

function ringText(r: OrbitRing): string {
  return r.count > 0 ? `${r.label} · ${r.count}` : r.label;
}
