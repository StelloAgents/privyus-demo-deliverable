/**
 * Content for the hidden /technical page. The source of truth is
 * technical-architecture.md in the project root. Scale figures are
 * order-of-magnitude estimates and stay in words; do not add precise numbers.
 */
import type { LucideIcon } from "lucide-react";
import { FileSearch, Gauge, GitMerge } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Sections (table of contents)                                        */
/* ------------------------------------------------------------------ */

export const SECTIONS = [
  { id: "summary", label: "Summary" },
  { id: "scale", label: "Data volume" },
  { id: "system", label: "System layers" },
  { id: "resolution", label: "Entity resolution" },
  { id: "data-model", label: "Data model" },
  { id: "agents", label: "Agent access" },
  { id: "stores", label: "Stores" },
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
  { tool: "search_entities", returns: "People, organizations, bills, and filings that match a name or a topic" },
  { tool: "get_profile", returns: "One entity with its category counts (votes, trips, meetings, contributions)" },
  { tool: "expand_connections", returns: "The one-hop neighbors of an entity, filtered by edge type and date" },
  { tool: "get_sources", returns: "The original filings behind an edge, with URL, fetch time, and hash" },
  { tool: "find_path", returns: "The shortest documented chain between two entities" },
  { tool: "watch", returns: "Notifications when a new record about an entity arrives" },
];

/* ------------------------------------------------------------------ */
/* Stores                                                              */
/* ------------------------------------------------------------------ */

export const STORES = [
  { store: "Raw document store", holds: "Every original filing", answers: "“Show me the source”", tech: "Amazon S3" },
  { store: "Graph database", holds: "People, organizations, bills, events, and edges", answers: "“How is A connected to B?”", tech: "Neo4j or Amazon Neptune" },
  { store: "Search and vector index", holds: "Full text and embeddings", answers: "“Find statements about Ukraine aid”", tech: "OpenSearch or pgvector" },
  { store: "Analytics warehouse", holds: "Counts and trends over time", answers: "Dashboard counters, Radar, trends", tech: "ClickHouse, Snowflake, or BigQuery" },
  { store: "App database", holds: "Users, watchlists, checkpoints", answers: "The personal workspace", tech: "Postgres" },
];
