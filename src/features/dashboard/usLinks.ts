import { entities } from "@/data/entities";
import { stateByCode } from "@/data/geo";
import { sources } from "@/data/sources";
import type { SourceDoc } from "@/data/types";

/**
 * Connections on the United States map: a public record that links an origin (an org's
 * home state, or DC for lobbying and FARA) to a member's state.
 */
export interface UsArc {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  /** "money": FEC (teal-bright). "contact": LDA and FARA (text-2). */
  tone: "money" | "contact";
  /** Faint static arcs show the most recent records between live events. */
  faint: boolean;
  /** Drawn by presenter mode in the vote view. */
  forced?: boolean;
  /** Drawn solid (no moving dash): the money flows, which are standing records. */
  solid?: boolean;
  /** "Aegis Systems PAC → Sen. Ellen Hartley · $18,750" */
  label: string;
  to: string;
}

const byId = new Map(entities.map((e) => [e.id, e]));
const stateOf = (sublabel?: string) => sublabel?.split("-")[1];

export function usArcFor(src: SourceDoc, faint: boolean, key: string | number = 0, originState?: string): UsArc | null {
  const from = (originState ?? src.geo?.from) ? stateByCode[(originState ?? src.geo?.from)!] : undefined;
  const to = src.geo?.to ? stateByCode[src.geo.to] : undefined;
  if (!from || !to) return null;
  const subjects = (src.subjectIds ?? []).map((id) => byId.get(id)).filter((e) => !!e);
  const org = subjects.find((e) => e.type === "org" && e.hqState === src.geo?.from) ?? subjects.find((e) => e.type === "org");
  const person = subjects.find((e) => e.type === "person" && stateOf(e.sublabel) === src.geo?.to) ?? subjects.find((e) => e.type === "person");
  const amount = src.kind === "FEC" ? src.excerpt.match(/\$[\d,]+/)?.[0] : undefined;
  const fromName = org ? `${org.label}${src.kind === "FEC" ? " PAC" : ""}` : from.name;
  const toName = person?.label ?? to.name;
  return {
    id: `us-${src.id}-${key}`,
    startLat: from.lat,
    startLng: from.lng,
    endLat: to.lat,
    endLng: to.lng,
    tone: src.kind === "FEC" ? "money" : "contact",
    faint,
    label: `${fromName} → ${toName}${amount ? ` · ${amount}` : ""}`,
    to: to.code,
  };
}

/** The three most recent connections in the data, shown faint so the map is never empty. */
export const RECENT_US_ARCS: UsArc[] = [...sources]
  .filter((s) => s.geo?.from && s.geo?.to && s.geo.from !== s.geo.to)
  .sort((a, b) => b.date.localeCompare(a.date))
  .slice(0, 3)
  .map((s) => usArcFor(s, true, "static"))
  .filter((a): a is UsArc => !!a);

export function sourceById(id?: string): SourceDoc | undefined {
  return id ? sources.find((s) => s.id === id) : undefined;
}

/**
 * Money flows for the Defense Industrial Base topic: FEC and LDA records that involve a
 * defense contractor, drawn from the contractor's home state to the member's state.
 */
export const MONEY_US_ARCS: UsArc[] = sources
  .filter((s) => (s.kind === "FEC" || s.kind === "LDA") && s.geo?.from && s.geo?.to)
  .map((s): UsArc | null => {
    const contractor = (s.subjectIds ?? []).map((id) => byId.get(id)).find((e) => e?.type === "org" && /contractor/i.test(e.sublabel ?? ""));
    if (!contractor?.hqState || contractor.hqState === s.geo?.to) return null;
    const arc = usArcFor(s, false, "money", contractor.hqState);
    if (!arc) return null;
    const amount = s.kind === "FEC" ? s.excerpt.match(/\$[\d,]+/)?.[0] : undefined;
    const person = arc.label.split(" → ")[1]?.split(" · ")[0];
    return {
      ...arc,
      solid: true,
      label: `${contractor.label}${s.kind === "LDA" ? " (lobbying)" : ""} → ${person ?? s.geo?.to}${amount ? ` · ${amount}` : ""}`,
    };
  })
  .filter((a): a is UsArc => !!a);
