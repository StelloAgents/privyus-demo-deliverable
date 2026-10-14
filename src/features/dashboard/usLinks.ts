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
  /** "RTX PAC → Sen. Richard Blumenthal · $2,000" */
  label: string;
  to: string;
}

const byId = new Map(entities.map((e) => [e.id, e]));
const stateOf = (sublabel?: string) => sublabel?.split("-")[1];

/** The sum of the PAC totals in an FEC record's excerpt ("$10,000"), or undefined. */
function fecTotal(src: SourceDoc): string | undefined {
  const amounts = [...src.excerpt.matchAll(/\$([\d,]+)/g)].map((m) => Number(m[1].replace(/,/g, "")));
  if (!amounts.length) return undefined;
  return `$${amounts.reduce((a, b) => a + b, 0).toLocaleString("en-US")}`;
}

export function usArcFor(src: SourceDoc, faint: boolean, key: string | number = 0, originState?: string): UsArc | null {
  const from = (originState ?? src.geo?.from) ? stateByCode[(originState ?? src.geo?.from)!] : undefined;
  const to = src.geo?.to ? stateByCode[src.geo.to] : undefined;
  if (!from || !to) return null;
  const subjects = (src.subjectIds ?? []).map((id) => byId.get(id)).filter((e) => !!e);
  const org = subjects.find((e) => e.type === "org" && e.hqState === src.geo?.from) ?? subjects.find((e) => e.type === "org");
  const person = subjects.find((e) => e.type === "person" && stateOf(e.sublabel) === src.geo?.to) ?? subjects.find((e) => e.type === "person");
  const pacs = subjects.filter((e) => e.type === "org" && /PAC/.test(e.sublabel ?? ""));
  const amount = src.kind === "FEC" ? fecTotal(src) : undefined;
  const fromName = src.kind === "FEC" && pacs.length > 1 ? `${pacs.length} defense PACs` : (org?.label ?? from.name);
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
 * Money flows for the Defense PAC Giving topic: the 2023-24 FEC records of defense
 * company PAC transfers, drawn from the PACs' filing state (all five file from Virginia)
 * to the senator's state. Senators from the filing state draw no arc.
 */
export const MONEY_US_ARCS: UsArc[] = sources
  .filter((s) => s.kind === "FEC" && s.id.endsWith("-2024") && s.geo?.from && s.geo?.to && s.geo.from !== s.geo.to)
  .map((s): UsArc | null => {
    const arc = usArcFor(s, false, "money");
    return arc ? { ...arc, solid: true, label: `${arc.label}, 2023-24` } : null;
  })
  .filter((a): a is UsArc => !!a);
