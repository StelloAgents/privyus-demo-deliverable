import { catalog } from "@/features/explore/catalog";
import { sources as dataSources } from "@/data/sources";
import type { Entity, SourceDoc, SourceKind } from "@/lib/types";

export type SearchGroup =
  "People" | "Bills" | "Organizations" | "Topics" | "Filings";
export const GROUP_ORDER: SearchGroup[] = [
  "People",
  "Bills",
  "Organizations",
  "Topics",
  "Filings",
];

/** Short tag for a source kind, as shown on filing rows. */
export const KIND_TAG: Record<SourceKind, string> = {
  LDA: "LDA",
  FARA: "FARA",
  FEC: "FEC",
  CONGRESS: "Congress",
  DISCLOSURE: "Disclosure",
  TRAVEL: "Travel",
  STATEMENT: "Statement",
};

export interface SearchEntry {
  id: string;
  entity: Entity;
  group: SearchGroup;
  label: string;
  /** Party-state, bill title, or org type. */
  sublabel: string;
  href: string;
}

const GROUP_OF: Partial<Record<Entity["type"], SearchGroup>> = {
  person: "People",
  bill: "Bills",
  org: "Organizations",
  topic: "Topics",
};

function sublabelOf(e: Entity): string {
  if (e.type === "person") {
    if (/^Sen\./.test(e.label)) return `Senator · ${e.sublabel ?? ""}`;
    if (/^Rep\./.test(e.label)) return `Representative · ${e.sublabel ?? ""}`;
    return e.sublabel ?? "Contact";
  }
  return e.sublabel ?? "";
}

/** Every record, with the entity ids it concerns. */
type Record_ = SourceDoc & { subjectIds?: string[] };
const SOURCES: Record_[] = dataSources;

export const ENTRIES: SearchEntry[] = Object.values(catalog.entities)
  .filter((e) => GROUP_OF[e.type])
  .map((e) => ({
    id: e.id,
    entity: e,
    group: GROUP_OF[e.type]!,
    label: e.label,
    sublabel: sublabelOf(e),
    href: `/explore?entity=${encodeURIComponent(e.id)}`,
  }));

const compact = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export type SearchHit =
  | {
      kind: "entity";
      entry: SearchEntry;
      score: number;
      ranges: [number, number][];
    }
  | {
      kind: "filing";
      source: SourceDoc;
      score: number;
      ranges: [number, number][];
      subject?: string;
    };

export function hitGroup(h: SearchHit): SearchGroup {
  return h.kind === "entity" ? h.entry.group : "Filings";
}

function matchText(
  text: string,
  words: string[],
  cq: string,
  extra = "",
): { score: number; ranges: [number, number][] } | null {
  const label = text.toLowerCase();
  const sub = extra.toLowerCase();
  const labelWords = label.split(/[\s·.,:()-]+/).filter(Boolean);
  let score = 0;
  const ranges: [number, number][] = [];
  for (const w of words) {
    const at = label.indexOf(w);
    if (labelWords.some((lw) => lw.startsWith(w.replace(/[.]/g, ""))))
      score += 60;
    else if (at >= 0) score += 30;
    else if (sub.includes(w)) score += 10;
    else if (cq.length >= 3 && compact(label).includes(cq)) score += 25;
    else return null;
    if (at >= 0) ranges.push([at, at + w.length]);
  }
  return { score, ranges: mergeRanges(ranges) };
}

/** The typeahead: entities and filings that match every word, grouped. */
export function search(query: string, perGroup = 4): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const cq = compact(q);
  const hits: SearchHit[] = [];
  for (const entry of ENTRIES) {
    const m = matchText(entry.label, words, cq, entry.sublabel);
    if (!m) continue;
    const label = entry.label.toLowerCase();
    const bonus =
      label.startsWith(q) ||
      label.replace(/^(sen|rep|dr)\.\s+/, "").startsWith(q)
        ? 40
        : 0;
    hits.push({
      kind: "entity",
      entry,
      score: m.score + bonus,
      ranges: m.ranges,
    });
  }
  for (const source of SOURCES) {
    const m = matchText(source.title, words, cq, KIND_TAG[source.kind]);
    if (m) {
      hits.push({ kind: "filing", source, score: m.score, ranges: m.ranges });
      continue;
    }
    // A record about a matching person, bill, or organization.
    const subject = (source.subjectIds ?? [])
      .map((id) => catalog.entities[id])
      .find((e) => e && matchText(e.label, words, cq));
    if (subject) {
      hits.push({
        kind: "filing",
        source,
        score: 20 + Number(source.date.replace(/-/g, "")) / 1e9,
        ranges: [],
        subject: subject.label,
      });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const out: SearchHit[] = [];
  for (const g of GROUP_ORDER)
    out.push(
      ...hits
        .filter((h) => hitGroup(h) === g)
        .slice(0, g === "Filings" ? 3 : perGroup),
    );
  return out;
}

function mergeRanges(r: [number, number][]): [number, number][] {
  const sorted = r.slice().sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const [s, e] of sorted) {
    const last = out[out.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Empty-state content                                                 */
/* ------------------------------------------------------------------ */

/** Fixed recent searches. Each one opens a state the graph can show. */
export const RECENT: {
  label: string;
  href: string;
  when: string;
  entityId?: string;
}[] = [
  {
    label: "Sen. Ellen Hartley",
    href: "/explore?entity=hartley",
    when: "2 hours ago",
    entityId: "hartley",
  },
  {
    label: "Meridian Public Affairs",
    href: "/explore?entity=meridian",
    when: "Yesterday",
    entityId: "meridian",
  },
  {
    label: "S. 456 · Defense Support Act",
    href: "/explore?entity=s456",
    when: "3 days ago",
    entityId: "s456",
  },
];

/** "Try asking": questions that map to script turns. */
export const TRY_ASKING = [
  "What is the United States' stance on Ukraine?",
  "Which defense contractors gave to Hartley?",
  "Which lobbying firm met Hartley?",
];

export function askHref(q: string): string {
  return `/explore?q=${encodeURIComponent(q.trim())}`;
}

/** "Sep 2, 2026" */
export function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
