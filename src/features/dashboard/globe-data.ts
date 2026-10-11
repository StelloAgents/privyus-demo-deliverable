import { edges, entities } from "@/data/entities";
import { sources } from "@/data/sources";
import type { SourceDoc, SourceKind } from "@/data/types";
import { fullDate } from "./format";
import { exploreEntityHref } from "./links";

/** Presentation constants: where the places in the demo data sit on the globe. */
export const PLACES = {
  Washington: { lat: 38.9, lng: -77.04 },
  Munich: { lat: 48.14, lng: 11.58 },
  Vilnius: { lat: 54.69, lng: 25.28 },
  /** The FARA principal's country (the records name the country, not a city); drawn at Kyiv. */
  Ukraine: { lat: 50.45, lng: 30.52 },
} as const;
export type PlaceName = keyof typeof PLACES;

const REGISTRANT = "Moran Global Strategies";
const UA_PRINCIPAL = "The Ministry for Strategic Industries of Ukraine";

/**
 * Which place a travel or contact record refers to. `inbound`: a FARA contact, drawn from the
 * principal's country to Washington. The record reports a contact; it does not say where it took place.
 */
const PLACE_MATCH: { re: RegExp; place: PlaceName; inbound?: boolean }[] = [
  { re: /^ukraine ·/i, place: "Ukraine", inbound: true },
  { re: /munich/i, place: "Munich" },
  { re: /vilnius/i, place: "Vilnius" },
];

export interface GlobeArc {
  id: string;
  from: PlaceName;
  to: PlaceName;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  /** "Sen. Roger Wicker → Munich · Feb 2025" */
  tooltip: string;
  date: string;
  /** The single most recent record: the one orange arc. */
  latest: boolean;
  href: string;
  /** For the "Recent movements" list. */
  row: {
    /** "Sen. Roger Wicker" */
    title: string;
    /** "To Brussels · Jul 9, 2026" */
    detail: string;
    /** "NATO briefing" (in the row tooltip) */
    what: string;
    /** Initials of the lead person; none for a foreign delegation. */
    initials?: string;
    sourceKind: SourceKind;
    /** The record behind the arc, for the detail card. */
    sourceTitle: string;
    /** The lead person, for "Open in Explore". */
    personId?: string;
    personLabel: string;
  };
}

export interface GlobePlace {
  name: PlaceName;
  lat: number;
  lng: number;
  /** The arcs that touch this place. */
  arcIds: string[];
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** The story turn that shows each category, so a click opens the matching state. */
const TURN_FOR_CATEGORY: Record<string, string> = {
  Trips: "wicker-profile",
  Contacts: "wicker-contacts",
};

/**
 * Arcs from Washington to every travel record, and from the principal's country to Washington
 * for every FARA contact, built from the entities and edges in src/data.
 */
function buildArcs(): GlobeArc[] {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const out: Omit<GlobeArc, "latest">[] = [];
  for (const edge of edges) {
    const category = byId.get(edge.source);
    const detail = byId.get(edge.target);
    if (!category || !detail || category.type !== "category" || detail.type !== "detail") continue;
    const turn = TURN_FOR_CATEGORY[category.label];
    if (!turn || !edge.date) continue;
    const match = PLACE_MATCH.find((m) => m.re.test(detail.label));
    if (!match) continue;
    const person = category.categoryOf ? byId.get(category.categoryOf)?.label : undefined;
    const from: PlaceName = match.inbound ? match.place : "Washington";
    const to: PlaceName = match.inbound ? "Washington" : match.place;
    const who = match.inbound ? `FARA: ${REGISTRANT} (for ${UA_PRINCIPAL}) → ${person ?? "Congress"}` : `${person ?? "Delegation"} → ${match.place}`;
    const focus = category.label === "Trips" ? category.id : detail.id;
    const lead = category.categoryOf ? byId.get(category.categoryOf) : undefined;
    const src = sources.find((x) => x.id === edge.sourceIds[0]);
    const what = match.inbound ? "FARA contact for a foreign principal" : cap(detail.label.replace(match.re, "").trim()) || "Trip";
    out.push({
      id: edge.id,
      from,
      to,
      startLat: PLACES[from].lat,
      startLng: PLACES[from].lng,
      endLat: PLACES[to].lat,
      endLng: PLACES[to].lng,
      tooltip: `${who} · ${monthYear(edge.date)}`,
      date: edge.date,
      href: exploreEntityHref(focus),
      row: {
        title: match.inbound ? `${person ?? "Washington"} · FARA contact` : (person ?? "Delegation"),
        detail: match.inbound ? `Reported contact · ${fullDate(edge.date)}` : `To ${match.place} · ${fullDate(edge.date)}`,
        what,
        initials: match.inbound ? undefined : lead?.initials,
        sourceKind: src?.kind ?? "DISCLOSURE",
        sourceTitle: src?.title ?? detail.label,
        personId: lead?.id,
        personLabel: lead?.label ?? detail.label,
      },
    });
  }
  const latest = out.reduce((a, b) => (b.date > a ? b.date : a), "");
  return out.map((a) => ({ ...a, latest: a.date === latest }));
}

export const GLOBE_ARCS = buildArcs();

/**
 * An arc for a travel disclosure, from Washington to the first city it names.
 * Returns null when the record names no known city.
 */
export function travelArc(src: SourceDoc): GlobeArc | null {
  if (src.kind !== "TRAVEL") return null;
  const text = `${src.title} ${src.excerpt}`;
  const match = PLACE_MATCH.filter((m) => !m.inbound).find((m) => m.re.test(text));
  if (!match) return null;
  const people = (src.subjectIds ?? []).map((id) => byIdAll.get(id)).filter((e) => e?.type === "person");
  const first = people[0];
  const who = first ? `${first.label}${people.length > 1 ? ` and ${people.length - 1} more` : ""}` : "Delegation";
  return {
    id: `live-${src.id}`,
    from: "Washington",
    to: match.place,
    startLat: PLACES.Washington.lat,
    startLng: PLACES.Washington.lng,
    endLat: PLACES[match.place].lat,
    endLng: PLACES[match.place].lng,
    tooltip: `${who} → ${match.place} · ${monthYear(src.date)}`,
    date: src.date,
    latest: false,
    href: exploreEntityHref(first?.id),
    row: {
      title: `${first ? first.label : "Delegation"}${people.length > 1 ? ` +${people.length - 1}` : ""}`,
      detail: `To ${match.place} · ${fullDate(src.date)}`,
      what: src.title.split(/\s+·\s+/)[0],
      initials: first?.initials,
      sourceKind: src.kind,
      sourceTitle: src.title,
      personId: first?.id,
      personLabel: first ? `${first.label}${people.length > 1 ? ` and ${people.length - 1} more` : ""}` : "Delegation",
    },
  };
}

const byIdAll = new Map(entities.map((e) => [e.id, e]));

/** The cities that the given arcs touch. */
export function placesFor(arcs: GlobeArc[]): GlobePlace[] {
  return (Object.keys(PLACES) as PlaceName[])
    .map((name) => ({
      name,
      ...PLACES[name],
      arcIds: arcs.filter((a) => a.from === name || a.to === name).map((a) => a.id),
    }))
    .filter((p) => p.arcIds.length > 0);
}

export const GLOBE_PLACES: GlobePlace[] = placesFor(GLOBE_ARCS);

/** The view center: the band from the US East Coast to Eastern Europe. */
export const VIEW_CENTER = { lat: 44, lng: -24 };

/**
 * FARA contacts on the world map: an arc from the foreign principal's country to the member's
 * office. The arc marks a reported contact by the registrant (Alexandria, VA), not a visit:
 * the records do not say anyone came to Washington.
 */
const FARA_ORIGIN: Record<string, { place: PlaceName; principal: string }> = {
  "-ua-": { place: "Ukraine", principal: UA_PRINCIPAL },
};

export const FARA_ARCS: GlobeArc[] = sources
  .filter((src) => src.kind === "FARA")
  .map((src) => {
    const key = Object.keys(FARA_ORIGIN).find((k) => src.id.includes(k));
    if (!key) return null;
    const o = FARA_ORIGIN[key];
    const people = (src.subjectIds ?? []).map((id) => byIdAll.get(id)).filter((e) => e?.type === "person");
    const first = people[0];
    const arc: GlobeArc = {
      id: `fara-${src.id}`,
      from: o.place,
      to: "Washington",
      startLat: PLACES[o.place].lat,
      startLng: PLACES[o.place].lng,
      endLat: PLACES.Washington.lat,
      endLng: PLACES.Washington.lng,
      tooltip: `FARA: ${REGISTRANT} (for ${o.principal}) → ${first ? first.label : "Congress"} · ${monthYear(src.date)}`,
      date: src.date,
      latest: false,
      href: exploreEntityHref(first?.id),
      row: {
        title: o.principal,
        detail: `Reported contact · ${fullDate(src.date)}`,
        what: "FARA filing",
        initials: first?.initials,
        sourceKind: src.kind,
        sourceTitle: src.title,
        personId: first?.id,
        personLabel: `${o.principal} (FARA principal)`,
      },
    };
    return arc;
  })
  .filter((a): a is GlobeArc => !!a)
  // One arc per person (the first contact): the firm lists some people on many dates.
  .filter((a, i, all) => all.findIndex((b) => b.row.personId === a.row.personId) === i);
