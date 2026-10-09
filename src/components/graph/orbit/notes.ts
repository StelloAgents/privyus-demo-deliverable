import type { GraphNoteSpec } from "@/data/graph-notes";
import type { Catalog } from "@/lib/types";
import { monthOfDay, monthStart, toDay } from "../orbit-layout";
import type { ViewNode } from "./model";

/**
 * What the orbit graph marks for the answer on screen: the one note, the dial
 * labels and the stretch of the dial the answer needs, a thin marker line
 * through the records the note links, and date chips. A pure function of the
 * view and the note specs (src/data/graph-notes.ts).
 */
export interface OrbitNote {
  id: string;
  text: string;
  /** Next to a node, or at a day on the dial (outside the rings). */
  anchor: { node: string } | { day: number };
}

export interface OrbitMarks {
  note?: OrbitNote;
  /** Dial labels: the text at the angle of `day`. */
  dial: { key: string; day: number; text: string }[];
  /** A stretch of the dial, in days [start, end]. */
  arc?: [number, number];
  /** A thin line through these nodes, in order. */
  marker: string[];
  /** Date chips next to nodes. */
  chips: { node: string; text: string }[];
  /** Records the note is about: they draw at full strength. */
  emphasis: Set<string>;
  /** Nodes whose name shows for the note. */
  named: Set<string>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ymd = (day: number) => {
  const d = new Date(day * 86_400_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() };
};

/** "Apr 2026". */
export const monthLabel = (day: number) => `${MONTHS[ymd(day).m]} ${ymd(day).y}`;
/** "Apr 8, 2026". */
export const dateLabel = (day: number) => `${MONTHS[ymd(day).m]} ${ymd(day).d}, ${ymd(day).y}`;
/** "March" and "June 2025" for a span (the year once, unless the span crosses one). */
function spanWords(a: number, b: number): { start: string; end: string } {
  const p = ymd(a);
  const q = ymd(b);
  return { start: p.y === q.y ? MONTHS_LONG[p.m] : `${MONTHS_LONG[p.m]} ${p.y}`, end: `${MONTHS_LONG[q.m]} ${q.y}` };
}

function fill(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? `{${k}}`));
}

/**
 * The busiest run of `months` calendar months in `days`: its first month, and
 * how many days fall in it. Undefined when two runs tie.
 */
export function busiestStretch(days: number[], months: number): { m0: number; count: number } | undefined {
  if (!days.length) return undefined;
  const ms = days.map(monthOfDay);
  const lo = Math.min(...ms);
  const hi = Math.max(...ms);
  let best: { m0: number; count: number } | undefined;
  let tie = false;
  for (let m0 = lo; m0 + months - 1 <= Math.max(hi, lo + months - 1); m0++) {
    const count = ms.filter((m) => m >= m0 && m < m0 + months).length;
    if (!best || count > best.count) {
      best = { m0, count };
      tie = false;
    } else if (count === best.count) tie = true;
  }
  return tie ? undefined : best;
}

/** The record end of an edge (the end that is not a category). */
function recordOf(catalog: Catalog, edgeId: string): { id: string; day?: number } | undefined {
  const e = catalog.edges[edgeId];
  if (!e) return undefined;
  const id = catalog.entities[e.source]?.type === "category" ? e.target : e.source;
  return { id, day: e.date ? toDay(e.date) : undefined };
}

const mid = (a: number, b: number) => (a + b) / 2;

export function resolveMarks(
  catalog: Catalog,
  view: { focusId?: string; centerId?: string; nodes: ViewNode[]; byId: Map<string, ViewNode>; anchoredRings: Set<string> },
  specs: GraphNoteSpec[],
): OrbitMarks {
  const out: OrbitMarks = { dial: [], marker: [], chips: [], emphasis: new Set(), named: new Set() };
  const on = (id: string) => {
    const n = view.byId.get(id);
    return !!n && n.tier !== "hidden" && n.tier !== "ghost" && n.tier !== "anchor" && n.tier !== "faint";
  };
  const ringRecords = (pred: (n: ViewNode) => boolean) => view.nodes.filter((n) => n.day !== undefined && (n.tier === "full" || n.tier === "dim" || n.tier === "hint") && n.ring && pred(n));
  let dialDone = false;

  for (const spec of specs) {
    if (spec.focus !== view.focusId) continue;
    if (spec.kind === "span") {
      const recs = ringRecords((n) => n.ring === spec.ring && n.tier === "full");
      if (recs.length < 2) continue;
      const days = recs.map((n) => n.day!);
      const a = Math.min(...days);
      const b = Math.max(...days);
      out.note = { id: spec.id, text: fill(spec.text, spanWords(a, b)), anchor: { day: mid(a, b) } };
      out.arc = [a, b];
      out.dial = [
        { key: "s", day: a, text: monthLabel(a) },
        { key: "e", day: b, text: monthLabel(b) },
      ];
      dialDone = true;
      break;
    }
    if (spec.kind === "stretch") {
      if (view.centerId !== spec.focus) continue;
      // The center person's records (the counts on the ring labels).
      const recs = ringRecords((n) => !!n.category && view.anchoredRings.has(n.ring!));
      const s = busiestStretch(
        recs.map((n) => n.day!),
        spec.months,
      );
      if (!s || s.count / recs.length < spec.minShare) continue;
      const a = monthStart(s.m0);
      const b = monthStart(s.m0 + spec.months);
      const last = monthStart(s.m0 + spec.months - 1);
      out.note = { id: spec.id, text: fill(spec.text, { count: s.count, total: recs.length, ...spanWords(a, last) }), anchor: { day: mid(a, b) } };
      out.arc = [a, b - 1];
      out.dial = [
        { key: "s", day: a + 14, text: monthLabel(a) },
        { key: "e", day: last + 14, text: monthLabel(last) },
      ];
      for (const n of recs) if (monthOfDay(n.day!) >= s.m0 && monthOfDay(n.day!) < s.m0 + spec.months) out.emphasis.add(n.id);
      dialDone = true;
      break;
    }
    if (spec.kind === "link") {
      if (!on(spec.from) || !on(spec.to)) continue;
      out.note = { id: spec.id, text: spec.text, anchor: { node: spec.to } };
      // The marker runs from the record that names the link, through it, to the person whose record holds it.
      const e = catalog.edges[spec.edge];
      const category = e ? catalog.entities[e.source === spec.to ? e.target : e.source] : undefined;
      const holder = category?.type === "category" ? category.categoryOf : undefined;
      out.marker = holder && on(holder) ? [spec.from, spec.to, holder] : [spec.from, spec.to];
      out.named.add(spec.to);
      out.emphasis.add(spec.to);
      break;
    }
    if (spec.kind === "timing") {
      const pts = spec.points.map((p) => ({ ...recordOf(catalog, p.edge), label: p.label }));
      if (pts.some((p) => !p.id || p.day === undefined || !on(p.id))) continue;
      pts.sort((p, q) => p.day! - q.day!);
      const a = pts[0].day!;
      const b = pts[pts.length - 1].day!;
      out.note = { id: spec.id, text: fill(spec.text, { weeks: Math.ceil((b - a) / 7) }), anchor: { day: mid(a, b) } };
      out.marker = pts.map((p) => p.id!);
      out.chips = pts.map((p) => ({ node: p.id!, text: p.label ? `${p.label} · ${dateLabel(p.day!)}` : dateLabel(p.day!) }));
      for (const p of pts) out.emphasis.add(p.id!);
      out.arc = [a, b];
      dialDone = true;
      break;
    }
  }

  // Without a note that marks the dial: label the months of the records the answer is about
  // (the records at full strength on the rings), the first and the last.
  if (!dialDone) {
    const days = ringRecords((n) => n.tier === "full").map((n) => n.day!);
    if (days.length) {
      const a = Math.min(...days);
      const b = Math.max(...days);
      out.dial.push({ key: "s", day: a, text: monthLabel(a) });
      if (monthOfDay(b) !== monthOfDay(a)) out.dial.push({ key: "e", day: b, text: monthLabel(b) });
    }
  }
  return out;
}
