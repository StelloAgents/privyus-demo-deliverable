/**
 * Content for the hidden /technical page. The source of truth is
 * technical-architecture.md in the project root. Scale figures are
 * order-of-magnitude estimates and stay in words; do not add precise numbers.
 */
import type { LucideIcon } from "lucide-react";
import type { SourceKind } from "@/lib/types";
import {
  ArrowLeftRight,
  Braces,
  Database,
  Gauge,
  History,
  FileSearch,
  GitMerge,
  Globe2,
  LayoutTemplate,
  Network,
  ShieldCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Sections (table of contents)                                        */
/* ------------------------------------------------------------------ */

export const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "scale", label: "Data volume" },
  { id: "system", label: "System layers" },
  { id: "resolution", label: "Entity resolution" },
  { id: "data-model", label: "Data model" },
  { id: "queries", label: "One-hop queries" },
  { id: "drawing", label: "Graph drawing" },
  { id: "agents", label: "Agent access" },
  { id: "stores", label: "Stores and releases" },
  { id: "risks", label: "Risks and mitigations" },
  { id: "plan", label: "Phased plan" },
] as const;

/* ------------------------------------------------------------------ */
/* The scale                                                           */
/* ------------------------------------------------------------------ */

export interface ScaleFigure {
  /** Power of ten shown as the figure, for example 8 for 10^8. */
  exponent?: number;
  /** Shown instead of a power of ten (the 50-state multiplier). */
  figure?: string;
  /** Prefix on the figure, for example "~" or "→". */
  prefix?: string;
  words: string;
  what: string;
  /** The one figure that carries the attention color. */
  accent?: boolean;
}

export const SCALE: ScaleFigure[] = [
  { prefix: "~", exponent: 8, words: "Hundreds of millions of rows", what: "Itemized campaign contributions (FEC)" },
  { prefix: "~", exponent: 7, words: "Tens of millions of rows", what: "Member votes, each member on each roll call" },
  { prefix: "~", exponent: 7, words: "Tens of millions of pages", what: "Filings, statements, and the Congressional Record, as text and embeddings" },
  {
    prefix: "→",
    exponent: 9,
    words: "Approaching billions",
    what: "Edges after resolution: every contribution, vote, contact, trip, and meeting as a link",
    accent: true,
  },
  { figure: "×n", words: "Several times all of the above", what: "All 50 state legislatures added" },
];

export const SCALE_SECONDARY = [
  { words: "Millions of rows", what: "Lobbying filings and their contacts, issues, and clients" },
  { words: "Millions of rows", what: "Bills, actions, and cosponsor records" },
];

export const HARD_THINGS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: GitMerge,
    title: "Name Matching Without IDs",
    body: "One person appears under a different name in each source. Most records carry no common identifier.",
  },
  {
    icon: FileSearch,
    title: "A Source on Every Edge",
    body: "Each edge keeps its source document with the fetch time, the URL, and a content hash.",
  },
  {
    icon: Gauge,
    title: "Sub-Second Answers",
    body: "Queries stay fast while new filings arrive every day and the graph changes under them.",
  },
];

/* ------------------------------------------------------------------ */
/* The four layers                                                     */
/* ------------------------------------------------------------------ */

export interface SourceRow {
  name: string;
  gives: string;
  form: string;
  fara?: boolean;
}

export const SOURCES: SourceRow[] = [
  { name: "congress.gov API", gives: "Bills, sponsors, cosponsors, actions", form: "API" },
  { name: "Roll call votes", gives: "How each member voted", form: "XML" },
  { name: "Senate LDA", gives: "Lobbying registrations, clients, issues, contacts", form: "API" },
  { name: "FARA", gives: "Foreign principals, agents, activities", form: "Bulk", fara: true },
  { name: "OpenFEC", gives: "Campaign contributions and committees", form: "API" },
  { name: "Gift and travel", gives: "Privately funded trips", form: "PDF" },
  { name: "Financial disclosures", gives: "Holdings and transactions of members", form: "PDF" },
  { name: "Statements", gives: "What members say, with dates", form: "HTML" },
  { name: "GovInfo", gives: "Bill text, Congressional Record", form: "Bulk" },
];

export type LayerId = "collect" | "resolve" | "store" | "showcase";

export interface Layer {
  id: LayerId;
  index: number;
  title: string;
  items: string[];
  /** One sentence shown in the detail area. */
  summary: string;
  detail: { title: string; body: string }[];
  /** Small tag, for example "This demo". */
  tag?: string;
}

export const LAYERS: Layer[] = [
  {
    id: "collect",
    index: 1,
    title: "Collect",
    items: ["API connectors", "Bulk file loaders", "Scrapers: HTML and PDF"],
    summary: "Connectors fetch each source on a schedule and keep the original document as the proof behind every fact.",
    detail: [
      { title: "API Connectors", body: "Official APIs return structured records. Each source has its own keys and rate limits." },
      { title: "Bulk File Loaders", body: "Loaders read large files on a schedule and keep only the records that changed." },
      {
        title: "Scrapers",
        body: "A headless browser fetches dynamic pages. PDF parsing and OCR read the documents. An LLM extracts fields into a fixed schema, and a check rejects records that do not fit it.",
      },
      {
        title: "Connector Rules",
        body: "Keep the original with the fetch time, the source URL, and a content hash. Process only the changes. A workflow orchestrator (for example, Temporal or Dagster) runs and retries the jobs. Obey each site's terms and rate limits.",
      },
    ],
  },
  {
    id: "resolve",
    index: 2,
    title: "Resolve and Connect",
    items: ["Normalize", "Entity resolution", "Relationship extraction"],
    summary: "Records about the same person become one node, and each record becomes typed edges. This step is what a customer pays for because no single public database does it.",
    detail: [
      { title: "Normalize", body: "Clean names, dates, amounts, and addresses into one format." },
      {
        title: "Entity Resolution",
        body: "Start from public IDs (Bioguide, FEC, LDA). Use fuzzy matching and an LLM check for records without IDs. Send uncertain matches to a human review queue. Never guess silently.",
      },
      {
        title: "Relationship Extraction",
        body: "Each record becomes typed edges: member voted on bill, lobbyist contacted office, committee contributed to member, member traveled to place. Each edge keeps its source document and its date.",
      },
      {
        title: "Social Network Precedent",
        body: "Large social networks resolve identities the same way. They combine many weak signals into one confident identity.",
      },
    ],
  },
  {
    id: "store",
    index: 3,
    title: "Store",
    items: ["Raw document store", "Graph database", "Search and vector index", "Analytics warehouse"],
    summary: "Each store answers a different type of question. Start with one Postgres database, and split out stores as the data grows.",
    detail: [
      { title: "Raw Document Store", body: "Holds every original filing. It answers “show me the source”." },
      { title: "Graph Database", body: "Holds people, organizations, bills, events, and edges. It answers “how is A connected to B?”" },
      { title: "Search and Vector Index", body: "Holds full text and embeddings. It answers “find statements about Ukraine aid”." },
      { title: "Analytics Warehouse", body: "Holds counts and trends over time for the dashboard counters and Radar." },
    ],
  },
  {
    id: "showcase",
    index: 4,
    title: "Query and Display",
    items: ["AI query agent", "Web app: dashboard and graph"],
    tag: "This demo",
    summary: "The demo shows this layer. Its data already uses the shape of the real agent response, so a real backend can replace the fixed data file without a rebuild of the screens.",
    detail: [
      {
        title: "AI Query Agent",
        body: "An LLM agent calls tools (graph query, full-text search, document fetch) and returns the answer text, a graph change, and the citations together. It streams its steps while it works.",
      },
      {
        title: "Tested Templates",
        body: "Graph queries use tested query templates, not free-form generated queries. The agent states only what a source supports.",
      },
      {
        title: "Web App",
        body: "Next.js and React, as in the demo. The graph canvas moves to a WebGL graph library (for example, Sigma.js) for thousands of nodes.",
      },
      {
        title: "Workspace",
        body: "Checkpoints save nodes, positions, the view, and the chat. The activity feed and watchlist come from change detection in layer 1. Single sign-on, separate workspace data per customer, and audit logs.",
      },
    ],
  },
];

export const TIERS = [
  { id: "raw", holds: "Each source exactly as delivered, with load time, URL, and hash", rule: "Never edited. Every fact traces back to here." },
  { id: "build", holds: "Cleaned records, lookup dictionaries, the match candidates", rule: "Rebuilt by the pipeline. Never read by the app." },
  { id: "serving", holds: "The product tables", rule: "Read-only for the app. Released only after the checks pass." },
] as const;

/* ------------------------------------------------------------------ */
/* Entity resolution                                                   */
/* ------------------------------------------------------------------ */

export type DecidedBy = "public_id" | "model" | "reviewer";

export interface CrosswalkRow {
  source: string;
  /** How the record names the person in that source. */
  raw: string;
  keyType: string;
  keyValue: string;
  confidence: string;
  decidedBy: DecidedBy;
  fara?: boolean;
}

export const CROSSWALK: CrosswalkRow[] = [
  { source: "congress.gov", raw: "Hartley, Ellen", keyType: "bioguide", keyValue: "H001234", confidence: "1.00", decidedBy: "public_id" },
  { source: "OpenFEC", raw: "HARTLEY, ELLEN M.", keyType: "fec_candidate", keyValue: "S6OH00123", confidence: "1.00", decidedBy: "public_id" },
  { source: "Senate roll call", raw: "Hartley (R-OH)", keyType: "senate_lis", keyValue: "S401", confidence: "1.00", decidedBy: "public_id" },
  { source: "Senate LDA", raw: "HARTLEY, ELLEN", keyType: "lda_contact", keyValue: "\"HARTLEY, ELLEN\"", confidence: "0.93", decidedBy: "model" },
  { source: "Travel filing", raw: "Sen. E. Hartley", keyType: "travel_filer", keyValue: "\"Sen. E. Hartley\"", confidence: "0.97", decidedBy: "reviewer" },
];

export const DECIDED_BY_LABEL: Record<DecidedBy, string> = {
  public_id: "Public ID",
  model: "Model",
  reviewer: "Reviewer",
};

/* ------------------------------------------------------------------ */
/* Data model                                                          */
/* ------------------------------------------------------------------ */

export interface SchemaColumn {
  name: string;
  type: string;
  key?: "pk" | "fk";
}

export interface SchemaTable {
  name: string;
  note?: string;
  columns: SchemaColumn[];
}

export const SCHEMA: Record<"entities" | "edges" | "documents" | "entity_stats" | "votes", SchemaTable> = {
  entities: {
    name: "entities",
    note: "person | org | bill | event | place",
    columns: [
      { name: "id", type: "text", key: "pk" },
      { name: "type", type: "enum" },
      { name: "name", type: "text" },
      { name: "subtitle", type: "text" },
      { name: "party", type: "text" },
      { name: "state", type: "text" },
      { name: "photo_url", type: "text" },
    ],
  },
  edges: {
    name: "edges",
    note: "every link, with its source and date",
    columns: [
      { name: "src_id", type: "text", key: "fk" },
      { name: "dst_id", type: "text", key: "fk" },
      { name: "type", type: "enum" },
      { name: "event_date", type: "date" },
      { name: "amount", type: "numeric" },
      { name: "source_doc_id", type: "text", key: "fk" },
      { name: "confidence", type: "real" },
    ],
  },
  documents: {
    name: "documents",
    note: "the source chip on every answer",
    columns: [
      { name: "doc_id", type: "text", key: "pk" },
      { name: "source", type: "text" },
      { name: "url", type: "text" },
      { name: "fetched_at", type: "timestamp" },
      { name: "content_hash", type: "text" },
      { name: "title", type: "text" },
    ],
  },
  entity_stats: {
    name: "entity_stats",
    note: "“Votes 42”, “Trips 6”, “Meetings 11”",
    columns: [
      { name: "entity_id", type: "text", key: "fk" },
      { name: "category", type: "text" },
      { name: "count", type: "int" },
    ],
  },
  votes: {
    name: "votes",
    note: "the seat chart and the map",
    columns: [
      { name: "vote_id", type: "text" },
      { name: "member_id", type: "text", key: "fk" },
      { name: "position", type: "enum" },
    ],
  },
};

export const MODEL_NOTES = [
  "A meeting or a trip is a node (type = event). The attendees connect to it. This is the Meetings → Private meeting → attendees chain in the demo.",
  "Every edge has a source_doc_id. This is the source chip on every answer.",
  "Money from a company PAC or its employees links to the company with an edge that has a confidence score and a source. It is never a silent merge.",
];

/* ------------------------------------------------------------------ */
/* One-hop queries                                                     */
/* ------------------------------------------------------------------ */

export interface QueryRow {
  action: string;
  query: string;
  href: string;
  linkLabel: string;
}

export const QUERIES: QueryRow[] = [
  {
    action: "Select a bill, see its supporters",
    query: "edges WHERE dst_id = bill AND type IN (sponsored, cosponsored)\n  JOIN entities",
    href: "/explore?turn=defense-support-members",
    linkLabel: "S. 456 supporters",
  },
  {
    action: "Select a member, see the categories",
    query: "entity_stats WHERE entity_id = member",
    href: "/explore?turn=hartley-profile",
    linkLabel: "Sen. Ellen Hartley",
  },
  {
    action: "Open Meetings",
    query: "edges WHERE src_id = member AND type = attended\n  JOIN entities -- events",
    href: "/explore?turn=hartley-meetings",
    linkLabel: "Meetings",
  },
  {
    action: "Open a private meeting",
    query: "edges WHERE dst_id = meeting AND type = attended",
    href: "/explore?turn=private-meeting-attendees",
    linkLabel: "Private meeting",
  },
  {
    action: "“Which defense contractors gave to this senator?”",
    query: "edges WHERE dst_id = member AND type = contributed\n  JOIN entities -- orgs",
    href: "/explore?q=Which%20defense%20contractors%20gave%20to%20Hartley%3F",
    linkLabel: "Defense contractors",
  },
  {
    action: "Open a source",
    query: "documents WHERE doc_id = edge.source_doc_id",
    href: "/explore?turn=private-meeting-attendees",
    linkLabel: "Visitor log source",
  },
];

/* ------------------------------------------------------------------ */
/* How the graph is drawn                                              */
/* ------------------------------------------------------------------ */

export const DRAW_STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: LayoutTemplate,
    title: "Template",
    body: "The agent maps the question to a tested query template and fills in the parameters. It does not write free-form SQL.",
  },
  {
    icon: Braces,
    title: "Graph Delta",
    body: "It returns the nodes and edges to add, with the answer text, the citations, and the steps. The demo already uses this exact shape.",
  },
  {
    icon: Network,
    title: "Layout",
    body: "The app keeps the existing nodes in place and lays out the new nodes around the selected node with a force layout.",
  },
  {
    icon: Globe2,
    title: "Map Arcs",
    body: "The map uses the same edges. Each organization and member has a state, so a contribution becomes an arc from one state to another.",
  },
];

/** A trimmed copy of the hartley-meetings turn in src/data/script.ts (same shape). */
export const DELTA_EXAMPLE = `// trimmed: 3 of 5 meetings, 4 of 5 steps
{
  "id": "hartley-meetings",
  "steps": [
    { "label": "Focus Meetings",
      "delta": { "add": { "entities": [], "edges": [] },
                 "focus": "cat-meetings" } },
    { "label": "Query meeting records",
      "delta": { "add": { "entities": [], "edges": [] } } },
    { "label": "Populate meetings",
      "delta": { "add": {
        "entities": ["meeting-private", "meeting-meridian",
                     "meeting-committee"],
        "edges": ["cat-meetings-meeting-private",
                  "cat-meetings-meeting-meridian",
                  "cat-meetings-meeting-committee"] } } },
    { "label": "Render",
      "delta": { "add": { "entities": [], "edges": [] },
                 "focus": "cat-meetings",
                 "expand": "cat-meetings" } }
  ],
  "answer": "Five meetings appear in Hartley’s office records, …",
  "citations": ["disc-meetings", "disc-private"]
}`;

/** The node, edge, and document records that the delta refers to (src/data). */
export const RECORDS_EXAMPLE = `// entities
{ "id": "meeting-private", "type": "detail",
  "label": "Private meeting", "sublabel": "Jun 17, 2026" }

// edges
{ "id": "cat-meetings-meeting-private",
  "source": "cat-meetings", "target": "meeting-private",
  "label": "meeting", "date": "2026-06-17",
  "sourceIds": ["disc-private"] }

// documents
{ "id": "disc-private", "kind": "DISCLOSURE",
  "title": "Visitor log · Jun 17, 2026",
  "geo": { "from": "DC", "to": "OH" } }`;

/* ------------------------------------------------------------------ */
/* Agent access (planned)                                              */
/* ------------------------------------------------------------------ */

export type DoorId = "web" | "api" | "mcp";

export interface Door {
  id: DoorId;
  title: string;
  /** The name inside the diagram box (sentence case). */
  label: string;
  /** Short line inside the diagram box. */
  sub: string;
  tag: "This demo" | "Planned";
  body: string;
}

export const DOORS: Door[] = [
  {
    id: "web",
    title: "Web App",
    label: "Web app",
    sub: "Dashboard and graph",
    tag: "This demo",
    body: "Analysts ask in plain words and explore the graph. Each answer shows its source chips.",
  },
  {
    id: "api",
    title: "REST API",
    label: "REST API",
    sub: "JSON over HTTPS",
    tag: "Planned",
    body: "Customer software calls the same query templates. Each response is JSON with the answer, the graph delta, and the source ids.",
  },
  {
    id: "mcp",
    title: "MCP Server",
    label: "MCP server",
    sub: "Six tools for agents",
    tag: "Planned",
    body: "MCP (Model Context Protocol) is an open standard that lets AI assistants call outside tools. Any agent that supports it can search Privyus and cite each filing it uses. Each agent platform that connects brings Privyus records into the tools its users already use.",
  },
];

export const AGENT_CLIENTS = ["Fund research agent", "Newsroom agent", "Compliance agent", "General AI assistant"];

export const CORE_ITEMS = [
  { label: "Tested query templates", sub: "No free-form queries" },
  { label: "One answer shape", sub: "Text, graph delta, citations" },
  { label: "Source on every result", sub: "URL, fetch time, hash" },
  { label: "Coverage limits", sub: "The same rules as the app" },
];

export const CONTROLS = [
  { label: "API keys", sub: "One per customer" },
  { label: "Rate limits", sub: "Per key and per tool" },
  { label: "Usage logs", sub: "Calls per key" },
  { label: "Audit logs", sub: "Each request and result" },
];

export const AGENT_TOOLS = [
  { tool: "search_entities", returns: "People, organizations, bills, and filings that match a name or a topic", used: "Call 1" },
  { tool: "get_profile", returns: "One entity with its category counts (votes, trips, meetings, contributions)" },
  { tool: "expand_connections", returns: "The one-hop neighbors of an entity, filtered by edge type and date", used: "Calls 2 to 4" },
  { tool: "get_sources", returns: "The original filings behind an edge, with URL, fetch time, and hash", used: "Call 5" },
  { tool: "find_path", returns: "The shortest documented chain between two entities" },
  { tool: "watch", returns: "Notifications when a new record about an entity arrives" },
];

/* The agent session. Every record, date, and amount comes from src/data. */

export type SessionNodeId =
  | "hartley"
  | "meeting-meridian"
  | "meeting-ukraine"
  | "meeting-private"
  | "voss"
  | "pierce"
  | "sen"
  | "aegis"
  | "redwood";

/** One line of a tool result: an id, a record name, and an optional detail. */
export interface ResultLine {
  id: string;
  name: string;
  detail?: string;
}

export interface SessionCall {
  tool: string;
  /** The arguments as printed, one string per line. */
  args: string[];
  /** A one-line summary next to the result, for example "3 events". */
  summary: string;
  lines: ResultLine[];
  /** Graph nodes that this result adds. */
  adds: SessionNodeId[];
}

export const SESSION_QUESTION =
  "Which defense contractors met with Sen. Ellen Hartley’s office or gave to her campaign in 2026?";

export const SESSION_CALLS: SessionCall[] = [
  {
    tool: "search_entities",
    args: ['{ query: "Ellen Hartley" }'],
    summary: "1 person",
    lines: [{ id: "per_hartley", name: "Sen. Ellen Hartley", detail: "R-OH" }],
    adds: ["hartley"],
  },
  {
    tool: "expand_connections",
    args: ['{ id: "per_hartley",', '  type: "attended", from: "2026-01-01" }'],
    summary: "3 events",
    lines: [
      { id: "evt_meridian_0224", name: "Meridian policy briefing", detail: "Feb 24" },
      { id: "evt_ukraine_0429", name: "Ukraine embassy delegation", detail: "Apr 29" },
      { id: "evt_private_0617", name: "Private meeting", detail: "Jun 17" },
    ],
    adds: ["meeting-meridian", "meeting-ukraine", "meeting-private"],
  },
  {
    tool: "expand_connections",
    args: ['{ id: "evt_private_0617",', '  type: "attended_by" }'],
    summary: "3 people",
    lines: [
      { id: "per_voss", name: "Clara Voss", detail: "Meridian Public Affairs" },
      { id: "per_pierce", name: "Nathaniel Pierce", detail: "Aegis Systems" },
      { id: "per_sen", name: "Dr. Priya Sen", detail: "Atlantic Security Institute" },
    ],
    adds: ["voss", "pierce", "sen"],
  },
  {
    tool: "expand_connections",
    args: ['{ id: "per_hartley",', '  type: "contributed", from: "2026-01-01" }'],
    summary: "2 contributions",
    lines: [
      { id: "org_aegis", name: "Aegis PAC", detail: "$18,750 · Apr 8" },
      { id: "org_redwood", name: "Redwood PAC", detail: "$7,625 · Aug 21" },
    ],
    adds: ["aegis", "redwood"],
  },
  {
    tool: "get_sources",
    args: ['{ edges: ["edg_private_pierce",', '  "edg_aegis_hartley"] }'],
    summary: "2 documents",
    lines: [
      { id: "[1] doc_disc_private", name: "Visitor log · Jun 17, 2026" },
      { id: "    url", name: "https://…/visitor-log-0617.pdf" },
      { id: "    fetched_at", name: "2026-06-18T09:14Z" },
      { id: "    hash", name: "sha256:9f2c…41ab" },
      { id: "[2] doc_fec_hartley", name: "FEC Schedule A · Aug 2026" },
      { id: "    url", name: "https://…/schedule-a/S6OH00123" },
      { id: "    fetched_at", name: "2026-08-22T06:02Z" },
      { id: "    hash", name: "sha256:5d07…c3e2" },
    ],
    adds: [],
  },
];

export const SESSION_ANSWER =
  "Nathaniel Pierce of Aegis Systems attended a private meeting in Hartley’s office on Jun 17, 2026 [1]. FEC receipts list 2026 contributions to her campaign from Aegis PAC ($18,750) and Redwood PAC ($7,625) [2].";

export const SESSION_SOURCES: { n: number; kind: SourceKind; title: string }[] = [
  { n: 1, kind: "DISCLOSURE", title: "Visitor log · Jun 17, 2026" },
  { n: 2, kind: "FEC", title: "FEC Schedule A · Aug 2026" },
];

/* ------------------------------------------------------------------ */
/* Stores and release safety                                           */
/* ------------------------------------------------------------------ */

export const STORES = [
  { store: "Raw document store", holds: "Every original filing", answers: "“Show me the source”", tech: "Amazon S3" },
  { store: "Graph database", holds: "People, organizations, bills, events, and edges", answers: "“How is A connected to B?”", tech: "Neo4j or Amazon Neptune" },
  { store: "Search and vector index", holds: "Full text and embeddings", answers: "“Find statements about Ukraine aid”", tech: "OpenSearch or pgvector" },
  { store: "Analytics warehouse", holds: "Counts and trends over time", answers: "Dashboard counters, Radar, trends", tech: "ClickHouse, Snowflake, or BigQuery" },
  { store: "App database", holds: "Users, watchlists, checkpoints", answers: "The personal workspace", tech: "Postgres" },
];

export const RELEASE_STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Database, title: "Parallel Build", body: "Each release builds new serving tables next to the live ones." },
  {
    icon: ShieldCheck,
    title: "Release Checks",
    body: "Row counts, ID churn, empty fields, and a fixed set of benchmark queries compared with the last release.",
  },
  { icon: ArrowLeftRight, title: "Atomic Swap", body: "The new tables replace the live ones in one atomic swap." },
  { icon: History, title: "30-Day Rollback", body: "The old tables stay for 30 days, so a rollback takes one command." },
];

/* ------------------------------------------------------------------ */
/* Risks and plan                                                      */
/* ------------------------------------------------------------------ */

export const RISKS = [
  {
    risk: "Entity resolution errors",
    why: "A wrong link between two people is a false claim.",
    reduce: "Public IDs first, a confidence score on each match, human review for uncertain matches, and a source on every edge.",
  },
  {
    risk: "Inferred claims about real people",
    why: "Defamation and reputational risk.",
    reduce: "Show records, not conclusions. The product says “the visitor log lists X”, never “X influenced Y”. Legal review of the wording.",
  },
  { risk: "Scanned and messy documents", why: "OCR and extraction errors.", reduce: "Schema checks, confidence scores, and a link to the original page." },
  { risk: "Source changes", why: "A site changes its layout, and a scraper breaks.", reduce: "Monitoring per connector, alerts, and API sources first." },
  { risk: "Gaps in the public record", why: "Private meetings are often not disclosed.", reduce: "Be clear about coverage. Show what each source covers and does not cover." },
  { risk: "LLM cost and speed", why: "Each question calls the model several times.", reduce: "Cache common queries, use templates, and use smaller models for extraction." },
  { risk: "Data terms", why: "Some sites limit automated access.", reduce: "Check each source’s terms. Prefer official APIs and bulk files." },
];

export interface Phase {
  phase: string;
  name: string;
  scope: string;
  team: string;
  time: string;
  /** Bar on the plan track: relative length, and whether it is open-ended. */
  span: number;
  status: "done" | "next" | "later";
  open?: boolean;
}

export const PHASES: Phase[] = [
  { phase: "0", name: "Demo", scope: "The current interactive demo, with fixed data.", team: "Done", time: "Done", span: 1, status: "done" },
  {
    phase: "1",
    name: "Data foundation",
    scope: "Federal sources: congress.gov, votes, LDA, FEC. Entity resolution for members of Congress and committees. Raw store and one Postgres database.",
    team: "2 to 3 engineers",
    time: "About 3 months",
    span: 3,
    status: "next",
  },
  {
    phase: "2",
    name: "First product",
    scope: "The AI query agent with citations, the graph and dashboard on real data, one tracked topic, watchlists and checkpoints, sign-on. Pilot with 3 to 5 design partners.",
    team: "3 to 4 engineers, 1 designer",
    time: "About 3 more months",
    span: 3,
    status: "later",
  },
  {
    phase: "3",
    name: "Coverage",
    scope: "FARA, travel, financial disclosures, statements. The human review queue. Alerts.",
    team: "4 to 6 people",
    time: "Ongoing",
    span: 4,
    status: "later",
    open: true,
  },
  {
    phase: "4",
    name: "Analysis layers",
    scope: "Sentiment over time, then prediction. Needs the history from phases 1 to 3.",
    team: "Adds data science",
    time: "After phase 3",
    span: 3,
    status: "later",
    open: true,
  },
];
