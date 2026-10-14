"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  useStoreApi,
  type NodeChange,
  type NodeMouseHandler,
  type OnNodeDrag,
  type EdgeMouseHandler,
  type Viewport as RFViewport,
} from "@xyflow/react";
import { MOTION, easeOutExpo, useReducedMotion } from "@/lib/motion";
import { graphMotion } from "@/lib/graph-motion";
import { useDemoStore } from "@/lib/store";
import type { Catalog, Edge, Entity, Viewport, XY } from "@/lib/types";
import { computeFocus } from "./focus";
import { NODE_SIZE, nodeBox } from "./geometry";
import { GhostHints } from "./GhostHints";
import { computeLayout, type LayoutNode } from "./layout";
import { GraphActionsContext, nodeTypes, type PrivyNode, type PrivyNodeData } from "./nodes";
import { LabelObstaclesContext, edgeTypes, type PrivyEdgeType, type Rect } from "./PrivyEdge";

/** A graph to show. Omit it on `GraphCanvas` to show the shared demo store. */
export interface GraphView {
  entityIds: string[];
  edgeIds: string[];
  focusId?: string;
  positions?: Record<string, XY>;
  viewport?: Viewport;
  motion?: "animate" | "instant";
  revision?: number;
  /** Changes when a whole graph is loaded with exact positions (checkpoint, deep link, presenter step state). */
  loadToken?: number;
  /** Ghost context (GraphDelta.ghost): faint, no label, no focus, not in the camera fit. */
  ghostEntityIds?: string[];
  ghostEdgeIds?: string[];
}

export interface GraphCanvasProps {
  catalog: Catalog;
  /** Controlled graph. Omit it to read and write the demo store (`useDemoStore`). */
  view?: GraphView;
  /** The root topic. Default: the first visible topic entity. */
  rootId?: string;
  /** Click on a node (not a drag). */
  onNodeClick?: (id: string, entity: Entity) => void;
  /** Click on a node's "+" control. Without it, no "+" shows. */
  onExpand?: (id: string) => void;
  /** Faint dots for unloaded neighbors (2.10). Default true. */
  ghostHints?: boolean;
  /** Pan, zoom, and drag. Default true. False for small previews. */
  interactive?: boolean;
  /** "auto": fit on build, ease to the focus. "fit": always fit all. "none": fit once. */
  camera?: "auto" | "fit" | "none";
  /** Space (px) taken by overlays such as a header. The camera keeps nodes out of it. */
  insets?: { top?: number; right?: number; bottom?: number; left?: number };
  /** Space (px) kept free on each side, inside the insets, when the camera fits. Default 64. */
  fitPadding?: number;
  className?: string;
  /** Overlays drawn above the canvas (header, hints). */
  children?: ReactNode;
}

type EnterInfo = { delay: number; animate: boolean };
type Scene = {
  ids: string[];
  positions: Record<string, XY>;
  enter: Record<string, EnterInfo>;
  /** Edges that draw in (new in the last change). */
  edgeEnter: Record<string, EnterInfo>;
};

type Tween = { from: XY; to: XY; start: number; delay: number; dur: number };

/**
 * Minimum zoom in a focused state: the smallest node label is 12px, so this
 * keeps every node label at 11px or more on screen.
 */
const MIN_READABLE_ZOOM = 11 / 12;
const MAX_FOCUS_ZOOM = 1.15;

const EMPTY_SCENE: Scene = { ids: [], positions: {}, enter: {}, edgeEnter: {} };

/** True for an edge between a person and one of their category nodes. Its label repeats the node name. */
function isCategoryEdgeIn(catalog: Catalog, e: Edge): boolean {
  const a = catalog.entities[e.source];
  const b = catalog.entities[e.target];
  if (!a || !b) return false;
  return (a.type === "category" && b.type === "person") || (a.type === "person" && b.type === "category");
}

function useAdjacency(catalog: Catalog) {
  return useMemo(() => {
    const adj = new Map<string, { node: string; edge: string }[]>();
    const add = (a: string, b: string, e: string) => {
      if (!adj.has(a)) adj.set(a, []);
      adj.get(a)!.push({ node: b, edge: e });
    };
    for (const e of Object.values(catalog.edges)) {
      add(e.source, e.target, e.id);
      add(e.target, e.source, e.id);
    }
    return adj;
  }, [catalog]);
}

function GraphCanvasInner({
  catalog,
  view: viewProp,
  rootId: rootProp,
  onNodeClick,
  onExpand,
  ghostHints = true,
  interactive = true,
  camera = "auto",
  insets,
  fitPadding = 64,
  className,
  children,
}: GraphCanvasProps) {
  const storeGraph = useDemoStore((s) => s.graph);
  const setStorePositions = useDemoStore((s) => s.setPositions);
  const setStoreViewport = useDemoStore((s) => s.setViewport);
  const usingStore = !viewProp;
  const view: GraphView = viewProp ?? storeGraph;
  const reduced = useReducedMotion();
  const rf = useReactFlow<PrivyNode, PrivyEdgeType>();
  const rfStore = useStoreApi();
  const adjacency = useAdjacency(catalog);
  const isCategoryEdge = useCallback((e: Edge) => isCategoryEdgeIn(catalog, e), [catalog]);

  const [scene, setScene] = useState<Scene>(EMPTY_SCENE);
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);

  const posRef = useRef<Map<string, XY>>(new Map());
  const knownRef = useRef<Set<string>>(new Set());
  const knownEdgesRef = useRef<Set<string>>(new Set());
  /** Ids that were ghosts at the last commit (to detect ghost to real). */
  const ghostKnownRef = useRef<Set<string>>(new Set());
  const pinnedRef = useRef<Set<string>>(new Set());
  const tweensRef = useRef<Map<string, Tween>>(new Map());
  const rafRef = useRef(0);
  const lastFocusRef = useRef<string | undefined>(undefined);
  const pendingCameraRef = useRef<{
    targets: Record<string, XY>;
    focusId: string | undefined;
    ids: string[];
    immediate: boolean;
  } | null>(null);
  const firstLayoutRef = useRef(true);
  const loadTokenRef = useRef<number | undefined>(undefined);
  /** The positions the nodes move toward (the last layout). */
  const targetsRef = useRef<Record<string, XY>>({});

  /* ------------------------- derived (render) ------------------------- */

  const ghostEntityList = view.ghostEntityIds;
  const ghostEdgeList = view.ghostEdgeIds;
  const realSet = useMemo(() => new Set(view.entityIds), [view.entityIds]);
  const ghostSet = useMemo(
    () => new Set((ghostEntityList ?? []).filter((id) => !realSet.has(id) && catalog.entities[id])),
    [ghostEntityList, realSet, catalog],
  );
  const visibleEntities = useMemo(
    () => [...view.entityIds.filter((id) => catalog.entities[id]), ...Array.from(ghostSet)],
    [view.entityIds, ghostSet, catalog],
  );
  const visibleSet = useMemo(() => new Set(visibleEntities), [visibleEntities]);
  const visibleEdges = useMemo(() => {
    const ids = [...view.edgeIds, ...(ghostEdgeList ?? []).filter((id) => !view.edgeIds.includes(id))];
    return ids
      .map((id) => catalog.edges[id])
      .filter((e): e is Edge => !!e && visibleSet.has(e.source) && visibleSet.has(e.target));
  }, [view.edgeIds, ghostEdgeList, catalog, visibleSet]);
  const realEdgeSet = useMemo(() => new Set(view.edgeIds), [view.edgeIds]);
  const isGhostEdge = useCallback(
    (e: Edge) => !realEdgeSet.has(e.id) || ghostSet.has(e.source) || ghostSet.has(e.target),
    [realEdgeSet, ghostSet],
  );
  const realEdges = useMemo(() => visibleEdges.filter((e) => !isGhostEdge(e)), [visibleEdges, isGhostEdge]);
  const rootId = useMemo(
    () =>
      rootProp && realSet.has(rootProp)
        ? rootProp
        : (view.entityIds.find((id) => catalog.entities[id]?.type === "topic") ?? view.entityIds[0]),
    [rootProp, realSet, view.entityIds, catalog],
  );
  const focus = useMemo(
    () => computeFocus(realEdges, rootId, view.focusId && realSet.has(view.focusId) ? view.focusId : undefined),
    [realEdges, rootId, view.focusId, realSet],
  );
  const ghostIds = useMemo(() => {
    if (!ghostHints) return [];
    const out = new Set<string>();
    for (const id of visibleEntities) {
      for (const n of adjacency.get(id) ?? []) if (!visibleSet.has(n.node)) out.add(n.node);
    }
    return Array.from(out).slice(0, 28);
  }, [ghostHints, visibleEntities, visibleSet, adjacency]);

  /* ----------------------------- camera ----------------------------- */

  const cameraTo = useCallback(
    (targets: Record<string, XY>, focusId: string | undefined, ids: string[], immediate: boolean) => {
      const { width, height } = rfStore.getState();
      if (ids.length === 0) return;
      if (!width || !height) {
        // The canvas is not measured yet (first paint, deep link): run when it is.
        pendingCameraRef.current = { targets, focusId, ids, immediate };
        return;
      }
      const duration = immediate || reduced ? 0 : MOTION.cameraMs;
      const pad = {
        top: insets?.top ?? 0,
        right: insets?.right ?? 0,
        bottom: insets?.bottom ?? 0,
        left: insets?.left ?? 0,
      };
      const availW = Math.max(200, width - pad.left - pad.right);
      const availH = Math.max(200, height - pad.top - pad.bottom);

      const boxOf = (list: string[]) => {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const id of list) {
          const p = targets[id];
          const e = catalog.entities[id];
          if (!p || !e) continue;
          const b = nodeBox(e.type, e.label, e.sublabel);
          x0 = Math.min(x0, p.x - b.w / 2);
          x1 = Math.max(x1, p.x + b.w / 2);
          y0 = Math.min(y0, p.y - NODE_SIZE[e.type] / 2);
          y1 = Math.max(y1, p.y - NODE_SIZE[e.type] / 2 + b.h);
        }
        return isFinite(x0) ? { x0, y0, x1, y1 } : null;
      };
      // The free area inside the canvas: insets plus `fitPadding` on each side.
      const PAD = fitPadding;
      const freeW = Math.max(160, availW - PAD * 2);
      const freeH = Math.max(160, availH - PAD * 2);
      const zoomFor = (b: { x0: number; y0: number; x1: number; y1: number }) =>
        Math.min(MAX_FOCUS_ZOOM, freeW / (b.x1 - b.x0), freeH / (b.y1 - b.y0));
      // Center of the free area, in flow units, given the insets.
      const centerAt = (fx: number, fy: number, zoom: number) => {
        const cx = fx - (pad.left - pad.right) / 2 / zoom;
        const cy = fy - (pad.top - pad.bottom) / 2 / zoom;
        if (usingStore && duration) graphMotion.camera(duration);
        rf.setCenter(cx, cy, { zoom, duration, ease: easeOutExpo });
      };

      // Ghosts never count in the fit.
      const real = ids.filter((id) => !ghostSet.has(id));
      const all = boxOf(real);
      if (!all) return;

      if (focusId && targets[focusId] && camera === "auto") {
        // 1. When the whole (non-ghost) graph fits at a readable zoom, show all of it.
        const zAll = zoomFor(all);
        if (zAll >= MIN_READABLE_ZOOM) {
          centerAt((all.x0 + all.x1) / 2, (all.y0 + all.y1) / 2, zAll);
          return;
        }
        // 2. Else fit the focus, its children, and its parent, never below the readable zoom.
        //    The breadcrumb carries the path context, so the root may leave the view.
        const near = [focusId];
        for (const n of adjacency.get(focusId) ?? []) {
          if (targets[n.node] && !ghostSet.has(n.node) && visibleSet.has(n.node)) near.push(n.node);
        }
        const local = boxOf(near)!;
        const pathIds = Array.from(focus.pathNodes).filter((id) => targets[id] && !ghostSet.has(id));

        // Visible labels: the focus neighborhood and the path to the root.
        const MARGIN = 12;
        const labelBoxes: { x0: number; x1: number; y0: number; y1: number; nodeBottom: number }[] = [];
        for (const id of new Set([...near, ...pathIds])) {
          const p = targets[id];
          const e = catalog.entities[id];
          if (!p || !e || ghostSet.has(id)) continue;
          const b = nodeBox(e.type, e.label, e.sublabel);
          const r = NODE_SIZE[e.type] / 2;
          labelBoxes.push({ x0: p.x - b.w / 2, x1: p.x + b.w / 2, y0: p.y - r, y1: p.y - r + b.h, nodeBottom: p.y + r });
        }

        /**
         * For zoom z: center on the focus neighborhood (focus, children,
         * parent), then move so each visible label is either inside the safe
         * area (insets + 12px) or fully outside the canvas. Returns whether
         * every label ended clean.
         */
        const solve = (z: number) => {
          const halfW = freeW / 2 / z;
          const halfH = freeH / 2 / z;
          const keep = local.x1 - local.x0 <= halfW * 2 && local.y1 - local.y0 <= halfH * 2 ? local : boxOf([focusId])!;
          let x = Math.min(Math.max((local.x0 + local.x1) / 2, keep.x1 - halfW), keep.x0 + halfW);
          let y = Math.min(Math.max((local.y0 + local.y1) / 2, keep.y1 - halfH), keep.y0 + halfH);
          const vW = (availW - MARGIN * 2) / 2 / z;
          const vH = (availH - MARGIN * 2) / 2 / z;
          const canL = (pad.left + availW / 2) / z;
          const canR = (pad.right + availW / 2) / z;
          const canT = (pad.top + availH / 2) / z;
          const canB = (pad.bottom + availH / 2) / z;
          const keepOk = (nx: number, ny: number) =>
            keep.x0 >= nx - vW && keep.x1 <= nx + vW && keep.y0 >= ny - vH && keep.y1 <= ny + vH;
          const issues = (nx: number, ny: number, b: (typeof labelBoxes)[number]) => {
            const opts: { dx: number; dy: number }[] = [];
            // The whole node (circle and label) is either inside the safe area or fully out of view.
            if (b.y1 > ny + vH && b.y0 < ny + canB) opts.push({ dx: 0, dy: b.y1 - (ny + vH) }, { dx: 0, dy: b.y0 - (ny + canB) });
            if (b.y0 < ny - vH && b.y1 > ny - canT) opts.push({ dx: 0, dy: b.y0 - (ny - vH) }, { dx: 0, dy: b.y1 - (ny - canT) });
            if (b.x0 < nx - vW && b.x1 > nx - canL) opts.push({ dx: b.x0 - (nx - vW), dy: 0 }, { dx: b.x1 - (nx - canL), dy: 0 });
            if (b.x1 > nx + vW && b.x0 < nx + canR) opts.push({ dx: b.x1 - (nx + vW), dy: 0 }, { dx: b.x0 - (nx + canR), dy: 0 });
            return opts;
          };
          for (let pass = 0; pass < 6; pass++) {
            let moved = false;
            for (const b of labelBoxes) {
              const opts = issues(x, y, b).sort((a, c) => Math.hypot(a.dx, a.dy) - Math.hypot(c.dx, c.dy));
              const ok = opts.find((o) => keepOk(x + o.dx, y + o.dy));
              if (ok) {
                x += ok.dx;
                y += ok.dy;
                moved = true;
              }
            }
            if (!moved) break;
          }
          const clean = labelBoxes.every((b) => issues(x, y, b).length === 0);
          return { x, y, clean };
        };

        // Largest zoom (up to the neighborhood fit) where every label is clean;
        // never below the readable zoom.
        const zTop = Math.max(MIN_READABLE_ZOOM, Math.min(zoomFor(local), MAX_FOCUS_ZOOM));
        let z = zTop;
        let sol = solve(z);
        for (let zz = zTop - 0.05; !sol.clean && zz >= MIN_READABLE_ZOOM - 1e-6; zz -= 0.05) {
          const t = solve(zz);
          if (t.clean) {
            z = zz;
            sol = t;
          }
        }
        if (!sol.clean) {
          z = zTop;
          sol = solve(zTop);
        }
        const cx = sol.x;
        const cy = sol.y;
        centerAt(cx, cy, z);
        return;
      }

      // Fit everything (no focus, or camera="fit"): every non-ghost node inside the insets.
      const zoom = Math.max(0.3, Math.min(zoomFor(all), 1.1));
      centerAt((all.x0 + all.x1) / 2, (all.y0 + all.y1) / 2, zoom);
    },
    [rf, rfStore, reduced, camera, insets, adjacency, catalog, fitPadding, ghostSet, visibleSet, focus, usingStore],
  );

  // Run a camera move that waited for the canvas to be measured.
  const measured = useStore((st) => st.width > 0 && st.height > 0);
  useEffect(() => {
    const p = pendingCameraRef.current;
    if (!measured || !p) return;
    pendingCameraRef.current = null;
    const frame = requestAnimationFrame(() => cameraTo(p.targets, p.focusId, p.ids, p.immediate));
    return () => cancelAnimationFrame(frame);
  }, [measured, cameraTo]);

  /* ----------------------------- tweens ----------------------------- */

  const runTweens = useCallback(
    (onDone: () => void) => {
      cancelAnimationFrame(rafRef.current);
      const step = (now: number) => {
        const next: Record<string, XY> = {};
        tweensRef.current.forEach((tw, id) => {
          if (!tw.start) tw.start = now;
          const t = (now - tw.start - tw.delay) / tw.dur;
          let p: XY;
          if (t <= 0) p = tw.from;
          else if (t >= 1) {
            p = tw.to;
            tweensRef.current.delete(id);
          } else {
            const k = easeOutExpo(t);
            p = { x: tw.from.x + (tw.to.x - tw.from.x) * k, y: tw.from.y + (tw.to.y - tw.from.y) * k };
          }
          next[id] = p;
          posRef.current.set(id, p);
        });
        setScene((prev) => ({ ...prev, positions: { ...prev.positions, ...next } }));
        if (tweensRef.current.size) rafRef.current = requestAnimationFrame(step);
        else {
          rafRef.current = 0;
          onDone();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [],
  );

  /* ---------------------- layout on graph change ---------------------- */

  useEffect(() => {
    const ids = visibleEntities;
    const known = knownRef.current;
    const newIds = ids.filter((id) => !known.has(id));
    const removed = Array.from(known).filter((id) => !visibleSet.has(id));
    const knownEdges = knownEdgesRef.current;
    const newEdgeIds = visibleEdges.map((e) => e.id).filter((id) => !knownEdges.has(id));
    const visibleEdgeIdSet = new Set(visibleEdges.map((e) => e.id));
    const focusId = focus.near.size ? view.focusId : undefined;
    const focusChanged = focusId !== lastFocusRef.current;
    // Ghosts that the script now added for real: they count as a graph change
    // for the layout and the camera (they fade up in place).
    const promoted = ids.filter((id) => known.has(id) && ghostKnownRef.current.has(id) && !ghostSet.has(id));
    const ghostNow = new Set(ghostSet);
    const revision = view.revision ?? 0;
    // Positions laid out by the store (a function of the graph content): the
    // canvas only moves nodes toward them. Without them (no layout configured),
    // the canvas lays the graph out itself.
    const given = view.positions ?? {};
    const laidOut = ids.length > 0 && ids.every((id) => given[id]);
    const lastTargets = targetsRef.current;
    const targetsMoved =
      laidOut && ids.some((id) => known.has(id) && lastTargets[id] && (lastTargets[id].x !== given[id].x || lastTargets[id].y !== given[id].y));

    // A whole-graph load with exact positions (checkpoint, deep link, presenter step state):
    // place every node at its saved position and restore the saved viewport.
    const loaded = view.loadToken !== undefined && view.loadToken !== loadTokenRef.current && view.motion === "instant";
    if (loaded && laidOut) {
      const frame = requestAnimationFrame(() => {
        loadTokenRef.current = view.loadToken;
        known.clear();
        ids.forEach((id) => known.add(id));
        knownEdges.clear();
        visibleEdges.forEach((e) => knownEdges.add(e.id));
        ghostKnownRef.current = new Set(ghostSet);
        lastFocusRef.current = focusId;
        firstLayoutRef.current = false;
        tweensRef.current.clear();
        posRef.current = new Map(ids.map((id) => [id, given[id]]));
        targetsRef.current = { ...given };
        const enter: Scene["enter"] = {};
        setScene({ ids, positions: { ...given }, enter, edgeEnter: {} });
        if (view.viewport) rf.setViewport(view.viewport, { duration: 0 });
        else cameraTo(given, focusId, ids, true);
        if (usingStore) graphMotion.processed(revision);
      });
      return () => cancelAnimationFrame(frame);
    }

    if (
      newIds.length === 0 &&
      removed.length === 0 &&
      newEdgeIds.length === 0 &&
      promoted.length === 0 &&
      !focusChanged &&
      !targetsMoved
    ) {
      if (usingStore) graphMotion.processed(revision);
      return;
    }

    const frame = requestAnimationFrame(() => {
      loadTokenRef.current = view.loadToken;
      // Commit the diff now (not in the effect body) so a re-run of the effect is safe.
      removed.forEach((id) => {
        known.delete(id);
        posRef.current.delete(id);
        tweensRef.current.delete(id);
        pinnedRef.current.delete(id);
      });
      newIds.forEach((id) => known.add(id));
      ghostKnownRef.current = ghostNow;
      for (const id of Array.from(knownEdges)) if (!visibleEdgeIdSet.has(id)) knownEdges.delete(id);
      newEdgeIds.forEach((id) => knownEdges.add(id));
      const animateEdges = view.motion !== "instant";
      const edgeEnterFor = (childEnter: Record<string, EnterInfo>) => {
        const out: Record<string, EnterInfo> = {};
        let k = 0;
        for (const e of visibleEdges) {
          if (!newEdgeIds.includes(e.id)) continue;
          const child = childEnter[e.target] ?? childEnter[e.source];
          out[e.id] = {
            delay: reduced ? 0 : (child?.delay ?? k++ * MOTION.childStaggerMs),
            animate: animateEdges && (child ? child.animate : true),
          };
        }
        return out;
      };
      lastFocusRef.current = focusId;
      const firstLayout = firstLayoutRef.current;
      firstLayoutRef.current = false;

      // A focus change or a ghost promotion re-runs the layout (anchored, so
      // nodes only move aside) and the camera, the same way new nodes do.
      const relayout = focusChanged || promoted.length > 0 || targetsMoved;
      if (newIds.length === 0 && !relayout) {
        if (removed.length || newEdgeIds.length) {
          const edgeEnter = edgeEnterFor({});
          setScene((prev) => ({ ...prev, ids, edgeEnter }));
          if (newEdgeIds.length) {
            setTimeout(
              () => setScene((prev) => ({ ...prev, edgeEnter: {} })),
              MOTION.edgeDrawMs + newEdgeIds.length * MOTION.childStaggerMs + 200,
            );
          }
          // New edges can change the focus path the camera frames: frame again, so the
          // final view is a function of the final graph (a replayed state frames the same).
          if (laidOut && camera === "auto") cameraTo(targetsRef.current, focusId, ids, view.motion === "instant");
        }
        if (usingStore) graphMotion.processed(revision);
        return;
      }

      // Parent of each new node: a visible neighbor that was placed before it.
      // Uses the catalog edges, so a node finds its parent even when the
      // script adds the edge in a later step. Prefers the focus, then the
      // newest placed neighbor.
      const order = new Map(ids.map((id, i) => [id, i]));
      const parentOf: Record<string, string | undefined> = {};
      const newSet = new Set(newIds);
      const prefer = view.focusId;
      for (const id of newIds) {
        const nbrs = (adjacency.get(id) ?? []).map((n) => n.node).filter((n) => visibleSet.has(n) && n !== id);
        const placedNbrs = nbrs.filter((n) => !newSet.has(n));
        const pool = placedNbrs.length
          ? placedNbrs
          : nbrs.filter((n) => (order.get(n) ?? 0) < (order.get(id) ?? 0));
        parentOf[id] =
          prefer && pool.includes(prefer)
            ? prefer
            : pool.sort((a, b) => (order.get(b) ?? 0) - (order.get(a) ?? 0))[0];
      }
      // Layout links: every catalog edge between visible nodes, so the layout
      // does not jump when an edge appears later.
      const layoutLinks: { source: string; target: string }[] = [];
      for (const e of Object.values(catalog.edges)) {
        if (visibleSet.has(e.source) && visibleSet.has(e.target)) layoutLinks.push({ source: e.source, target: e.target });
      }

      const instant = laidOut ? view.motion === "instant" : view.motion === "instant" || newIds.every((id) => given[id]);
      const current: Record<string, XY> = {};
      for (const id of ids) {
        if (posRef.current.has(id)) current[id] = posRef.current.get(id)!;
        else if (given[id]) current[id] = given[id];
      }
      const nodesForLayout: LayoutNode[] = ids.map((id) => ({
        id,
        type: catalog.entities[id].type,
        parent: parentOf[id],
        label: catalog.entities[id].label,
        sublabel: catalog.entities[id].sublabel,
      }));
      const needsLayout = !laidOut && (relayout || ids.some((id) => !current[id]));
      const targets = laidOut
        ? given
        : needsLayout
        ? computeLayout({
            nodes: nodesForLayout,
            links: layoutLinks,
            current,
            pinned: pinnedRef.current,
            rootId,
            // Only moving existing nodes aside: a gentler run.
            alpha: newIds.length === 0 ? 0.3 : 0.6,
            // No node may sit on a focus-path edge.
            pathEdges: realEdges
              .filter((e) => focus.pathEdges.has(e.id))
              .map((e) => ({ source: e.source, target: e.target })),
            // Focus-path edge labels are collision bodies.
            labelEdges: realEdges
              .filter((e) => focus.pathEdges.has(e.id) && !isCategoryEdge(e))
              .map((e) => ({ source: e.source, target: e.target, label: e.label })),
          })
        : current;
      targetsRef.current = { ...targets };

      const animate = !instant;
      const enter: Scene["enter"] = {};
      newIds.forEach((id, i) => {
        enter[id] = { delay: animate && !reduced ? i * MOTION.childStaggerMs : 0, animate };
      });
      const edgeEnter = edgeEnterFor(enter);

      if (!animate) {
        tweensRef.current.clear();
        for (const id of ids) posRef.current.set(id, targets[id]);
        setScene({ ids, positions: { ...targets }, enter, edgeEnter });
        if (firstLayout && view.viewport && camera !== "fit") {
          rf.setViewport(view.viewport, { duration: 0 });
        } else if (camera !== "none" || firstLayout) {
          cameraTo(targets, focusId, ids, true);
        }
        if (usingStore) graphMotion.processed(revision);
        return;
      }

      // Animated: new nodes travel from their parent; existing nodes move aside.
      for (const id of ids) {
        const to = targets[id];
        if (newSet.has(id)) {
          const parent = parentOf[id];
          const from = (parent && (posRef.current.get(parent) ?? targets[parent])) || to;
          if (reduced) {
            posRef.current.set(id, to);
          } else {
            tweensRef.current.set(id, { from, to, start: 0, delay: enter[id].delay, dur: MOTION.nodeTravelMs });
            posRef.current.set(id, from);
          }
        } else {
          const from = posRef.current.get(id) ?? to;
          if (Math.hypot(from.x - to.x, from.y - to.y) < 0.5) continue;
          if (reduced) posRef.current.set(id, to);
          else tweensRef.current.set(id, { from, to, start: 0, delay: 0, dur: MOTION.settleMs });
        }
      }
      setScene({ ids, positions: Object.fromEntries(posRef.current), enter, edgeEnter });
      if (camera !== "none" || firstLayout) cameraTo(targets, focusId, ids, false);

      const finish = () => {
        if (usingStore) graphMotion.tweening(false);
        // Clear the enter flags so nothing replays on a remount.
        setTimeout(() => {
          setScene((prev) => {
            const cleared: Scene["enter"] = {};
            for (const k of Object.keys(prev.enter)) cleared[k] = { delay: 0, animate: false };
            return { ...prev, enter: cleared, edgeEnter: {} };
          });
        }, MOTION.edgeDrawMs + 200);
      };
      if (tweensRef.current.size) {
        if (usingStore) graphMotion.tweening(true);
        runTweens(finish);
      } else finish();
      if (usingStore) graphMotion.processed(revision);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleEntities, visibleEdges, view.focusId, view.revision, view.motion, view.loadToken]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);
  // Presenter steps wait for the store's graph to come to rest.
  useEffect(() => (usingStore ? graphMotion.mount() : undefined), [usingStore]);

  /* ------------------------- React Flow props ------------------------- */

  const dataCache = useRef<Map<string, { sig: string; data: PrivyNodeData }>>(new Map());
  const [nodeDataMap, setNodeDataMap] = useState<Record<string, PrivyNodeData>>({});

  // Build node data outside render (refs are not read during render).
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const map: Record<string, PrivyNodeData> = {};
      const anyFocus = focus.near.size > 0;
      for (const id of scene.ids) {
        const entity = catalog.entities[id];
        if (!entity) continue;
        const enter = scene.enter[id] ?? { delay: 0, animate: false };
        const focused = view.focusId === id;
        const onPath = focus.pathNodes.has(id);
        const ghost = ghostSet.has(id);
        const dimmed = !ghost && anyFocus && !focus.near.has(id) && !onPath;
        const hasMore = (adjacency.get(id) ?? []).some((n) => !visibleSet.has(n.node));
        const isRoot = id === rootId;
        const glow = !anyFocus;
        const sig = `${focused}|${onPath}|${dimmed}|${ghost}|${hasMore}|${isRoot}|${glow}|${enter.delay}|${enter.animate}|${reduced}`;
        const cached = dataCache.current.get(id);
        if (cached && cached.sig === sig && cached.data.entity === entity) {
          map[id] = cached.data;
        } else {
          const data: PrivyNodeData = {
            entity,
            isRoot,
            focused,
            glow,
            onPath,
            dimmed,
            ghost,
            hasMore,
            enterDelay: enter.delay,
            animate: enter.animate,
            reduced,
          };
          dataCache.current.set(id, { sig, data });
          map[id] = data;
        }
      }
      setNodeDataMap(map);
    });
    return () => cancelAnimationFrame(frame);
  }, [scene.ids, scene.enter, focus, view.focusId, adjacency, visibleSet, ghostSet, rootId, reduced, catalog]);

  const rfNodes: PrivyNode[] = useMemo(() => {
    const out: PrivyNode[] = [];
    for (const id of scene.ids) {
      const data = nodeDataMap[id];
      const p = scene.positions[id];
      if (!data || !p) continue;
      const size = NODE_SIZE[data.entity.type];
      out.push({
        id,
        type: "privy",
        position: { x: p.x - size / 2, y: p.y - size / 2 },
        width: size,
        height: size,
        measured: { width: size, height: size },
        data,
        draggable: interactive,
        selectable: false,
        zIndex: data.focused ? 3 : data.onPath ? 2 : data.ghost || data.dimmed ? 0 : 1,
      });
    }
    return out;
  }, [scene.ids, scene.positions, nodeDataMap, interactive]);

  const rfEdges: PrivyEdgeType[] = useMemo(() => {
    const shown = new Set(rfNodes.map((n) => n.id));
    const anyFocus = focus.near.size > 0;
    return visibleEdges
      .filter((e) => shown.has(e.source) && shown.has(e.target))
      .map((e) => {
        const childEnter = scene.edgeEnter[e.id]?.animate ? scene.edgeEnter[e.id] : undefined;
        const onPath = focus.pathEdges.has(e.id);
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "privy",
          zIndex: onPath ? 1 : 0,
          data: {
            label: e.label,
            onPath,
            ghost: isGhostEdge(e),
            noLabel: isCategoryEdge(e),
            dimmed: anyFocus && !focus.nearEdges.has(e.id) && !onPath,
            hovered: hoverEdge === e.id,
            enterDelay: childEnter?.delay ?? 0,
            animate: !!childEnter,
            reduced,
          },
        };
      });
  }, [rfNodes, visibleEdges, scene.edgeEnter, focus, hoverEdge, reduced, isGhostEdge, isCategoryEdge]);

  // Node circles and label boxes that edge labels avoid. Hidden labels (dimmed, ghost) count as the circle only.
  const obstacles: Rect[] = useMemo(() => {
    const out: Rect[] = [];
    for (const n of rfNodes) {
      const e = n.data.entity;
      const p = scene.positions[n.id];
      if (!p) continue;
      const r = NODE_SIZE[e.type] / 2;
      out.push({ id: n.id, kind: "circle", x0: p.x - r, x1: p.x + r, y0: p.y - r, y1: p.y + r });
      if (n.data.dimmed || n.data.ghost) continue;
      const b = nodeBox(e.type, e.label, e.sublabel);
      out.push({ id: n.id, kind: "label", x0: p.x - b.w / 2, x1: p.x + b.w / 2, y0: p.y + r, y1: p.y - r + b.h });
    }
    return out;
  }, [rfNodes, scene.positions]);

  const onNodesChange = useCallback(
    (changes: NodeChange<PrivyNode>[]) => {
      const moved: Record<string, XY> = {};
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          const e = catalog.entities[c.id];
          if (!e) continue;
          const size = NODE_SIZE[e.type];
          const p = { x: c.position.x + size / 2, y: c.position.y + size / 2 };
          moved[c.id] = p;
          posRef.current.set(c.id, p);
          tweensRef.current.delete(c.id);
          if (c.dragging === false) pinnedRef.current.add(c.id);
        }
      }
      if (Object.keys(moved).length) {
        setScene((prev) => ({ ...prev, positions: { ...prev.positions, ...moved } }));
      }
    },
    [catalog],
  );

  const handleNodeDragStop: OnNodeDrag<PrivyNode> = useCallback(
    (_evt, node) => {
      pinnedRef.current.add(node.id);
      const p = posRef.current.get(node.id);
      // The dragged place is the new target (no relayout, no camera move).
      if (p) targetsRef.current[node.id] = p;
      if (usingStore && p) setStorePositions({ [node.id]: p });
    },
    [usingStore, setStorePositions],
  );

  const handleNodeClick: NodeMouseHandler<PrivyNode> = useCallback(
    (_evt, node) => {
      // Ghost nodes are context only: they take no clicks and no focus.
      if (node.data.ghost) return;
      onNodeClick?.(node.id, node.data.entity);
    },
    [onNodeClick],
  );
  const handleEdgeEnter: EdgeMouseHandler<PrivyEdgeType> = useCallback((_e, edge) => setHoverEdge(edge.id), []);
  const handleEdgeLeave: EdgeMouseHandler<PrivyEdgeType> = useCallback(() => setHoverEdge(null), []);
  const handleMoveEnd = useCallback(
    (_e: unknown, vp: RFViewport) => {
      if (usingStore) setStoreViewport({ x: vp.x, y: vp.y, zoom: vp.zoom });
    },
    [usingStore, setStoreViewport],
  );

  const actions = useMemo(() => ({ onExpand, insets }), [onExpand, insets]);

  return (
    <GraphActionsContext.Provider value={actions}>
      <LabelObstaclesContext.Provider value={obstacles}>
      <div
        className={[
          "privy-graph relative h-full w-full overflow-hidden bg-bg",
          // A preview with no clicks must not look clickable.
          !interactive && !onNodeClick && "privy-graph-static",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <ReactFlow<PrivyNode, PrivyEdgeType>
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          proOptions={{ hideAttribution: true }}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onNodeDragStop={handleNodeDragStop}
          onEdgeMouseEnter={handleEdgeEnter}
          onEdgeMouseLeave={handleEdgeLeave}
          onMoveEnd={handleMoveEnd}
          nodesDraggable={interactive}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={interactive}
          zoomOnScroll={interactive}
          zoomOnPinch={interactive}
          zoomOnDoubleClick={false}
          preventScrolling={interactive}
          minZoom={0.3}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          colorMode="dark"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--grid-dot)" bgColor="var(--bg)" />
        </ReactFlow>
        {ghostIds.length ? <GhostHints ids={ghostIds} reduced={reduced} insets={insets} /> : null}
        {children}
      </div>
      </LabelObstaclesContext.Provider>
    </GraphActionsContext.Provider>
  );
}

/**
 * The Privyus graph canvas. Drive it with `GraphDelta`s through the demo store
 * (`useDemoStore.getState().applyDelta(delta)` or the script engine), or pass a
 * controlled `view`.
 */
export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
