import { dashboard } from "@/data/dashboard";
import { entities } from "@/data/entities";
import { sources } from "@/data/sources";
import type { SourceDoc } from "@/data/types";

/**
 * Record trends for the Radar card: the running count of public records on file,
 * one point per day that added a record, ending at the newest record of the topic.
 */
const DAY = 86400000;
const toMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export interface TrendPoint {
  date: string;
  value: number;
  /** True for a day that added records (gets a marker). */
  record: boolean;
}

export interface Trend {
  points: TrendPoint[];
  start: string;
  end: string;
  /** Records added inside the window. */
  added: number;
  /** "Last 30 days" or a wider window when the topic has few recent records. */
  label: string;
}

function buildTrend(all: string[]): Trend {
  const dates = all.map((d) => d.slice(0, 10)).sort();
  const end = dates[dates.length - 1];
  // Try 30 days; widen when the topic has too few recent records for a line.
  for (const [days, label] of [
    [30, "Last 30 days"],
    [90, "Last 90 days"],
    [365, "Last 12 months"],
  ] as const) {
    const start = toIso(toMs(end) - days * DAY);
    const before = dates.filter((d) => d < start).length;
    const inWindow = dates.filter((d) => d >= start);
    const uniq = [...new Set(inWindow)];
    if (uniq.length < 3 && days < 365) continue;
    let total = before;
    const points = uniq.map((d) => {
      total += inWindow.filter((x) => x === d).length;
      return { date: d, value: total, record: true };
    });
    return { points, start: points[0].date, end, added: inWindow.length, label };
  }
  throw new Error("unreachable");
}

const byId = new Map(entities.map((e) => [e.id, e]));
const isContractorRecord = (s: SourceDoc) =>
  (s.subjectIds ?? []).some((id) => byId.get(id)?.type === "org" && /contractor/i.test(byId.get(id)?.sublabel ?? ""));

/** The records behind each Radar topic (same order as the Radar topics). */
export const TOPIC_RECORDS: ((s: SourceDoc) => boolean)[] = [
  () => true,
  (s) => (s.kind === "FEC" || s.kind === "LDA" || s.kind === "DISCLOSURE") && isContractorRecord(s),
  (s) => s.kind === "TRAVEL" || s.kind === "FARA" || s.kind === "STATEMENT",
];

export const TRENDS: Trend[] = TOPIC_RECORDS.map((match, i) =>
  buildTrend([
    ...sources.filter(match).map((s) => s.date),
    // The Ukraine overview also counts the activity feed.
    ...(i === 0 ? dashboard.activity.map((a) => a.date) : []),
  ]),
);
