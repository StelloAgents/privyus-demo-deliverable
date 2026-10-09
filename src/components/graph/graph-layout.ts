import type { Catalog, Edge, XY } from "@/lib/types";
import { computeFocus, type FocusInfo } from "./focus";
import { computeLayout, type LayoutNode } from "./layout";

/**
 * Graph positions as a function of graph content. The demo store calls
 * `layoutGraph` once per change (a delta, a focus change), with the previous
 * positions as anchors. The same sequence of changes therefore always gives the
 * same positions, whether a turn streams step by step or a deep link replays it
 * at once. The canvas only animates toward these positions.
 */

export interface LayoutConfig {
  catalog: Catalog;
  /** The root topic. Default: the first visible topic entity. */
  rootId?: string;
  adjacency: Map<string, { node: string; edge: string }[]>;
}

/** The graph content that decides positions. */
export interface LayoutContent {
  entityIds: string[];
  edgeIds: string[];
  ghostEntityIds?: string[];
  ghostEdgeIds?: string[];
  focusId?: string;
  positions: Record<string, XY>;
  /** Nodes the user dragged: they keep their place. */
  pinned?: string[];
}

export function makeLayoutConfig(catalog: Catalog, rootId?: string): LayoutConfig {
  const adjacency = new Map<string, { node: string; edge: string }[]>();
  const add = (a: string, b: string, e: string) => {
    if (!adjacency.has(a)) adjacency.set(a, []);
    adjacency.get(a)!.push({ node: b, edge: e });
  };
  for (const e of Object.values(catalog.edges)) {
    add(e.source, e.target, e.id);
    add(e.target, e.source, e.id);
  }
  return { catalog, rootId, adjacency };
}

/** True for an edge between a person and one of their category nodes. Its label repeats the node name. */
export function isCategoryEdge(catalog: Catalog, e: Edge): boolean {
  const a = catalog.entities[e.source];
  const b = catalog.entities[e.target];
  if (!a || !b) return false;
  return (a.type === "category" && b.type === "person") || (a.type === "person" && b.type === "category");
}

export interface VisibleGraph {
  /** Real entities (in the catalog), then ghosts. */
  ids: string[];
  idSet: Set<string>;
  ghostSet: Set<string>;
  realEdges: Edge[];
  rootId?: string;
  focus: FocusInfo;
  /** The focus when it is on the graph and has a neighborhood, else undefined. */
  effectiveFocus?: string;
}

/** What the canvas draws for `g` (same rules as GraphCanvas). */
export function visibleGraph(cfg: LayoutConfig, g: Omit<LayoutContent, "positions">): VisibleGraph {
  const { catalog } = cfg;
  const realSet = new Set(g.entityIds);
  const ghostSet = new Set((g.ghostEntityIds ?? []).filter((id) => !realSet.has(id) && catalog.entities[id]));
  const ids = [...g.entityIds.filter((id) => catalog.entities[id]), ...Array.from(ghostSet)];
  const idSet = new Set(ids);
  const edgeIdList = [...g.edgeIds, ...(g.ghostEdgeIds ?? []).filter((id) => !g.edgeIds.includes(id))];
  const realEdgeSet = new Set(g.edgeIds);
  const realEdges = edgeIdList
    .map((id) => catalog.edges[id])
    .filter((e): e is Edge => !!e && idSet.has(e.source) && idSet.has(e.target))
    .filter((e) => realEdgeSet.has(e.id) && !ghostSet.has(e.source) && !ghostSet.has(e.target));
  const rootId =
    cfg.rootId && realSet.has(cfg.rootId)
      ? cfg.rootId
      : (g.entityIds.find((id) => catalog.entities[id]?.type === "topic") ?? g.entityIds[0]);
  const focusId = g.focusId && realSet.has(g.focusId) ? g.focusId : undefined;
  const focus = computeFocus(realEdges, rootId, focusId);
  return { ids, idSet, ghostSet, realEdges, rootId, focus, effectiveFocus: focus.near.size ? g.focusId : undefined };
}

/**
 * The positions of `next`, given the graph before the change (`prev`).
 * New nodes grow out of a placed neighbor; existing nodes are anchored and only
 * move aside. A focus change or a ghost that turns real re-runs the layout
 * gently. Pure: the same inputs always give the same output.
 */
export function layoutGraph(cfg: LayoutConfig, prev: LayoutContent, next: Omit<LayoutContent, "positions">): Record<string, XY> {
  const P = visibleGraph(cfg, prev);
  const N = visibleGraph(cfg, next);
  const ids = N.ids;
  const promoted = ids.some((id) => P.ghostSet.has(id) && !N.ghostSet.has(id));
  const focusChanged = N.effectiveFocus !== P.effectiveFocus;

  const current: Record<string, XY> = {};
  for (const id of ids) if (prev.positions[id]) current[id] = prev.positions[id];
  const missing = ids.some((id) => !current[id]);
  if (!missing && !focusChanged && !promoted) return current;
  if (ids.length === 0) return {};

  // The result depends only on these inputs: a replay of the same changes is a lookup.
  // (Exactly the inputs of `runLayout`.)
  const key = JSON.stringify([
    ids,
    ids.filter((id) => !P.idSet.has(id)),
    N.realEdges.map((e) => e.id),
    next.focusId ?? null,
    next.pinned ?? [],
    ids.map((id) => (current[id] ? [current[id].x, current[id].y] : null)),
  ]);
  let cache = layoutCache.get(cfg);
  if (!cache) layoutCache.set(cfg, (cache = new Map()));
  const hit = cache.get(key);
  if (hit) return { ...hit };
  const out = runLayout(cfg, P, N, next, current);
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  cache.set(key, out);
  return { ...out };
}

let layoutCache = new WeakMap<LayoutConfig, Map<string, Record<string, XY>>>();

/** Forgets every cached layout (the determinism check compares uncached runs). */
export function clearLayoutCache(): void {
  layoutCache = new WeakMap();
}

function runLayout(
  cfg: LayoutConfig,
  P: VisibleGraph,
  N: VisibleGraph,
  next: Omit<LayoutContent, "positions">,
  current: Record<string, XY>,
): Record<string, XY> {
  const { catalog, adjacency } = cfg;
  const ids = N.ids;
  const newIds = ids.filter((id) => !P.idSet.has(id));

  // Parent of each new node: a visible neighbor that was placed before it.
  // Prefers the focus, then the newest placed neighbor.
  const order = new Map(ids.map((id, i) => [id, i]));
  const parentOf: Record<string, string | undefined> = {};
  const unplaced = new Set(ids.filter((id) => !current[id]));
  for (const id of unplaced) {
    const nbrs = (adjacency.get(id) ?? []).map((n) => n.node).filter((n) => N.idSet.has(n) && n !== id);
    const placedNbrs = nbrs.filter((n) => !unplaced.has(n));
    const pool = placedNbrs.length ? placedNbrs : nbrs.filter((n) => (order.get(n) ?? 0) < (order.get(id) ?? 0));
    parentOf[id] =
      next.focusId && pool.includes(next.focusId)
        ? next.focusId
        : pool.sort((a, b) => (order.get(b) ?? 0) - (order.get(a) ?? 0))[0];
  }
  // Layout links: every catalog edge between visible nodes, so the layout does
  // not jump when an edge appears later.
  const links: { source: string; target: string }[] = [];
  for (const e of Object.values(catalog.edges)) {
    if (N.idSet.has(e.source) && N.idSet.has(e.target)) links.push({ source: e.source, target: e.target });
  }
  const nodes: LayoutNode[] = ids.map((id) => ({
    id,
    type: catalog.entities[id].type,
    parent: parentOf[id],
    label: catalog.entities[id].label,
    sublabel: catalog.entities[id].sublabel,
  }));
  const pathEdges = N.realEdges.filter((e) => N.focus.pathEdges.has(e.id));
  return computeLayout({
    nodes,
    links,
    current,
    pinned: new Set(next.pinned ?? []),
    rootId: N.rootId,
    // Only moving existing nodes aside: a gentler run.
    alpha: newIds.length === 0 && unplaced.size === 0 ? 0.3 : 0.6,
    // No node may sit on a focus-path edge.
    pathEdges: pathEdges.map((e) => ({ source: e.source, target: e.target })),
    // Focus-path edge labels are collision bodies.
    labelEdges: pathEdges
      .filter((e) => !isCategoryEdge(catalog, e))
      .map((e) => ({ source: e.source, target: e.target, label: e.label })),
  });
}
