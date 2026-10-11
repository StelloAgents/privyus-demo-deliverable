import type { Edge, Entity, ScriptTurn } from "@/lib/types";
import { adjacency, catalog, countWord, entity, formatDate, joinList, shortLabel } from "./catalog";

/**
 * Turns for node clicks that the script does not cover (2.4 to 2.6).
 * The answer text depends only on the catalog, so a saved checkpoint can
 * rebuild it from the turn id alone. The graph change depends on what is
 * visible at click time; `buildNodeTurn` takes that set.
 */

export const NODE_TURN_PREFIX = "node:";
export const NO_MATCH_TURN_ID = "no-match";

export function nodeTurnId(entityId: string): string {
  return `${NODE_TURN_PREFIX}${entityId}`;
}

const MAX_NEW = 10;

function edgesOf(id: string): { edge: Edge; other: Entity }[] {
  return (adjacency.get(id) ?? [])
    .map((n) => ({ edge: catalog.edges[n.edge], other: catalog.entities[n.node] }))
    .filter((x) => x.edge && x.other);
}

function byDate(a: { edge: Edge }, b: { edge: Edge }): number {
  return (a.edge.date ?? "").localeCompare(b.edge.date ?? "");
}

function withDate(label: string, iso?: string): string {
  return iso ? `${label} (${formatDate(iso)})` : label;
}

/** The person that a category belongs to, by name. */
function ownerName(cat: Entity): string {
  const owner = cat.categoryOf ? entity(cat.categoryOf) : undefined;
  return owner?.label ?? "This member";
}

function possessive(name: string): string {
  return name.endsWith("s") ? `${name}’` : `${name}’s`;
}

function money(label: string): number {
  const m = /\$([\d,]+)/.exec(label);
  return m ? Number(m[1].replace(/,/g, "")) : 0;
}

function categoryAnswer(cat: Entity): string {
  const name = ownerName(cat);
  const kids = edgesOf(cat.id)
    .filter((x) => x.other.type === "detail")
    .sort(byDate);
  const n = kids.length;
  const list = (items: typeof kids) => joinList(items.map((k) => withDate(k.other.label, k.edge.date)));
  switch (cat.label) {
    case "Votes": {
      const yea = kids.filter((k) => /^Yea\b/.test(k.other.label));
      const nay = kids.filter((k) => /^Nay\b/.test(k.other.label));
      const first = kids[0]?.edge.date;
      const last = kids[n - 1]?.edge.date;
      const nayText = nay.length
        ? ` ${countWord(nay.length)} ${nay.length === 1 ? "is a Nay vote" : "are Nay votes"}: ${nay.map((k) => k.other.label.replace(/^Nay · /, "")).join("; ")}.`
        : "";
      return `${countWord(n)} Ukraine-related Senate roll calls in ${possessive(name)} record run from ${formatDate(first)} to ${formatDate(last)}. ${countWord(yea.length)} are Yea votes, the latest on ${yea[yea.length - 1]?.other.label.replace(/^Yea · /, "") ?? "the bill"}.${nayText}`;
    }
    case "Trips":
      return `Delegation releases list ${name} on ${n === 1 ? "one trip" : `${n} trips`}: ${list(kids)}. Each trip links to its release in the sources.`;
    case "Contacts":
      return `A FARA registrant lists ${n === 1 ? "one contact entry" : `${countWord(n).toLowerCase()} contact entries`} with ${name} or his staff: ${list(kids)}. Each entry links to its filing row.`;
    case "Contributions": {
      const gifts = edgesOf(cat.id)
        .filter((x) => x.other.type === "org" && /^contributed/.test(x.edge.label))
        .sort(byDate);
      const total = gifts.reduce((s, g) => s + money(g.edge.label), 0);
      return `FEC bulk data lists transfers to ${possessive(name)} campaign committee from ${countWord(gifts.length).toLowerCase()} PACs, $${total.toLocaleString("en-US")} in all: ${joinList(gifts.map((g) => `${g.other.label} ${g.edge.label.replace(/^contributed /, "")}`))}. These are reported contributions.`;
    }
    case "Statements":
      return `${countWord(n)} public statements by ${name} appear here: ${list(kids)}. Each one links to its source.`;
    case "Others":
      return `${countWord(n)} other ${n === 1 ? "record completes" : "records complete"} the profile: ${list(kids)}.`;
    default:
      return `${countWord(n)} ${cat.label.toLowerCase()} records for ${name}: ${list(kids)}.`;
  }
}

function personAnswer(p: Entity): string {
  const rel = edgesOf(p.id).sort(byDate);
  const parts: string[] = [];
  for (const b of rel.filter((r) => r.other.type === "bill")) {
    parts.push(/^sponsor/.test(b.edge.label) ? `sponsors ${shortLabel(b.other.id)}` : `is an original cosponsor of ${shortLabel(b.other.id)} (${formatDate(b.edge.date)})`);
  }
  for (const t of rel.filter((r) => /listed on delegation/.test(r.edge.label))) {
    parts.push(`is listed on the ${t.other.label} delegation`);
  }
  let text = `${p.label} (${p.sublabel ?? "member"})${parts.length ? ` ${joinList(parts)}` : " appears in the records on this graph"}.`;
  const contacts = rel.filter((r) => /contact with/.test(r.edge.label));
  if (contacts.length) {
    text += ` A FARA filing by Moran Global Strategies lists ${contacts.length === 1 ? "a contact" : "contacts"} with the senator for a Ukrainian ministry: ${joinList(contacts.map((c) => `“${c.other.label}” (${formatDate(c.edge.date)})`))}.`;
  }
  const received = rel.filter((r) => /^received/.test(r.edge.label));
  if (received.length) text += ` FEC bulk data lists ${joinList(received.map((r) => r.other.label))}.`;
  return text;
}

function orgAnswer(o: Entity): string {
  const rel = edgesOf(o.id).sort(byDate);
  let text = `${o.label}: ${o.sublabel ?? "organization"}.`;
  const gifts = rel.filter((r) => /^contributed/.test(r.edge.label));
  if (gifts.length) {
    text += ` FEC bulk data lists ${joinList(
      gifts.map((g) => {
        const to = g.other.type === "category" ? `${possessive(ownerName(g.other))} campaign committee` : g.other.label;
        return `${g.edge.label.replace(/^contributed /, "")} to ${to}`;
      }),
    )}.`;
  }
  const principal = rel.find((r) => /registered foreign principal/.test(r.edge.label));
  if (principal) {
    text += principal.other.id === o.id ? "" : ` FARA lists ${principal.other.label} as a foreign principal, registered ${formatDate(principal.edge.date)}.`;
  }
  const contacts = rel.filter((r) => /reported (contact|by registrant)/.test(r.edge.label));
  if (contacts.length) text += ` Its FARA filing lists ${contacts.length} contact ${contacts.length === 1 ? "entry" : "entries"} on this graph.`;
  return text;
}

function detailAnswer(d: Entity): string {
  const rel = edgesOf(d.id);
  const parent = rel.find((r) => r.other.type === "category" || r.other.type === "detail");
  const src = parent?.edge.sourceIds.map((s) => catalog.sources[s]).find(Boolean);
  if (/^UserRound$/.test(d.icon ?? "") || rel.some((r) => /represents|works at/.test(r.edge.label))) {
    const org = rel.find((r) => /represents|works at/.test(r.edge.label));
    const meeting = rel.find((r) => /attended/.test(r.edge.label));
    return `${d.label} ${org ? `${org.edge.label} ${org.other.label}` : `is listed as ${d.sublabel}`}.${
      meeting ? ` The visitor log places ${d.label.replace(/^Dr\. /, "Dr. ")} at the ${meeting.other.label.toLowerCase()} on ${formatDate(meeting.edge.date)}.` : ""
    }`;
  }
  const when = parent?.edge.date ? `, ${formatDate(parent.edge.date)}` : d.sublabel ? `, ${d.sublabel}` : "";
  const fromSrc = src ? ` The entry comes from ${src.title}.` : "";
  return `${d.label}${when}.${fromSrc}`;
}

function topicAnswer(t: Entity): string {
  const rel = edgesOf(t.id);
  const bills = rel.filter((r) => r.other.type === "bill").map((r) => r.other.label);
  return `${t.label} connects to ${bills.length} bills: ${joinList(bills)}.`;
}

function billAnswer(b: Entity): string {
  const rel = edgesOf(b.id);
  const sponsor = rel.find((r) => /^sponsor/.test(r.edge.label));
  const co = rel.filter((r) => /cosponsor/.test(r.edge.label));
  const src = rel.flatMap((r) => r.edge.sourceIds).map((s) => catalog.sources[s]).find((s) => s?.kind === "CONGRESS");
  let text = `${b.label} (${b.sublabel ?? "bill"}).`;
  if (sponsor) text += ` The bill record lists ${sponsor.other.label} as sponsor.`;
  if (co.length) text += ` It lists ${co.length} senators of this exploration as original cosponsors.`;
  if (src) text += ` The entry comes from ${src.title}.`;
  return text;
}

export function nodeAnswer(id: string): string {
  const e = entity(id);
  if (!e) return "";
  switch (e.type) {
    case "category":
      return categoryAnswer(e);
    case "person":
      return personAnswer(e);
    case "org":
      return orgAnswer(e);
    case "detail":
      return detailAnswer(e);
    case "topic":
      return topicAnswer(e);
    case "bill":
      return billAnswer(e);
  }
}

function citationsFor(id: string): string[] {
  const out = new Set<string>();
  for (const r of edgesOf(id)) for (const s of r.edge.sourceIds) out.add(s);
  return Array.from(out).slice(0, 4);
}

function populateNoun(e: Entity): string {
  switch (e.type) {
    case "category":
      return `${e.label.toLowerCase()} entries`;
    case "person":
      return "related records";
    case "org":
      return "connections";
    case "topic":
      return "related records";
    case "bill":
      return "members";
    default:
      return "connections";
  }
}

function queryLabel(e: Entity): string {
  switch (e.type) {
    case "category":
      return `Query ${e.label.toLowerCase()} records`;
    case "org":
      return "Query FARA and FEC filings";
    case "person":
      return "Query public records";
    case "detail":
      return "Read the source record";
    default:
      return "Query the database";
  }
}

/**
 * A turn for a click on `id`. When `visible` is given, the turn opens the
 * neighbors that are not in the graph yet (with the edges to them).
 */
export function buildNodeTurn(id: string, visible?: Set<string>): ScriptTurn {
  const e = entity(id);
  const focus = { label: `Focus ${shortLabel(id)}`, delta: { add: { entities: [], edges: [] }, focus: id } };
  const base: Omit<ScriptTurn, "steps"> = {
    id: nodeTurnId(id),
    trigger: { nodeClick: id },
    answer: nodeAnswer(id),
    citations: citationsFor(id),
    suggestions: [],
  };
  if (!e || !visible) {
    return { ...base, steps: [focus, { label: queryLabel(e ?? ({ type: "detail" } as Entity)), delta: { add: { entities: [], edges: [] } } }] };
  }
  const fresh = edgesOf(id)
    .filter((r) => !visible.has(r.other.id))
    .sort(byDate)
    .slice(0, MAX_NEW);
  if (fresh.length === 0) {
    return {
      ...base,
      steps: [focus, { label: queryLabel(e), delta: { add: { entities: [], edges: [] } } }],
    };
  }
  return {
    ...base,
    steps: [
      focus,
      { label: queryLabel(e), delta: { add: { entities: [], edges: [] } } },
      {
        label: `Populate ${populateNoun(e)}`,
        delta: { add: { entities: fresh.map((r) => r.other.id), edges: fresh.map((r) => r.edge.id) } },
      },
      { label: "Establish connections", delta: { add: { entities: [], edges: [] } } },
      { label: "Render", delta: { add: { entities: [], edges: [] }, expand: id } },
    ],
  };
}

/** The reply when a question matches no turn. It never shows an error. */
export function buildNoMatchTurn(): ScriptTurn {
  return {
    id: NO_MATCH_TURN_ID,
    trigger: {},
    steps: [{ label: "Search the graph and public records", delta: { add: { entities: [], edges: [] } } }],
    answer:
      "I could not find records for that question in this exploration. I can answer questions about the bills, senators, FARA contacts, trips, and contributions shown here. Try one of these:",
    citations: [],
    suggestions: [],
  };
}
