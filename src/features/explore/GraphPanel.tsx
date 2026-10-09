"use client";

import { useReactFlow } from "@xyflow/react";
import {
  Bookmark,
  BookmarkCheck,
  ChevronRight,
  Maximize,
  Minus,
  Plus,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { GraphCanvas } from "@/components/graph";
import { OrbitGraph } from "@/components/graph/orbit/OrbitGraph";
import { graphNotes } from "@/data/graph-notes";
import { graphMode } from "@/lib/graph-mode";
import { Button, cx } from "@/components/ui";
import { MOTION, easeOutExpo, useReducedMotion } from "@/lib/motion";
import { useDemoStore } from "@/lib/store";
import { ROOT_ID, catalog, shortLabel } from "./catalog";
import { clickNode } from "./controller";
import { useExploreUi } from "./ui-store";

/** Header (title, hint line, breadcrumb, Save) at the top; zoom controls at the bottom. */
const HEADER_INSET = 92;
const FOOTER_INSET = 64;

/** Root-to-focus path over the visible edges. */
function useFocusPath(): string[] {
  const entityIds = useDemoStore((s) => s.graph.entityIds);
  const edgeIds = useDemoStore((s) => s.graph.edgeIds);
  const focusId = useDemoStore((s) => s.graph.focusId);
  return useMemo(() => {
    if (
      !focusId ||
      !entityIds.includes(ROOT_ID) ||
      !entityIds.includes(focusId)
    )
      return [];
    const vis = new Set(entityIds);
    const adj = new Map<string, string[]>();
    for (const id of edgeIds) {
      const e = catalog.edges[id];
      if (!e || !vis.has(e.source) || !vis.has(e.target)) continue;
      adj.set(e.source, [...(adj.get(e.source) ?? []), e.target]);
      adj.set(e.target, [...(adj.get(e.target) ?? []), e.source]);
    }
    const prev = new Map<string, string | null>([[ROOT_ID, null]]);
    const queue = [ROOT_ID];
    while (queue.length) {
      const cur = queue.shift()!;
      if (cur === focusId) break;
      for (const n of adj.get(cur) ?? []) {
        if (prev.has(n)) continue;
        prev.set(n, cur);
        queue.push(n);
      }
    }
    if (!prev.has(focusId)) return [focusId];
    const path: string[] = [];
    for (let at: string | null = focusId; at; at = prev.get(at) ?? null)
      path.unshift(at);
    return path;
  }, [entityIds, edgeIds, focusId]);
}

function crumbLabel(id: string): string {
  return id === ROOT_ID ? "Ukraine" : shortLabel(id);
}

function Crumb({ id, current }: { id: string; current: boolean }) {
  return (
    <button
      type="button"
      onClick={() => useDemoStore.getState().setFocus(id)}
      aria-current={current ? "location" : undefined}
      className={cx(
        "rounded-chip px-1.5 py-0.5 text-[12px] leading-4 font-medium whitespace-nowrap transition-colors duration-[120ms]",
        current ? "text-fg-1" : "text-fg-3 hover:bg-surface-2 hover:text-fg-1",
      )}
    >
      {crumbLabel(id)}
    </button>
  );
}

const Sep = () => (
  <ChevronRight
    size={12}
    strokeWidth={1.5}
    className="shrink-0 text-fg-3"
    aria-hidden="true"
  />
);

/** Root-to-focus trail. Long trails keep the first and the last two crumbs; the middle folds into "…". */
function Breadcrumbs() {
  const path = useFocusPath();
  const [open, setOpen] = useState(false);
  const pathKey = path.join(">");
  const [openFor, setOpenFor] = useState(pathKey);
  if (openFor !== pathKey) {
    setOpenFor(pathKey);
    setOpen(false);
  }
  if (path.length < 2) return null;
  const collapse = path.length > 3;
  const hidden = collapse ? path.slice(1, -2) : [];
  const head = collapse ? [path[0]] : path.slice(0, -2);
  const tail = path.slice(-2);
  return (
    <nav
      aria-label="Focus path"
      className="pointer-events-auto hidden h-8 max-w-[440px] items-center gap-1 rounded-chip border border-line bg-surface-1 px-1.5 @[560px]:flex"
    >
      {head.map((id, i) => (
        <span key={id} className="flex items-center gap-1">
          {i > 0 ? <Sep /> : null}
          <Crumb id={id} current={false} />
        </span>
      ))}
      {collapse ? (
        <span className="relative flex items-center gap-1">
          <Sep />
          <button
            type="button"
            aria-label={`Show ${hidden.length} more steps`}
            aria-expanded={open}
            title={hidden.map(crumbLabel).join(" › ")}
            onClick={() => setOpen((o) => !o)}
            className="rounded-chip px-1.5 py-0.5 text-[12px] leading-4 font-medium text-fg-3 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1"
          >
            …
          </button>
          {open ? (
            <span
              className="absolute top-[calc(100%+10px)] left-0 z-20 flex min-w-[180px] flex-col gap-0.5 rounded-overlay border border-line-strong bg-surface-1 p-1.5"
              style={{
                animation:
                  "privy-fade-rise 180ms cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            >
              {hidden.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    useDemoStore.getState().setFocus(id);
                  }}
                  className="rounded-chip px-2 py-1.5 text-left text-[12px] leading-4 font-medium whitespace-nowrap text-fg-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1"
                >
                  {crumbLabel(id)}
                </button>
              ))}
            </span>
          ) : null}
        </span>
      ) : null}
      {tail.map((id, i) => (
        <span key={id} className="flex items-center gap-1">
          {head.length || collapse || i > 0 ? <Sep /> : null}
          <Crumb id={id} current={i === tail.length - 1} />
        </span>
      ))}
    </nav>
  );
}

/** Zoom and fit buttons. Rendered inside the canvas so it can reach the React Flow instance. */
/**
 * After the canvas changes size (chat resize), eases the camera to the focus and
 * its neighbors, inside the header and footer insets. Rendered inside the canvas.
 */
function CameraRefit({ token }: { token: number }) {
  const rf = useReactFlow();
  const reduced = useReducedMotion();
  // Only a change of the token refits (the effect also re-runs when `rf` or `reduced` settle after mount).
  const lastToken = useRef(token);
  useEffect(() => {
    if (token === lastToken.current) return;
    lastToken.current = token;
    const t = setTimeout(() => {
      const g = useDemoStore.getState().graph;
      const ids = new Set<string>();
      if (g.focusId) {
        ids.add(g.focusId);
        for (const eid of g.edgeIds) {
          const e = catalog.edges[eid];
          if (!e) continue;
          if (e.source === g.focusId) ids.add(e.target);
          if (e.target === g.focusId) ids.add(e.source);
        }
      }
      const nodes = (ids.size ? Array.from(ids) : g.entityIds).filter((id) => rf.getNode(id)).map((id) => ({ id }));
      if (!nodes.length) return;
      rf.fitView({
        nodes,
        padding: { top: `${HEADER_INSET + 40}px`, bottom: `${FOOTER_INSET + 48}px`, left: "64px", right: "64px" },
        maxZoom: 1.15,
        duration: reduced ? 0 : MOTION.cameraMs,
        ease: easeOutExpo,
      });
    }, 30);
    return () => clearTimeout(t);
  }, [token, rf, reduced]);
  return null;
}

function ZoomControls() {
  const rf = useReactFlow();
  const reduced = useReducedMotion();
  const duration = reduced ? 0 : MOTION.cameraMs;
  const btn =
    "flex h-8 w-8 items-center justify-center text-fg-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1";
  return (
    <div data-caption-avoid className="pointer-events-auto absolute bottom-4 left-5 z-10 flex items-center overflow-hidden rounded-button border border-line bg-surface-1">
      <button
        type="button"
        aria-label="Zoom out"
        className={btn}
        onClick={() => rf.zoomOut({ duration: duration / 2 })}
      >
        <Minus size={16} strokeWidth={1.5} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <button
        type="button"
        aria-label="Zoom in"
        className={btn}
        onClick={() => rf.zoomIn({ duration: duration / 2 })}
      >
        <Plus size={16} strokeWidth={1.5} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <button
        type="button"
        aria-label="Fit the graph"
        className={btn}
        onClick={() =>
          rf.fitView({ padding: 0.12, duration, ease: easeOutExpo })
        }
      >
        <Maximize size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}

/**
 * The canvas hint line (2.8). It shows in full or not at all: when the breadcrumb
 * leaves too little room, it hides visually and stays for screen readers.
 */
function HintLine({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [fits, setFits] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setFits(el.scrollWidth <= el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);
  return (
    <>
      <p
        ref={ref}
        aria-hidden={!fits}
        className="t-meta overflow-hidden whitespace-nowrap"
        style={{ visibility: fits ? "visible" : "hidden" }}
      >
        {text}
      </p>
      {fits ? null : <span className="sr-only">{text}</span>}
    </>
  );
}

export interface GraphPanelProps {
  onSave: () => void;
  /** True right after a save, until the graph changes. */
  saved: boolean;
  /** Changes after the chat is resized: the camera re-fits the focus. */
  refitToken?: number;
}

/** The graph renderer for this tab: the orbit graph, or the 2D fallback (`?graph=2d`). */
function useGraphMode() {
  return useSyncExternalStore(
    () => () => {},
    graphMode,
    () => "orbit" as const,
  );
}

const markReady = () => useExploreUi.setState({ graphReady: true });

/** Smart View header: the topic title, Save, the hint line, and the breadcrumb. */
function GraphHeader({ onSave, saved, hint }: { onSave: () => void; saved: boolean; hint: string }) {
  const hasRoot = useDemoStore((s) => s.graph.entityIds.includes(ROOT_ID));
  const empty = useDemoStore((s) => s.graph.entityIds.length === 0);
  const savePressed = useExploreUi((s) => s.savePressed);
  const root = catalog.entities[ROOT_ID];
  return (
    <header
      data-caption-avoid
      className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-1 px-6 pt-5 pb-8"
      style={{
        background:
          "linear-gradient(to bottom, var(--bg) 62%, transparent)",
      }}
    >
      {/* Row 1: the title has priority; only Save shares the row. */}
      <div className="flex items-start justify-between gap-4">
        {/* "Smart View" is the product's name for this canvas: a quiet label, then the topic as the title. */}
        <div className="flex min-w-0 items-baseline gap-2.5">
          {hasRoot && root ? <span className="t-meta shrink-0">Smart View</span> : null}
          <h1 className="t-panel-title min-w-0 truncate">{hasRoot && root ? root.label : "Smart View"}</h1>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={onSave}
          disabled={empty}
          aria-label="Save exploration"
          data-tour="save-button"
          data-pressed={savePressed || undefined}
          icon={
            saved ? (
              <BookmarkCheck
                size={15}
                strokeWidth={1.5}
                className="text-teal-bright"
              />
            ) : (
              <Bookmark size={15} strokeWidth={1.5} />
            )
          }
          className="pointer-events-auto data-[pressed]:scale-[0.96] data-[pressed]:border-line-strong data-[pressed]:bg-surface-3"
        >
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
      {/* Row 2: the hint line (hides when it does not fit), then the breadcrumb. */}
      <div className="flex min-h-8 items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <HintLine text={empty ? "Ask a question in the chat to build the graph" : hint} />
        </div>
        <Breadcrumbs />
      </div>
    </header>
  );
}

/** The right panel: the living graph with its header, hint line, and save action (2.1, 2.8, 2.9, 2.10). */
export function GraphPanel({ onSave, saved, refitToken = 0 }: GraphPanelProps) {
  const mode = useGraphMode();
  const empty = useDemoStore((s) => s.graph.entityIds.length === 0);
  const pressedNode = useExploreUi((s) => s.pressedNode);
  const insets = useMemo(
    () => ({ top: HEADER_INSET, bottom: FOOTER_INSET, left: 8, right: 8 }),
    [],
  );
  useEffect(() => {
    if (mode === "2d") markReady();
    return () => useExploreUi.setState({ graphReady: false });
  }, [mode]);

  if (mode === "orbit") {
    return (
      <section data-tour="graph" data-graph-renderer="orbit" className="@container relative min-h-0 min-w-0 overflow-hidden rounded-panel border border-line bg-bg">
        <OrbitGraph
          catalog={catalog}
          rootId={ROOT_ID}
          onNodeClick={clickNode}
          topInset={HEADER_INSET}
          refitToken={refitToken}
          pressedId={pressedNode ?? undefined}
          onReady={markReady}
          notes={graphNotes}
        >
          <GraphHeader onSave={onSave} saved={saved} hint="Click a node to center it · Drag to orbit · Scroll to zoom" />
        </OrbitGraph>
      </section>
    );
  }

  return (
    <section data-tour="graph" data-graph-renderer="2d" className="@container relative min-h-0 min-w-0 overflow-hidden rounded-panel border border-line bg-bg">
      <GraphCanvas
        catalog={catalog}
        rootId={ROOT_ID}
        onNodeClick={clickNode}
        onExpand={clickNode}
        insets={insets}
      >
        <GraphHeader onSave={onSave} saved={saved} hint="Click nodes to explore · Drag to reposition · Zoom and pan to navigate" />
        {empty ? null : <ZoomControls />}
        <CameraRefit token={refitToken} />
      </GraphCanvas>
    </section>
  );
}
