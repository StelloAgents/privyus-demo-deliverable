/**
 * Chronos lab data: the Sen. Ellen Hartley neighborhood from src/data, placed on the US map.
 * Every position is computed from fixed rules (no randomness), so the layout is the same on every load.
 */
import outlines from "@/features/dashboard/us-states.json";

export type Kind = "member" | "bill" | "topic" | "record" | "org" | "person" | "context";
export type Glyph =
  | "vote"
  | "trip"
  | "meeting"
  | "contribution"
  | "statement"
  | "filing"
  | "bill"
  | "topic"
  | "org"
  | "factory"
  | "library";

export interface ChronosNode {
  id: string;
  label: string;
  sub: string;
  kind: Kind;
  /** Where the node stands: a state code, or "ABROAD:<city>". */
  anchor: string;
  /** ISO date the record enters the story. Undated nodes are always present. */
  date?: string;
  initials?: string;
  glyph?: Glyph;
  /** Category name for record nodes (meta line on the card). */
  category?: string;
  source?: string;
}

export interface ChronosEdge {
  id: string;
  s: string;
  t: string;
  label: string;
  date?: string;
}

export const ROOT_ID = "hartley";

export const NODES: ChronosNode[] = [
  { id: "hartley", label: "Sen. Ellen Hartley", sub: "R-OH · Senate", kind: "member", anchor: "OH", initials: "EH", source: "Congress.gov" },
  { id: "ukraine", label: "US Stance on Ukraine", sub: "Topic · foreign policy", kind: "topic", anchor: "ABROAD:Kyiv", glyph: "topic" },
  { id: "hr123", label: "H.R. 123 · Ukraine Aid Act", sub: "House · introduced Jan 23, 2025", kind: "bill", anchor: "DC", date: "2025-01-23", glyph: "bill", source: "Congress.gov" },
  { id: "s456", label: "S. 456 · Defense Support Act", sub: "Senate · introduced Feb 11, 2025", kind: "bill", anchor: "DC", date: "2025-02-11", glyph: "bill", source: "Congress.gov" },

  // Votes (Senate floor, Washington).
  { id: "vote-reporting", label: "Yes · transfer reporting", sub: "Jun 12, 2025", kind: "record", anchor: "DC", date: "2025-06-12", glyph: "vote", category: "Vote", source: "Senate roll call" },
  { id: "vote-replenishment", label: "Yes · stockpile replenishment", sub: "Aug 6, 2025", kind: "record", anchor: "DC", date: "2025-08-06", glyph: "vote", category: "Vote", source: "Senate roll call" },
  { id: "vote-hr123", label: "Yes · H.R. 123 package", sub: "Nov 19, 2025", kind: "record", anchor: "DC", date: "2025-11-19", glyph: "vote", category: "Vote", source: "Senate roll call" },
  { id: "vote-oversight", label: "Yes · aid oversight amendment", sub: "Apr 14, 2026", kind: "record", anchor: "DC", date: "2026-04-14", glyph: "vote", category: "Vote", source: "Senate roll call" },
  { id: "vote-s456", label: "Yes · S. 456 cloture", sub: "May 21, 2026", kind: "record", anchor: "DC", date: "2026-05-21", glyph: "vote", category: "Vote", source: "Senate roll call" },
  { id: "vote-export", label: "No · export pause motion", sub: "Jun 11, 2026", kind: "record", anchor: "DC", date: "2026-06-11", glyph: "vote", category: "Vote", source: "Senate roll call" },

  // Meetings (Washington).
  { id: "meeting-industry", label: "Industrial base briefing", sub: "Jul 16, 2025", kind: "record", anchor: "DC", date: "2025-07-16", glyph: "meeting", category: "Meeting", source: "Office disclosure" },
  { id: "meeting-committee", label: "Armed Services roundtable", sub: "Oct 7, 2025", kind: "record", anchor: "DC", date: "2025-10-07", glyph: "meeting", category: "Meeting", source: "Office disclosure" },
  { id: "meeting-meridian", label: "Meridian policy briefing", sub: "Feb 24, 2026", kind: "record", anchor: "DC", date: "2026-02-24", glyph: "meeting", category: "Meeting", source: "LDA filing" },
  { id: "meeting-ukraine", label: "Ukraine embassy delegation", sub: "Apr 29, 2026", kind: "record", anchor: "DC", date: "2026-04-29", glyph: "meeting", category: "Meeting", source: "Office disclosure" },
  { id: "meeting-private", label: "Private meeting", sub: "Jun 17, 2026 · 3 attendees", kind: "record", anchor: "DC", date: "2026-06-17", glyph: "meeting", category: "Meeting", source: "Office disclosure" },

  // Attendees of the Jun 17 private meeting.
  { id: "attendee-meridian", label: "Clara Voss", sub: "Meridian Public Affairs", kind: "person", anchor: "DC", date: "2026-06-17", initials: "CV", source: "LDA filing" },
  { id: "attendee-aegis", label: "Nathaniel Pierce", sub: "Aegis Systems", kind: "person", anchor: "VA", date: "2026-06-17", initials: "NP", source: "Office disclosure" },
  { id: "attendee-atlantic", label: "Dr. Priya Sen", sub: "Atlantic Security Institute", kind: "person", anchor: "DC", date: "2026-06-17", initials: "PS", source: "Office disclosure" },

  // Organizations. Contributors are dated by their contribution.
  { id: "meridian", label: "Meridian Public Affairs", sub: "Lobbying firm · Washington, DC", kind: "org", anchor: "DC", date: "2025-05-19", glyph: "org", source: "LDA filing" },
  { id: "atlantic", label: "Atlantic Security Institute", sub: "Think tank · Washington, DC", kind: "org", anchor: "DC", date: "2026-06-17", glyph: "library", source: "Office disclosure" },
  { id: "boreal", label: "Boreal Aerospace PAC", sub: "$12,400 · Dec 11, 2025", kind: "org", anchor: "WA", date: "2025-12-11", glyph: "factory", category: "Contribution", source: "FEC" },
  { id: "aegis", label: "Aegis Systems PAC", sub: "$18,750 · Apr 8, 2026", kind: "org", anchor: "VA", date: "2026-04-08", glyph: "factory", category: "Contribution", source: "FEC" },
  { id: "redwood", label: "Redwood Defense Technologies PAC", sub: "$7,625 · Aug 21, 2026", kind: "org", anchor: "TX", date: "2026-08-21", glyph: "factory", category: "Contribution", source: "FEC" },

  // Trips (abroad).
  { id: "trip-warsaw", label: "Warsaw security forum", sub: "Sep 18, 2025", kind: "record", anchor: "ABROAD:Warsaw", date: "2025-09-18", glyph: "trip", category: "Trip", source: "Travel disclosure" },
  { id: "trip-kyiv", label: "Kyiv delegation", sub: "Mar 12, 2026", kind: "record", anchor: "ABROAD:Kyiv", date: "2026-03-12", glyph: "trip", category: "Trip", source: "Travel disclosure" },
  { id: "trip-brussels", label: "Brussels NATO briefing", sub: "Jul 9, 2026", kind: "record", anchor: "ABROAD:Brussels", date: "2026-07-09", glyph: "trip", category: "Trip", source: "Travel disclosure" },

  // Statements and filings.
  { id: "opinion-press", label: "Press release on oversight", sub: "Nov 20, 2025", kind: "record", anchor: "OH", date: "2025-11-20", glyph: "statement", category: "Statement", source: "Office statement" },
  { id: "opinion-floor", label: "Floor statement on air defense", sub: "May 20, 2026", kind: "record", anchor: "DC", date: "2026-05-20", glyph: "statement", category: "Statement", source: "Congressional Record" },
  { id: "opinion-interview", label: "Interview on allied burden", sub: "Jul 22, 2026", kind: "record", anchor: "OH", date: "2026-07-22", glyph: "statement", category: "Statement", source: "Office statement" },
  { id: "other-hearing", label: "Defense supply chain hearing", sub: "Aug 5, 2026", kind: "record", anchor: "DC", date: "2026-08-05", glyph: "filing", category: "Hearing", source: "Committee record" },

  // Context: other sponsors and cosponsors, drawn faint.
  { id: "kessler", label: "Rep. Miriam Kessler", sub: "D-PA · sponsor of H.R. 123", kind: "context", anchor: "PA", date: "2025-01-23", initials: "MK" },
  { id: "marquez", label: "Sen. Isabel Marquez", sub: "D-NM", kind: "context", anchor: "NM", date: "2025-03-04", initials: "IM" },
  { id: "okafor", label: "Sen. Daniel Okafor", sub: "D-IL", kind: "context", anchor: "IL", date: "2025-04-08", initials: "DO" },
  { id: "whitcomb", label: "Sen. Claire Whitcomb", sub: "R-ME", kind: "context", anchor: "ME", date: "2025-04-22", initials: "CW" },
  { id: "sato", label: "Sen. Naomi Sato", sub: "D-WA", kind: "context", anchor: "WA", date: "2025-05-13", initials: "NS" },
  { id: "price", label: "Sen. Adrian Price", sub: "R-UT", kind: "context", anchor: "UT", date: "2025-06-03", initials: "AP" },
  { id: "chen", label: "Rep. Leah Chen", sub: "D-CA", kind: "context", anchor: "CA", date: "2025-02-18", initials: "LC" },
  { id: "dawson", label: "Rep. Grant Dawson", sub: "R-NC", kind: "context", anchor: "NC", date: "2025-03-25", initials: "GD" },
  { id: "greer", label: "Rep. Owen Greer", sub: "R-CO", kind: "context", anchor: "CO", date: "2025-04-29", initials: "OG" },
];

export const EDGES: ChronosEdge[] = [
  { id: "e-ukr-hr123", s: "ukraine", t: "hr123", label: "legislation on", date: "2025-01-23" },
  { id: "e-ukr-s456", s: "ukraine", t: "s456", label: "legislation on", date: "2025-02-11" },
  { id: "e-s456-hartley", s: "s456", t: "hartley", label: "sponsored by", date: "2025-02-11" },

  { id: "e-vote-reporting", s: "hartley", t: "vote-reporting", label: "voted yes", date: "2025-06-12" },
  { id: "e-vote-replenishment", s: "hartley", t: "vote-replenishment", label: "voted yes", date: "2025-08-06" },
  { id: "e-vote-hr123", s: "hartley", t: "vote-hr123", label: "voted yes", date: "2025-11-19" },
  { id: "e-vote-hr123-bill", s: "vote-hr123", t: "hr123", label: "vote on", date: "2025-11-19" },
  { id: "e-vote-oversight", s: "hartley", t: "vote-oversight", label: "voted yes", date: "2026-04-14" },
  { id: "e-vote-s456", s: "hartley", t: "vote-s456", label: "voted yes", date: "2026-05-21" },
  { id: "e-vote-s456-bill", s: "vote-s456", t: "s456", label: "cloture on", date: "2026-05-21" },
  { id: "e-vote-export", s: "hartley", t: "vote-export", label: "voted no", date: "2026-06-11" },

  { id: "e-meet-industry", s: "hartley", t: "meeting-industry", label: "attended", date: "2025-07-16" },
  { id: "e-meet-committee", s: "hartley", t: "meeting-committee", label: "attended", date: "2025-10-07" },
  { id: "e-meet-meridian", s: "hartley", t: "meeting-meridian", label: "attended", date: "2026-02-24" },
  { id: "e-meet-meridian-org", s: "meeting-meridian", t: "meridian", label: "briefed by", date: "2026-02-24" },
  { id: "e-meet-ukraine", s: "hartley", t: "meeting-ukraine", label: "met with", date: "2026-04-29" },
  { id: "e-meet-private", s: "hartley", t: "meeting-private", label: "met privately", date: "2026-06-17" },
  { id: "e-att-voss", s: "meeting-private", t: "attendee-meridian", label: "attended by", date: "2026-06-17" },
  { id: "e-att-pierce", s: "meeting-private", t: "attendee-aegis", label: "attended by", date: "2026-06-17" },
  { id: "e-att-sen", s: "meeting-private", t: "attendee-atlantic", label: "attended by", date: "2026-06-17" },
  { id: "e-voss-meridian", s: "attendee-meridian", t: "meridian", label: "represents", date: "2026-06-17" },
  { id: "e-pierce-aegis", s: "attendee-aegis", t: "aegis", label: "represents", date: "2026-06-17" },
  { id: "e-sen-atlantic", s: "attendee-atlantic", t: "atlantic", label: "works at", date: "2026-06-17" },

  { id: "e-meridian-money", s: "meridian", t: "hartley", label: "employees gave $3,850", date: "2025-05-19" },
  { id: "e-boreal-money", s: "boreal", t: "hartley", label: "contributed $12,400", date: "2025-12-11" },
  { id: "e-aegis-money", s: "aegis", t: "hartley", label: "contributed $18,750", date: "2026-04-08" },
  { id: "e-redwood-money", s: "redwood", t: "hartley", label: "contributed $7,625", date: "2026-08-21" },

  { id: "e-trip-warsaw", s: "hartley", t: "trip-warsaw", label: "traveled to", date: "2025-09-18" },
  { id: "e-trip-kyiv", s: "hartley", t: "trip-kyiv", label: "traveled to", date: "2026-03-12" },
  { id: "e-trip-brussels", s: "hartley", t: "trip-brussels", label: "traveled to", date: "2026-07-09" },

  { id: "e-op-press", s: "hartley", t: "opinion-press", label: "said", date: "2025-11-20" },
  { id: "e-op-floor", s: "hartley", t: "opinion-floor", label: "said", date: "2026-05-20" },
  { id: "e-op-interview", s: "hartley", t: "opinion-interview", label: "said", date: "2026-07-22" },
  { id: "e-hearing", s: "hartley", t: "other-hearing", label: "participated", date: "2026-08-05" },

  { id: "e-kessler", s: "hr123", t: "kessler", label: "sponsored by", date: "2025-01-23" },
  { id: "e-chen", s: "hr123", t: "chen", label: "cosponsored by", date: "2025-02-18" },
  { id: "e-dawson", s: "hr123", t: "dawson", label: "cosponsored by", date: "2025-03-25" },
  { id: "e-greer", s: "hr123", t: "greer", label: "cosponsored by", date: "2025-04-29" },
  { id: "e-marquez", s: "s456", t: "marquez", label: "cosponsored by", date: "2025-03-04" },
  { id: "e-okafor", s: "s456", t: "okafor", label: "cosponsored by", date: "2025-04-08" },
  { id: "e-whitcomb", s: "s456", t: "whitcomb", label: "cosponsored by", date: "2025-04-22" },
  { id: "e-sato", s: "s456", t: "sato", label: "cosponsored by", date: "2025-05-13" },
  { id: "e-price", s: "s456", t: "price", label: "cosponsored by", date: "2025-06-03" },
];

/* ------------------------------------------------------------------ time */

export const T_START = Date.UTC(2025, 0, 1);
export const T_END = Date.UTC(2026, 8, 30);
export const dateMs = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
/** 0 at Jan 1, 2025 and 1 at Sep 30, 2026. */
export const timeT = (ms: number) => Math.min(1, Math.max(0, (ms - T_START) / (T_END - T_START)));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function formatDay(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export function formatMonth(ms: number): string {
  const d = new Date(ms);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** The moment a node or edge is revealed (undated items: always). */
export const nodeAt = new Map(NODES.map((n) => [n.id, n.date ? dateMs(n.date) : -Infinity]));
export const edgeAt = new Map(
  EDGES.map((e) => [e.id, Math.max(e.date ? dateMs(e.date) : -Infinity, nodeAt.get(e.s) ?? -Infinity, nodeAt.get(e.t) ?? -Infinity)]),
);

/** Monthly histogram bins of Hartley's dated records (context members excluded). */
export interface Bin {
  start: number;
  end: number;
  count: number;
}
export const BINS: Bin[] = (() => {
  const bins: Bin[] = [];
  for (let i = 0; i < 21; i++) {
    const start = Date.UTC(2025, i, 1);
    const end = Date.UTC(2025, i + 1, 1);
    const count = NODES.filter((n) => n.kind !== "context" && n.date && dateMs(n.date) >= start && dateMs(n.date) < end).length;
    bins.push({ start, end, count });
  }
  return bins;
})();

/* ------------------------------------------------------------------ space */

const LNG0 = -96;
const LAT0 = 38.4;
const K = 0.27;
const COS = Math.cos(LAT0 * (Math.PI / 180));
/** Equirectangular projection onto the ground plane (x east, z south). */
export function project(lng: number, lat: number): [number, number] {
  return [(lng - LNG0) * COS * K, -(lat - LAT0) * K];
}

const CENTROIDS: Record<string, [number, number]> = {
  OH: [-82.8, 40.3],
  DC: [-77.0, 38.9],
  VA: [-79.9, 37.2],
  WA: [-120.5, 47.4],
  TX: [-99.3, 31.5],
  PA: [-77.8, 40.9],
  NM: [-106.1, 34.4],
  IL: [-89.2, 40.0],
  ME: [-69.2, 45.4],
  UT: [-111.7, 39.3],
  CA: [-119.4, 37.2],
  NC: [-79.4, 35.6],
  CO: [-105.5, 39.0],
};

/** Abroad anchors: a short column of ground ticks out over the Atlantic, east of Maine. */
const ABROAD: Record<string, [number, number]> = {
  Brussels: [-61.5, 45.0],
  Warsaw: [-60.0, 42.2],
  Kyiv: [-61.8, 39.4],
};

export function anchorXZ(anchor: string): [number, number] {
  if (anchor.startsWith("ABROAD:")) {
    const [lng, lat] = ABROAD[anchor.slice(7)];
    return project(lng, lat);
  }
  const [lng, lat] = CENTROIDS[anchor];
  return project(lng, lat);
}

export const ABROAD_LABEL_XZ = project(-60.5, 47.2);

export interface Placed {
  /** Ground point the leader line drops to. */
  ground: [number, number];
  /** Node x/z (offset from the ground point when several share an anchor). */
  x: number;
  z: number;
  /** Height in the flat view. */
  flat: number;
  /** Size (world radius). */
  r: number;
}

const FLAT_H: Record<Kind, number> = { member: 2.1, bill: 1.65, topic: 1.6, record: 1.05, org: 1.15, person: 1.35, context: 0.7 };
export const RADIUS: Record<Kind, number> = { member: 0.2, bill: 0.15, topic: 0.16, record: 0.085, org: 0.11, person: 0.11, context: 0.075 };

/** Fan the nodes that share one anchor on a golden-angle spiral, in date order, so DC reads as a tower. */
export const PLACED: Map<string, Placed> = (() => {
  const out = new Map<string, Placed>();
  const groups = new Map<string, ChronosNode[]>();
  for (const n of NODES) {
    const g = groups.get(n.anchor) ?? [];
    g.push(n);
    groups.set(n.anchor, g);
  }
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  for (const [anchor, group] of groups) {
    const [gx, gz] = anchorXZ(anchor);
    // The member, bills and topic stay at the center of their group.
    const center = group.filter((n) => n.kind === "member" || n.kind === "topic");
    const ring = group
      .filter((n) => !center.includes(n))
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.id.localeCompare(b.id));
    center.forEach((n) => out.set(n.id, { ground: [gx, gz], x: gx, z: gz, flat: FLAT_H[n.kind], r: RADIUS[n.kind] }));
    const big = ring.length > 4;
    ring.forEach((n, i) => {
      const k = center.length ? i + 1 : i;
      const rad = group.length === 1 ? 0 : big ? 0.22 + 0.11 * Math.sqrt(k) : 0.34;
      const ang = big ? k * GOLDEN - 0.6 : (i / Math.max(1, ring.length)) * Math.PI * 2 + 0.5;
      const x = gx + Math.cos(ang) * rad;
      const z = gz + Math.sin(ang) * rad * 0.8;
      // Small height steps keep labels and nodes in a dense cluster apart.
      const step = big ? (i % 5) * 0.2 : 0;
      out.set(n.id, { ground: [gx, gz], x, z, flat: FLAT_H[n.kind] + step, r: RADIUS[n.kind] });
    });
  }
  return out;
})();

/** Height in the time-depth view: dated nodes rise with their date. */
export const DEPTH_BASE = 0.35;
export const DEPTH_SPAN = 5.2;
export function depthHeight(n: ChronosNode): number {
  if (!n.date) return DEPTH_BASE * 0.6; // Hartley and the topic sit at the floor; records rise above them.
  return DEPTH_BASE + timeT(dateMs(n.date)) * DEPTH_SPAN;
}

/* ------------------------------------------------------------------ graph helpers */

export const NODE_BY_ID = new Map(NODES.map((n) => [n.id, n]));

export function neighbors(id: string): Set<string> {
  const s = new Set<string>();
  for (const e of EDGES) {
    if (e.s === id) s.add(e.t);
    if (e.t === id) s.add(e.s);
  }
  return s;
}

/** Edge ids on the shortest path from the root to a node (the orange focus path). */
export function focusPath(id: string | null): Set<string> {
  if (!id || id === ROOT_ID) return new Set();
  const prev = new Map<string, { node: string; edge: string }>();
  const seen = new Set([ROOT_ID]);
  const queue = [ROOT_ID];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === id) break;
    for (const e of EDGES) {
      const other = e.s === cur ? e.t : e.t === cur ? e.s : null;
      if (!other || seen.has(other)) continue;
      seen.add(other);
      prev.set(other, { node: cur, edge: e.id });
      queue.push(other);
    }
  }
  const path = new Set<string>();
  let at = id;
  while (prev.has(at)) {
    const p = prev.get(at)!;
    path.add(p.edge);
    at = p.node;
  }
  return path;
}

/* ------------------------------------------------------------------ map */

type Ring = [number, number][];
const RINGS = outlines as unknown as Record<string, Ring[]>;

/** Lower-48 state rings (plus DC), projected to the ground plane. Alaska and Hawaii are left out. */
export const MAP_RINGS: { code: string; ring: [number, number][] }[] = Object.entries(RINGS)
  .filter(([code]) => code !== "AK" && code !== "HI")
  .flatMap(([code, rings]) => rings.filter((r) => r.length > 3).map((ring) => ({ code, ring: ring.map(([lng, lat]) => project(lng, lat)) })));

/** States with a node above them get a slightly lifted fill. */
export const ACTIVE_STATES = new Set(NODES.filter((n) => !n.anchor.startsWith("ABROAD") && n.kind !== "context").map((n) => n.anchor));
