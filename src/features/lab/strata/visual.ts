import { EDGES, NODES, OVERVIEW_LABELS, edgeBetween, edgesOf, focusPath, otherEnd } from "./graph";

export type NodeRole = "focus" | "path" | "near" | "dim" | "base" | "context";
export type EdgeRole = "path" | "near" | "dim" | "base" | "context";

export interface Visual {
  path: string[];
  pathEdges: { id: string; from: string }[];
  node: Map<string, NodeRole>;
  edge: Map<string, EdgeRole>;
  cards: string[];
  edgeLabels: { edgeId: string; from: string }[];
}

const MAX_CARDS = 14;

/** Roles for every node and edge, from the focused node. Pure, so it is easy to reason about. */
export function computeVisual(focus: string | null): Visual {
  const node = new Map<string, NodeRole>();
  const edge = new Map<string, EdgeRole>();
  if (!focus) {
    for (const n of NODES) node.set(n.id, n.context ? "context" : "base");
    for (const ed of EDGES) {
      const ctx = node.get(ed.source) === "context" || node.get(ed.target) === "context";
      edge.set(ed.id, ctx ? "context" : "base");
    }
    return { path: [], pathEdges: [], node, edge, cards: OVERVIEW_LABELS, edgeLabels: [] };
  }

  const path = focusPath(focus);
  const pathEdges: { id: string; from: string }[] = [];
  for (let i = 1; i < path.length; i++) {
    const ed = edgeBetween(path[i - 1], path[i]);
    if (ed) pathEdges.push({ id: ed.id, from: path[i - 1] });
  }
  const pathEdgeIds = new Set(pathEdges.map((p) => p.id));
  const near = edgesOf(focus).map((ed) => otherEnd(ed, focus));

  for (const n of NODES) node.set(n.id, "dim");
  for (const id of near) node.set(id, "near");
  for (const id of path) node.set(id, "path");
  node.set(focus, "focus");

  for (const ed of EDGES) {
    if (pathEdgeIds.has(ed.id)) edge.set(ed.id, "path");
    else if (ed.source === focus || ed.target === focus) edge.set(ed.id, "near");
    else edge.set(ed.id, "dim");
  }

  // Cards: the focused node, then its path back to the root, then its neighbors.
  const cards: string[] = [];
  const STORY = ["meeting-private", "contrib-aegis", "trip-kyiv", "vote-s456", "contrib-boreal", "contrib-redwood", "attendee-aegis", "attendee-meridian", "attendee-atlantic"];
  const rank = (id: string) => (STORY.includes(id) ? STORY.indexOf(id) : 100);
  const nearSorted = [...near].sort((a, b) => rank(a) - rank(b));
  for (const id of [focus, ...[...path].reverse(), ...nearSorted]) {
    if (!cards.includes(id) && cards.length < MAX_CARDS) cards.push(id);
  }

  // Edge labels: the focused node's edges, one label per relationship phrase,
  // so a node with many records stays readable. The path edge always shows.
  const seen = new Set<string>();
  const edgeLabels: { edgeId: string; from: string }[] = [];
  const own = edgesOf(focus).sort((a, b) => Number(pathEdgeIds.has(b.id)) - Number(pathEdgeIds.has(a.id)));
  for (const ed of own) {
    if (seen.has(ed.label)) continue;
    seen.add(ed.label);
    edgeLabels.push({ edgeId: ed.id, from: focus });
  }

  return { path, pathEdges, node, edge, cards, edgeLabels };
}

export const NODE_OPACITY: Record<NodeRole, number> = {
  focus: 1,
  path: 1,
  near: 0.92,
  dim: 0.18,
  base: 0.9,
  context: 0.32,
};

export const EDGE_OPACITY: Record<EdgeRole, number> = {
  path: 1,
  near: 0.62,
  dim: 0.1,
  base: 0.34,
  context: 0.14,
};
