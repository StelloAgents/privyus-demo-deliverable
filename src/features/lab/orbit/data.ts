/**
 * Orbit + Chronos (graph lab prototype). The Sen. Ellen Hartley neighborhood,
 * taken from src/data/entities.ts. The category nodes of the main graph become
 * rings here, so records link straight to the person.
 *
 * Layout rule: the ring (radius) is the relationship type, and the angle is the
 * date (a clock face from Jan 2025 to Sep 2026). Every layout is deterministic.
 */

export type RingKind = "meetings" | "money" | "votes" | "trips" | "ties";
export type NodeKind = "person" | "member" | "org" | "bill" | "topic" | "meeting" | "money" | "vote" | "trip";

export interface LabNode {
  id: string;
  kind: NodeKind;
  label: string;
  sub: string;
  /** ISO date of the record (or first appearance for people and orgs). */
  date: string;
  initials?: string;
  /** Faint context members: never labeled, always on the outer band. */
  context?: boolean;
}

export interface LabEdge {
  id: string;
  source: string;
  target: string;
  /** Lowercase relationship phrase, read from source to target. */
  label: string;
  ring: RingKind;
  date: string;
}

export const FOCUS_ID = "hartley";

export const nodes: LabNode[] = [
  { id: "hartley", kind: "person", label: "Sen. Ellen Hartley", sub: "Senator · R-OH", date: "2025-01-01", initials: "EH" },

  { id: "meeting-private", kind: "meeting", label: "Private meeting", sub: "Meeting · Jun 17, 2026", date: "2026-06-17" },
  { id: "meeting-meridian", kind: "meeting", label: "Meridian policy briefing", sub: "Meeting · Feb 24, 2026", date: "2026-02-24" },
  { id: "meeting-committee", kind: "meeting", label: "Armed Services roundtable", sub: "Meeting · Oct 7, 2025", date: "2025-10-07" },
  { id: "meeting-ukraine", kind: "meeting", label: "Ukraine embassy delegation", sub: "Meeting · Apr 29, 2026", date: "2026-04-29" },
  { id: "meeting-industry", kind: "meeting", label: "Industrial base briefing", sub: "Meeting · Jul 16, 2025", date: "2025-07-16" },

  { id: "contrib-aegis", kind: "money", label: "Aegis Systems PAC", sub: "$18,750 · Apr 8, 2026", date: "2026-04-08" },
  { id: "contrib-boreal", kind: "money", label: "Boreal Aerospace PAC", sub: "$12,400 · Dec 11, 2025", date: "2025-12-11" },
  { id: "contrib-redwood", kind: "money", label: "Redwood Defense Technologies PAC", sub: "$7,625 · Aug 21, 2026", date: "2026-08-21" },
  { id: "contrib-meridian", kind: "money", label: "Meridian employees", sub: "$3,850 · May 19, 2025", date: "2025-05-19" },

  { id: "s456", kind: "bill", label: "S. 456 · Defense Support Act", sub: "Senate bill · introduced Feb 11, 2025", date: "2025-02-11" },
  { id: "vote-s456", kind: "vote", label: "Yes · S. 456 cloture", sub: "Senate vote · May 21, 2026", date: "2026-05-21" },
  { id: "vote-hr123", kind: "vote", label: "Yes · H.R. 123 package", sub: "Senate vote · Nov 19, 2025", date: "2025-11-19" },
  { id: "vote-oversight", kind: "vote", label: "Yes · aid oversight amendment", sub: "Senate vote · Apr 14, 2026", date: "2026-04-14" },
  { id: "vote-replenishment", kind: "vote", label: "Yes · stockpile replenishment", sub: "Senate vote · Aug 6, 2025", date: "2025-08-06" },
  { id: "vote-reporting", kind: "vote", label: "Yes · transfer reporting", sub: "Senate vote · Jun 12, 2025", date: "2025-06-12" },
  { id: "vote-export", kind: "vote", label: "No · export pause motion", sub: "Senate vote · Jun 11, 2026", date: "2026-06-11" },

  { id: "trip-kyiv", kind: "trip", label: "Kyiv delegation", sub: "Trip · Mar 12, 2026", date: "2026-03-12" },
  { id: "trip-warsaw", kind: "trip", label: "Warsaw security forum", sub: "Trip · Sep 18, 2025", date: "2025-09-18" },
  { id: "trip-brussels", kind: "trip", label: "Brussels NATO briefing", sub: "Trip · Jul 9, 2026", date: "2026-07-09" },

  { id: "voss", kind: "person", label: "Clara Voss", sub: "Meridian Public Affairs", date: "2026-06-17", initials: "CV" },
  { id: "pierce", kind: "person", label: "Nathaniel Pierce", sub: "Aegis Systems", date: "2026-06-17", initials: "NP" },
  { id: "priya-sen", kind: "person", label: "Dr. Priya Sen", sub: "Atlantic Security Institute", date: "2026-06-17", initials: "PS" },
  { id: "aegis", kind: "org", label: "Aegis Systems", sub: "Defense contractor · VA", date: "2026-04-08" },
  { id: "meridian", kind: "org", label: "Meridian Public Affairs", sub: "Lobbying firm · DC", date: "2025-05-19" },
  { id: "hr123", kind: "bill", label: "H.R. 123 · Ukraine Aid Act", sub: "House bill · introduced Jan 23, 2025", date: "2025-01-23" },
  { id: "ukraine", kind: "topic", label: "US Stance on Ukraine", sub: "Topic · foreign policy", date: "2025-01-23" },

  { id: "marquez", kind: "member", label: "Sen. Isabel Marquez", sub: "Senator · D-NM", date: "2025-03-04", initials: "IM", context: true },
  { id: "bellamy", kind: "member", label: "Sen. Thomas Bellamy", sub: "Senator · R-VA", date: "2025-03-19", initials: "TB", context: true },
  { id: "okafor", kind: "member", label: "Sen. Daniel Okafor", sub: "Senator · D-IL", date: "2025-04-08", initials: "DO", context: true },
  { id: "whitcomb", kind: "member", label: "Sen. Claire Whitcomb", sub: "Senator · R-ME", date: "2025-04-22", initials: "CW", context: true },
  { id: "kessler", kind: "member", label: "Rep. Miriam Kessler", sub: "Representative · D-PA", date: "2025-01-23", initials: "MK", context: true },
  { id: "chen", kind: "member", label: "Rep. Leah Chen", sub: "Representative · D-CA", date: "2025-02-18", initials: "LC", context: true },
];

const e = (source: string, target: string, label: string, ring: RingKind, date: string): LabEdge => ({
  id: `${source}>${target}`,
  source,
  target,
  label,
  ring,
  date,
});

export const edges: LabEdge[] = [
  e("hartley", "meeting-private", "attended", "meetings", "2026-06-17"),
  e("hartley", "meeting-meridian", "attended", "meetings", "2026-02-24"),
  e("hartley", "meeting-committee", "attended", "meetings", "2025-10-07"),
  e("hartley", "meeting-ukraine", "attended", "meetings", "2026-04-29"),
  e("hartley", "meeting-industry", "attended", "meetings", "2025-07-16"),

  e("contrib-aegis", "hartley", "contributed to", "money", "2026-04-08"),
  e("contrib-boreal", "hartley", "contributed to", "money", "2025-12-11"),
  e("contrib-redwood", "hartley", "contributed to", "money", "2026-08-21"),
  e("contrib-meridian", "hartley", "contributed to", "money", "2025-05-19"),

  e("hartley", "s456", "sponsored", "votes", "2025-02-11"),
  e("hartley", "vote-s456", "voted yes", "votes", "2026-05-21"),
  e("hartley", "vote-hr123", "voted yes", "votes", "2025-11-19"),
  e("hartley", "vote-oversight", "voted yes", "votes", "2026-04-14"),
  e("hartley", "vote-replenishment", "voted yes", "votes", "2025-08-06"),
  e("hartley", "vote-reporting", "voted yes", "votes", "2025-06-12"),
  e("hartley", "vote-export", "voted no", "votes", "2026-06-11"),

  e("hartley", "trip-kyiv", "traveled to", "trips", "2026-03-12"),
  e("hartley", "trip-warsaw", "traveled to", "trips", "2025-09-18"),
  e("hartley", "trip-brussels", "traveled to", "trips", "2026-07-09"),

  e("meeting-private", "voss", "attended by", "meetings", "2026-06-17"),
  e("meeting-private", "pierce", "attended by", "meetings", "2026-06-17"),
  e("meeting-private", "priya-sen", "attended by", "meetings", "2026-06-17"),
  e("pierce", "aegis", "works at", "ties", "2026-06-17"),
  e("aegis", "contrib-aegis", "funds", "money", "2026-04-08"),
  e("voss", "meridian", "represents", "ties", "2026-06-17"),
  e("meridian", "meeting-meridian", "briefed at", "meetings", "2026-02-24"),
  e("meridian", "contrib-meridian", "employees gave", "money", "2025-05-19"),

  e("vote-s456", "s456", "vote on", "votes", "2026-05-21"),
  e("vote-hr123", "hr123", "vote on", "votes", "2025-11-19"),
  e("s456", "ukraine", "legislation on", "ties", "2025-02-11"),
  e("hr123", "ukraine", "legislation on", "ties", "2025-01-23"),

  e("s456", "marquez", "cosponsored by", "votes", "2025-03-04"),
  e("s456", "bellamy", "cosponsored by", "votes", "2025-03-19"),
  e("s456", "okafor", "cosponsored by", "votes", "2025-04-08"),
  e("s456", "whitcomb", "cosponsored by", "votes", "2025-04-22"),
  e("hr123", "kessler", "sponsored by", "votes", "2025-01-23"),
  e("hr123", "chen", "cosponsored by", "votes", "2025-02-18"),
];

/** The focus chain, drawn in orange: Hartley, the private meeting, Nathaniel Pierce, Aegis Systems. */
export const PATH_NODES = ["hartley", "meeting-private", "pierce", "aegis"] as const;
export const PATH_EDGES = new Set(["hartley>meeting-private", "meeting-private>pierce", "pierce>aegis"]);

export const nodeById = new Map(nodes.map((n) => [n.id, n]));

/* ------------------------------------------------------------------ time */

const DAY = 86_400_000;
export const toDay = (iso: string) => Math.round(Date.parse(`${iso}T00:00:00Z`) / DAY);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Months on the clock and the histogram: Jan 2025 to Sep 2026. */
export const MONTH_COUNT = 21;
export const monthStartDay = (m: number) => toDay(`${2025 + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}-01`);
export const T0 = monthStartDay(0);
export const T1 = monthStartDay(MONTH_COUNT);
export const monthLabel = (m: number, withYear = false) =>
  `${MONTHS[m % 12]}${withYear || m % 12 === 0 ? ` ${2025 + Math.floor(m / 12)}` : ""}`;
export const monthOf = (day: number) => {
  for (let m = MONTH_COUNT - 1; m >= 0; m--) if (day >= monthStartDay(m)) return m;
  return 0;
};
export function dayLabel(day: number): string {
  const d = new Date(day * DAY);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** The clock: 12 o'clock is the far side; time runs clockwise over 330 degrees. */
const SWEEP = (330 * Math.PI) / 180;
const START = -Math.PI / 2 + (15 * Math.PI) / 180;
export const angleOfDay = (day: number) => START + ((day - T0) / (T1 - T0)) * SWEEP;

/** Records counted by month (one per dated edge into a record). */
export function histogram(): number[] {
  const counts = new Array<number>(MONTH_COUNT).fill(0);
  for (const ed of edges) counts[monthOf(toDay(ed.date))]++;
  return counts;
}

/* ---------------------------------------------------------------- layout */

export const RINGS: { kind: RingKind; label: string; radius: number }[] = [
  { kind: "meetings", label: "Meetings", radius: 2.8 },
  { kind: "money", label: "Money", radius: 3.9 },
  { kind: "votes", label: "Votes and bills", radius: 5.1 },
  { kind: "trips", label: "Trips", radius: 6.3 },
  { kind: "ties", label: "Ties", radius: 7.5 },
];
export const ringRadius = (k: RingKind) => RINGS.find((r) => r.kind === k)!.radius;
const CONTEXT_RADIUS = 9.6;
const LIFT = 1.35;

export interface Placed {
  x: number;
  y: number;
  z: number;
  depth: number;
  ring?: RingKind;
  /** Hop count is 0..2 and the node is not a context member. */
  near: boolean;
}

export interface Layout {
  focus: string;
  pos: Map<string, Placed>;
  /** Ring kind and number of records on it, for this focus. */
  rings: Map<RingKind, number>;
}

const adjacency = (() => {
  const adj = new Map<string, LabEdge[]>();
  for (const ed of edges) {
    for (const id of [ed.source, ed.target]) {
      if (!adj.has(id)) adj.set(id, []);
      adj.get(id)!.push(ed);
    }
  }
  return adj;
})();
export const edgesOf = (id: string) => adjacency.get(id) ?? [];
const other = (ed: LabEdge, id: string) => (ed.source === id ? ed.target : ed.source);

/** Spread angles on one ring so neighbors keep a minimum arc gap. Keeps the order. */
function spread(items: { id: string; a: number }[], minGap: number) {
  items.sort((p, q) => p.a - q.a || p.id.localeCompare(q.id));
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 1; i < items.length; i++) {
      const gap = items[i].a - items[i - 1].a;
      if (gap < minGap) {
        const push = (minGap - gap) / 2;
        items[i - 1].a -= push;
        items[i].a += push;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

const layoutCache = new Map<string, Layout>();

/** The deterministic layout with one node at the center. */
export function layoutFor(focus: string): Layout {
  const cached = layoutCache.get(focus);
  if (cached) return cached;
  const pos = new Map<string, Placed>();
  const rings = new Map<RingKind, number>();
  pos.set(focus, { x: 0, y: 0, z: 0, depth: 0, near: true });

  // Hop 1: on the ring of the edge type, at the angle of the edge date.
  const byRing = new Map<RingKind, { id: string; a: number }[]>();
  const hop1 = new Set<string>();
  for (const ed of edgesOf(focus)) {
    const id = other(ed, focus);
    if (hop1.has(id) || nodeById.get(id)?.context) continue;
    hop1.add(id);
    const list = byRing.get(ed.ring) ?? [];
    list.push({ id, a: angleOfDay(toDay(ed.date)) });
    byRing.set(ed.ring, list);
  }
  for (const [ring, items] of byRing) {
    const r = ringRadius(ring);
    // A small neighborhood often shares one date: give it room, still in date order.
    spread(items, Math.max(1.25 / r, items.length <= 6 ? 0.62 : 0));
    rings.set(ring, items.length);
    for (const it of items) pos.set(it.id, { x: r * Math.cos(it.a), y: 0, z: r * Math.sin(it.a), depth: 1, ring, near: true });
  }

  // Hop 2: lifted above the parent record, fanned along the ring.
  const children = new Map<string, string[]>();
  const hop1Sorted = [...hop1].sort();
  for (const pid of hop1Sorted) {
    for (const ed of edgesOf(pid)) {
      const id = other(ed, pid);
      if (pos.has(id) || nodeById.get(id)?.context || [...children.values()].some((c) => c.includes(id))) continue;
      children.set(pid, [...(children.get(pid) ?? []), id]);
    }
  }
  for (const [pid, kids] of children) {
    if (kids.length > 6) continue;
    const p = pos.get(pid)!;
    const r = Math.hypot(p.x, p.z) + 0.35;
    const a0 = Math.atan2(p.z, p.x);
    const step = 1.15 / r;
    kids.sort();
    kids.forEach((id, i) => {
      const a = a0 + (i - (kids.length - 1) / 2) * step;
      pos.set(id, { x: r * Math.cos(a), y: LIFT + (kids.length > 1 ? (i % 2) * 0.35 : 0), z: r * Math.sin(a), depth: 2, near: true });
    });
  }

  // Everything else: the faint outer band, at the angle of its own date.
  const rest = nodes.filter((n) => !pos.has(n.id)).map((n) => ({ id: n.id, a: angleOfDay(toDay(n.date)) }));
  spread(rest, 0.7 / CONTEXT_RADIUS);
  rest.forEach((it, i) => {
    const r = CONTEXT_RADIUS + (i % 3) * 0.55;
    pos.set(it.id, { x: r * Math.cos(it.a), y: -0.2, z: r * Math.sin(it.a), depth: 3, near: false });
  });

  const layout = { focus, pos, rings };
  layoutCache.set(focus, layout);
  return layout;
}
