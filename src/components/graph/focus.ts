import type { Edge } from "@/lib/types";

export interface FocusInfo {
  /** Edges on the path from the root to the focused node (orange). */
  pathEdges: Set<string>;
  /** Nodes on that path, the root and the focus included. */
  pathNodes: Set<string>;
  /** Nodes within one hop of the focus, the focus included. */
  near: Set<string>;
  /** Edges that touch the focus. */
  nearEdges: Set<string>;
}

const EMPTY: FocusInfo = {
  pathEdges: new Set(),
  pathNodes: new Set(),
  near: new Set(),
  nearEdges: new Set(),
};

/** Shortest path (breadth-first, edges as undirected) from root to focus, plus the one-hop context. */
export function computeFocus(edges: Edge[], rootId: string | undefined, focusId: string | undefined): FocusInfo {
  if (!focusId) return EMPTY;
  const adj = new Map<string, { node: string; edge: string }[]>();
  const add = (a: string, b: string, e: string) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ node: b, edge: e });
  };
  for (const e of edges) {
    add(e.source, e.target, e.id);
    add(e.target, e.source, e.id);
  }

  const near = new Set<string>([focusId]);
  const nearEdges = new Set<string>();
  for (const n of adj.get(focusId) ?? []) {
    near.add(n.node);
    nearEdges.add(n.edge);
  }

  const pathEdges = new Set<string>();
  const pathNodes = new Set<string>([focusId]);
  if (rootId && rootId !== focusId) {
    const prev = new Map<string, { node: string; edge: string }>();
    const seen = new Set([rootId]);
    const queue = [rootId];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === focusId) break;
      for (const n of adj.get(cur) ?? []) {
        if (seen.has(n.node)) continue;
        seen.add(n.node);
        prev.set(n.node, { node: cur, edge: n.edge });
        queue.push(n.node);
      }
    }
    let cur = focusId;
    while (prev.has(cur)) {
      const p = prev.get(cur)!;
      pathEdges.add(p.edge);
      pathNodes.add(p.node);
      cur = p.node;
    }
  } else if (rootId) {
    pathNodes.add(rootId);
  }
  return { pathEdges, pathNodes, near, nearEdges };
}
