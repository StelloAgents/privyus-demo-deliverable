/**
 * What a WebGL graph draws, for code that reads the screen (the presenter
 * caption placement). DOM graphs need none of this: their nodes and edges are
 * elements. The orbit graph registers a sampler for its edges, which are drawn
 * on the canvas and have no elements.
 */
export interface EdgePoint {
  /** Client (viewport) coordinates. */
  x: number;
  y: number;
  /** How strongly the edge draws: the orange focus path, a full edge, or faint context. */
  weight: "path" | "full" | "faint";
}

let sampler: (() => EdgePoint[]) | null = null;

/** Registers the edge sampler of the graph on screen. Returns the unregister function. */
export function registerEdgeSampler(fn: () => EdgePoint[]): () => void {
  sampler = fn;
  return () => {
    if (sampler === fn) sampler = null;
  };
}

/** Points along every drawn canvas edge, about 10px apart. Empty when no canvas graph is on screen. */
export function sampleCanvasEdges(): EdgePoint[] {
  return sampler?.() ?? [];
}
