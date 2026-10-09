/**
 * The demo data shape (BUILD-SPEC.md section 3). It matches a real agent
 * response, so a real backend can replace `src/data/` later.
 */

export type EntityType = "topic" | "bill" | "person" | "category" | "detail" | "org";
export type SourceKind =
  | "FARA"
  | "LDA"
  | "FEC"
  | "CONGRESS"
  | "DISCLOSURE"
  | "TRAVEL"
  | "STATEMENT";

export interface Entity {
  id: string;
  type: EntityType;
  label: string; // "Sen. Ellen Hartley"
  sublabel?: string; // "R-OH" or "Defense Support"
  initials?: string; // persons only
  icon?: string; // lucide icon name for bill, category, detail, org
  categoryOf?: string; // for category nodes: the person id
}

export interface Edge {
  id: string;
  source: string;
  target: string;
  label: string; // "supports", "sponsored", "met with", "contributed $25,000"
  date?: string; // ISO date
  sourceIds: string[]; // SourceDoc ids that prove this edge
}

export interface SourceDoc {
  id: string;
  kind: SourceKind;
  title: string;
  date: string;
  excerpt: string;
}

export interface GraphDelta {
  add: { entities: string[]; edges: string[] };
  focus?: string; // entity id that becomes the orange focus
  expand?: string; // entity id whose children open
  /**
   * Faint context: these entities and edges render at low opacity with no
   * label (label on hover). They take no focus and do not count in the camera
   * fit. When a later delta lists one in `add`, it fades up to full in place.
   */
  ghost?: { entities: string[]; edges: string[] };
}

export interface ScriptTurn {
  id: string;
  trigger: { question?: string; keywords?: string[]; nodeClick?: string };
  steps: { label: string; delta: GraphDelta }[];
  answer: string;
  citations: string[];
  suggestions: string[];
}

/** Lookup tables for the graph engine. Build one with `buildCatalog()` in `lib/catalog.ts`. */
export interface Catalog {
  entities: Record<string, Entity>;
  edges: Record<string, Edge>;
  sources: Record<string, SourceDoc>;
}

export interface XY {
  x: number;
  y: number;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

/** The serializable state of the graph. A checkpoint stores this. */
export interface GraphSnapshot {
  entityIds: string[];
  edgeIds: string[];
  focusId?: string;
  expanded: string[];
  positions: Record<string, XY>;
  viewport?: Viewport;
  /** Ghost entities and edges (see `GraphDelta.ghost`). */
  ghostEntityIds?: string[];
  ghostEdgeIds?: string[];
}
