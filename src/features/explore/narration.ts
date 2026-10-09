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
      const yes = kids.filter((k) => /^Yes\b/.test(k.other.label));
      const no = kids.filter((k) => /^No\b/.test(k.other.label));
      const first = kids[0]?.edge.date;
      const last = kids[n - 1]?.edge.date;
      const noText = no.length
        ? ` ${countWord(no.length)} is a No vote: ${no.map((k) => k.other.label.replace(/^No · /, "the ")).join(", ")}.`
        : "";
      return `${countWord(n)} recorded votes connect ${name} to Ukraine aid, from ${formatDate(first)} to ${formatDate(last)}. ${countWord(yes.length)} are Yes votes, including ${yes[yes.length - 1]?.other.label.replace(/^Yes · /, "") ?? "the aid package"}.${noText}`;
    }
    case "Trips":
      return `${possessive(name)} travel disclosures list ${n} trips: ${list(kids)}. Each trip links to its filing in the sources.`;
    case "Contributions": {
      const total = kids.reduce((s, k) => s + money(k.other.label), 0);
      return `${countWord(n)} itemized receipts to ${possessive(name)} campaign total $${total.toLocaleString("en-US")}: ${list(kids)}. These are reported contributions, not evidence of influence over a vote.`;
    }
    case "Opinions":
      return `${countWord(n)} public statements by ${name} appear here: ${list(kids)}. Together they support aid with transfer oversight.`;
    case "Others":
      return `${countWord(n)} other records complete the profile: ${list(kids)}.`;
    default:
      return `${countWord(n)} ${cat.label.toLowerCase()} records for ${name}: ${list(kids)}.`;
  }
}

function personAnswer(p: Entity): string {
  const rel = edgesOf(p.id).sort(byDate);
  const head = `${p.label} (${p.sublabel ?? "member"})`;
  const parts: string[] = [];
  const bills = rel.filter((r) => r.other.type === "bill");
  for (const b of bills) {
    const verb = /^sponsored/.test(b.edge.label) ? "sponsors" : "cosponsored";
    const when = /^sponsored/.test(b.edge.label) ? "" : ` on ${formatDate(b.edge.date)}`;
    parts.push(`${verb} ${b.other.label}${when}`);
  }
  if (!parts.length) {
    const org = rel.find((r) => /represents|works at/.test(r.edge.label));
    const meeting = rel.find((r) => /attended/.test(r.edge.label));
    let t = org ? `${p.label} ${org.edge.label} ${org.other.label}.` : `${p.label}, ${p.sublabel ?? "contact"}.`;
    if (meeting) {
      t += ` The visitor log places ${p.label} at the ${meeting.other.label.toLowerCase()} on ${formatDate(meeting.edge.date)}.`;
    }
    return t;
  }
  let text = `${head} ${joinList(parts)}.`;
  const gifts = rel.filter((r) => /^contributed/.test(r.edge.label));
  if (gifts.length) {
    text += ` FEC filings show ${joinList(
      gifts.map((g) => `${g.other.label} PAC gave ${g.edge.label.replace(/^contributed /, "")}`),
    )}.`;
  }
  const briefings = rel.filter((r) => /briefing/.test(r.edge.label));
  for (const b of briefings) {
    text += ` ${b.other.label} reports a policy briefing with the office on ${formatDate(b.edge.date)}.`;
  }
  return text;
}

function orgAnswer(o: Entity): string {
  const rel = edgesOf(o.id).sort(byDate);
  let text = `${o.label} is a ${(o.sublabel ?? "organization").toLowerCase()}.`;
  const gifts = rel.filter((r) => /^contributed/.test(r.edge.label));
  if (gifts.length) {
    text += ` Its PAC reported ${joinList(
      gifts.map((g) => {
        const to = g.other.type === "category" ? `${possessive(ownerName(g.other))} campaign` : g.other.label;
        return `${g.edge.label.replace(/^contributed /, "")} to ${to}`;
      }),
    )}.`;
  }
  const people = rel.filter((r) => (r.other.type === "detail" || r.other.type === "person") && /represents|works at/.test(r.edge.label));
  if (people.length) {
    text += ` ${joinList(people.map((p) => p.other.label))} ${people.length > 1 ? "are" : "is"} listed with the ${
      /lobby/i.test(o.sublabel ?? "") ? "firm" : "organization"
    }.`;
  }
  const meetings = rel.filter((r) => /briefed|briefing/.test(r.edge.label));
  for (const m of meetings) {
    text += ` It ${m.other.type === "person" ? `briefed ${m.other.label}’s office` : `appears in the ${m.other.label.toLowerCase()}`} on ${formatDate(m.edge.date)}.`;
  }
  const analysis = rel.filter((r) => /analysis/.test(r.edge.label));
  for (const a of analysis) {
    text += ` It published analysis on the ${a.other.label} on ${formatDate(a.edge.date)}.`;
  }
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
  const orgs = rel.filter((r) => r.other.type === "org").map((r) => r.other.label);
  let text = `${t.label} connects to ${bills.length} bills: ${joinList(bills)}.`;
  if (orgs.length) text += ` ${joinList(orgs)} published analysis on the topic.`;
  return text;
}

function billAnswer(b: Entity): string {
  const rel = edgesOf(b.id);
  const sponsor = rel.find((r) => /^sponsored/.test(r.edge.label));
  const co = rel.filter((r) => /^cosponsored/.test(r.edge.label));
  return `${b.label}${sponsor ? ` is sponsored by ${sponsor.other.label}` : ""}, with ${co.length} cosponsors in the bill record.`;
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
      return "Query LDA and FEC filings";
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
      "I could not find records for that question in this exploration. I can answer questions about the bills, members, meetings, and contributions shown here. Try one of these:",
    citations: [],
    suggestions: [],
  };
}
