/**
 * Strata graph data: the Sen. Ellen Hartley neighborhood from the demo fixtures,
 * placed on four horizontal planes (one plane per entity kind).
 * The layout is fixed (polar coordinates per plane), so every load looks the same.
 */
import { entities } from "@/data/entities";
import { sources } from "@/data/sources";

export type PlaneId = "bills" | "people" | "orgs" | "records";
export type NodeKind = "topic" | "bill" | "person" | "org" | "meeting" | "money" | "trip" | "vote";

export interface Plane {
  id: PlaneId;
  label: string;
  y: number;
}

/** Top to bottom. The gap between planes is the same everywhere. */
export const PLANES: Plane[] = [
  { id: "bills", label: "Bills and topics", y: 6 },
  { id: "people", label: "People", y: 2 },
  { id: "orgs", label: "Organizations", y: -2 },
  { id: "records", label: "Money and events", y: -6 },
];
export const PLANE_RADIUS = 9.5;

export interface StrataNode {
  id: string;
  kind: NodeKind;
  plane: PlaneId;
  label: string;
  sublabel: string;
  initials?: string;
  /** Context nodes (members outside the story) stay faint in the overview. */
  context?: boolean;
  position: [number, number, number];
  radius: number;
  source?: string;
}

export interface StrataEdge {
  id: string;
  source: string;
  target: string;
  /** Lowercase relationship phrase, read from source to target. */
  label: string;
}

export const ROOT_ID = "ukraine";
export const DEFAULT_FOCUS = "hartley";

const entity = (id: string) => {
  const e = entities.find((x) => x.id === id);
  if (!e) throw new Error(`Unknown entity ${id}`);
  return e;
};
const sourceTitle = (id: string) => sources.find((s) => s.id === id)?.title;

const planeY = (p: PlaneId) => PLANES.find((x) => x.id === p)!.y;
const DEG = Math.PI / 180;
const polar = (plane: PlaneId, r: number, deg: number): [number, number, number] => [
  +(r * Math.cos(deg * DEG)).toFixed(3),
  planeY(plane),
  +(r * Math.sin(deg * DEG)).toFixed(3),
];

const RADIUS: Record<NodeKind, number> = {
  topic: 0.42,
  bill: 0.34,
  person: 0.24,
  org: 0.28,
  meeting: 0.19,
  money: 0.19,
  trip: 0.19,
  vote: 0.17,
};

interface Spec {
  id: string;
  kind: NodeKind;
  plane: PlaneId;
  r: number;
  deg: number;
  context?: boolean;
  /** Overrides for nodes that are not entities in the fixtures (the PAC receipts). */
  label?: string;
  sublabel?: string;
  source?: string;
}

/** Angles: 0 is +x, 90 is +z (toward the default camera). */
const SPECS: Spec[] = [
  // Bills and topics
  { id: "ukraine", kind: "topic", plane: "bills", r: 3.4, deg: 115 },
  { id: "s456", kind: "bill", plane: "bills", r: 2.8, deg: -25, source: "cong-s456" },
  { id: "hr123", kind: "bill", plane: "bills", r: 6.6, deg: 186, source: "cong-hr123" },
  // People
  { id: "hartley", kind: "person", plane: "people", r: 0, deg: 0, source: "cong-s456" },
  { id: "attendee-meridian", kind: "person", plane: "people", r: 4.4, deg: 18, source: "disc-private" },
  { id: "attendee-aegis", kind: "person", plane: "people", r: 4.9, deg: 46, source: "disc-private" },
  { id: "attendee-atlantic", kind: "person", plane: "people", r: 4.3, deg: 74, source: "disc-private" },
  { id: "marquez", kind: "person", plane: "people", r: 7.4, deg: -18, context: true },
  { id: "bellamy", kind: "person", plane: "people", r: 7.9, deg: -44, context: true },
  { id: "okafor", kind: "person", plane: "people", r: 7.2, deg: -70, context: true },
  { id: "whitcomb", kind: "person", plane: "people", r: 8.1, deg: -96, context: true },
  { id: "sato", kind: "person", plane: "people", r: 7.3, deg: -122, context: true },
  { id: "price", kind: "person", plane: "people", r: 8.0, deg: -148, context: true },
  { id: "kessler", kind: "person", plane: "people", r: 7.6, deg: 150, context: true },
  { id: "chen", kind: "person", plane: "people", r: 7.0, deg: 176, context: true },
  { id: "dawson", kind: "person", plane: "people", r: 7.8, deg: 200, context: true },
  // Organizations
  { id: "meridian", kind: "org", plane: "orgs", r: 5.4, deg: 14, source: "lda-meridian" },
  { id: "aegis", kind: "org", plane: "orgs", r: 5.8, deg: 50 },
  { id: "atlantic", kind: "org", plane: "orgs", r: 4.8, deg: 86 },
  { id: "boreal", kind: "org", plane: "orgs", r: 5.6, deg: 118 },
  { id: "redwood", kind: "org", plane: "orgs", r: 6.2, deg: 142 },
  { id: "northstar", kind: "org", plane: "orgs", r: 7.6, deg: -160, context: true, source: "lda-northstar" },
  { id: "harbor", kind: "org", plane: "orgs", r: 7.8, deg: 196, context: true, source: "lda-harbor" },
  { id: "civic", kind: "org", plane: "orgs", r: 6.6, deg: 228, context: true, source: "statement-civic" },
  // Money and events: meetings
  { id: "meeting-private", kind: "meeting", plane: "records", r: 3.8, deg: 40, source: "disc-private" },
  { id: "meeting-meridian", kind: "meeting", plane: "records", r: 6.0, deg: 16, source: "disc-meetings" },
  { id: "meeting-committee", kind: "meeting", plane: "records", r: 6.6, deg: 58, source: "disc-meetings" },
  { id: "meeting-ukraine", kind: "meeting", plane: "records", r: 5.6, deg: 82, source: "disc-meetings" },
  // Money and events: contributions (FEC Schedule A, Aug 2026)
  { id: "contrib-aegis", kind: "money", plane: "records", r: 4.4, deg: 120, label: "Aegis Systems PAC", sublabel: "$18,750 · Apr 8, 2026", source: "fec-hartley" },
  { id: "contrib-boreal", kind: "money", plane: "records", r: 6.0, deg: 126, label: "Boreal Aerospace PAC", sublabel: "$12,400 · Dec 11, 2025", source: "fec-hartley" },
  { id: "contrib-redwood", kind: "money", plane: "records", r: 4.9, deg: 148, label: "Redwood Defense Technologies PAC", sublabel: "$7,625 · Aug 21, 2026", source: "fec-hartley" },
  { id: "contrib-meridian", kind: "money", plane: "records", r: 7.0, deg: 100, label: "Meridian employees", sublabel: "$3,850 · May 19, 2025", source: "fec-hartley" },
  // Money and events: trips
  { id: "trip-kyiv", kind: "trip", plane: "records", r: 4.0, deg: 200, source: "travel-hartley" },
  { id: "trip-warsaw", kind: "trip", plane: "records", r: 6.2, deg: 220, source: "travel-hartley" },
  { id: "trip-brussels", kind: "trip", plane: "records", r: 5.2, deg: 244, source: "travel-hartley" },
  // Money and events: votes
  { id: "vote-s456", kind: "vote", plane: "records", r: 3.9, deg: -32, source: "cong-votes" },
  { id: "vote-hr123", kind: "vote", plane: "records", r: 5.8, deg: -58, source: "cong-votes" },
  { id: "vote-oversight", kind: "vote", plane: "records", r: 6.4, deg: -12, source: "cong-votes" },
  { id: "vote-export", kind: "vote", plane: "records", r: 4.9, deg: -82, source: "cong-votes" },
];

/** Readable names for the trip and meeting records (the fixtures keep a date as the sublabel). */
export const NODES: StrataNode[] = SPECS.map((s) => {
  const e = s.label ? undefined : entity(s.id);
  return {
    id: s.id,
    kind: s.kind,
    plane: s.plane,
    label: s.label ?? e!.label,
    sublabel: s.sublabel ?? e!.sublabel ?? "",
    initials: e?.initials,
    context: s.context,
    position: polar(s.plane, s.r, s.deg),
    radius: s.id === "hartley" ? 0.36 : RADIUS[s.kind],
    source: s.source ? sourceTitle(s.source) : undefined,
  };
});

export const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));

const e = (source: string, target: string, label: string): StrataEdge => ({ id: `${source}>${target}`, source, target, label });

export const EDGES: StrataEdge[] = [
  e("ukraine", "s456", "legislation on"),
  e("ukraine", "hr123", "legislation on"),
  e("s456", "hartley", "sponsored by"),
  e("s456", "marquez", "cosponsored by"),
  e("s456", "bellamy", "cosponsored by"),
  e("s456", "okafor", "cosponsored by"),
  e("s456", "whitcomb", "cosponsored by"),
  e("s456", "sato", "cosponsored by"),
  e("s456", "price", "cosponsored by"),
  e("hr123", "kessler", "sponsored by"),
  e("hr123", "chen", "cosponsored by"),
  e("hr123", "dawson", "cosponsored by"),
  // Hartley's records
  e("hartley", "meeting-private", "met privately"),
  e("hartley", "meeting-meridian", "was briefed"),
  e("hartley", "meeting-committee", "attended"),
  e("hartley", "meeting-ukraine", "met"),
  e("hartley", "trip-kyiv", "traveled to"),
  e("hartley", "trip-warsaw", "traveled to"),
  e("hartley", "trip-brussels", "traveled to"),
  e("hartley", "vote-s456", "voted yes"),
  e("hartley", "vote-hr123", "voted yes"),
  e("hartley", "vote-oversight", "voted yes"),
  e("hartley", "vote-export", "voted no"),
  e("contrib-aegis", "hartley", "received by"),
  e("contrib-boreal", "hartley", "received by"),
  e("contrib-redwood", "hartley", "received by"),
  e("contrib-meridian", "hartley", "received by"),
  e("vote-s456", "s456", "cloture vote on"),
  e("vote-hr123", "hr123", "package vote on"),
  // The private meeting and who was in the room
  e("meeting-private", "attendee-meridian", "attended by"),
  e("meeting-private", "attendee-aegis", "attended by"),
  e("meeting-private", "attendee-atlantic", "attended by"),
  e("attendee-meridian", "meridian", "represents"),
  e("attendee-aegis", "aegis", "represents"),
  e("attendee-atlantic", "atlantic", "works at"),
  e("meeting-meridian", "meridian", "briefed by"),
  // Money: organization to receipt
  e("aegis", "contrib-aegis", "contributed via pac"),
  e("boreal", "contrib-boreal", "contributed via pac"),
  e("redwood", "contrib-redwood", "contributed via pac"),
  e("meridian", "contrib-meridian", "employees contributed"),
  // Context
  e("northstar", "price", "policy briefing"),
  e("harbor", "dawson", "policy briefing"),
  e("civic", "ukraine", "published analysis"),
];

const ADJ = new Map<string, StrataEdge[]>();
for (const ed of EDGES) {
  for (const id of [ed.source, ed.target]) {
    if (!ADJ.has(id)) ADJ.set(id, []);
    ADJ.get(id)!.push(ed);
  }
}
export const edgesOf = (id: string) => ADJ.get(id) ?? [];
export const otherEnd = (ed: StrataEdge, id: string) => (ed.source === id ? ed.target : ed.source);

/**
 * The focus path: the shortest chain from the root topic to the focused node
 * (breadth first, ties broken by edge order, so it is stable).
 * Returns node ids in order from the root.
 */
export function focusPath(target: string | null): string[] {
  if (!target) return [];
  if (target === ROOT_ID) return [ROOT_ID];
  const prev = new Map<string, string>([[ROOT_ID, ROOT_ID]]);
  const queue = [ROOT_ID];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === target) break;
    for (const ed of edgesOf(cur)) {
      const nxt = otherEnd(ed, cur);
      if (!prev.has(nxt)) {
        prev.set(nxt, cur);
        queue.push(nxt);
      }
    }
  }
  if (!prev.has(target)) return [target];
  const out = [target];
  while (out[0] !== ROOT_ID) out.unshift(prev.get(out[0])!);
  return out;
}

export const edgeBetween = (a: string, b: string) =>
  EDGES.find((ed) => (ed.source === a && ed.target === b) || (ed.source === b && ed.target === a));

/** Overview labels: the story nodes, in priority order. */
export const OVERVIEW_LABELS = ["hartley", "ukraine", "s456", "hr123", "meeting-private", "contrib-aegis", "trip-kyiv", "meridian", "vote-s456"];
