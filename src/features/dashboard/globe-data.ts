import { edges, entities } from "@/data/entities";
import { sources } from "@/data/sources";
import type { SourceDoc, SourceKind } from "@/data/types";
import { fullDate } from "./format";
import { exploreEntityHref } from "./links";

/** Presentation constants: where the places in the demo data sit on the globe. */
export const PLACES = {
  Washington: { lat: 38.9, lng: -77.04 },
  Kyiv: { lat: 50.45, lng: 30.52 },
  Warsaw: { lat: 52.23, lng: 21.01 },
  Brussels: { lat: 50.85, lng: 4.35 },
  Tallinn: { lat: 59.44, lng: 24.75 },
  Odesa: { lat: 46.48, lng: 30.72 },
} as const;
export type PlaceName = keyof typeof PLACES;

/** Which place a travel or meeting record refers to. `inbound`: the visitors came to Washington. */
const PLACE_MATCH: { re: RegExp; place: PlaceName; inbound?: boolean }[] = [
  { re: /ukraine embassy/i, place: "Kyiv", inbound: true },
  { re: /kyiv/i, place: "Kyiv" },
  { re: /warsaw/i, place: "Warsaw" },
  { re: /brussels/i, place: "Brussels" },
  { re: /tallinn/i, place: "Tallinn" },
];

export interface GlobeArc {
  id: string;
  from: PlaceName;
  to: PlaceName;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  /** "Sen. Ellen Hartley → Kyiv · Mar 2026" */
  tooltip: string;
  date: string;
  /** The single most recent record: the one orange arc. */
  latest: boolean;
  href: string;
  /** For the "Recent movements" list. */
  row: {
    /** "Sen. Ellen Hartley" */
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
  Trips: "hartley-profile",
  Meetings: "hartley-meetings",
};

/**
 * Arcs from Washington to every travel record, and from abroad to Washington for every
 * foreign delegation, built from the entities and edges in src/data.
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
    const who = match.inbound ? `${detail.label} → ${person ?? "Washington"}` : `${person ?? "Delegation"} → ${match.place}`;
    const focus = category.label === "Trips" ? category.id : detail.id;
    const lead = category.categoryOf ? byId.get(category.categoryOf) : undefined;
    const src = sources.find((x) => x.id === edge.sourceIds[0]);
    const what = match.inbound ? "Delegation meeting" : cap(detail.label.replace(match.re, "").trim()) || "Trip";
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
        title: match.inbound ? detail.label.replace(/\s+delegation$/i, "") : (person ?? "Delegation"),
        detail: `To ${match.inbound ? "Washington" : match.place} · ${fullDate(edge.date)}`,
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
 * FARA records on the world map: an arc from the foreign principal's home city to Washington.
 * Presentation constants: the principal's city for each registrant in the demo data.
 */
const FARA_ORIGIN: Record<string, { place: PlaceName; principal: string }> = {
  halvorsen: { place: "Kyiv", principal: "Kyiv Industrial Recovery Association" },
  tidewater: { place: "Warsaw", principal: "Vistula Defence Industry Chamber" },
  calder: { place: "Odesa", principal: "Black Sea Reconstruction Fund" },
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
      tooltip: `FARA: ${o.principal} → ${first ? first.label : "Congress"} · ${monthYear(src.date)}`,
      date: src.date,
      latest: false,
      href: exploreEntityHref(first?.id),
      row: {
        title: o.principal,
        detail: `To Washington · ${fullDate(src.date)}`,
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
  .filter((a): a is GlobeArc => !!a);
