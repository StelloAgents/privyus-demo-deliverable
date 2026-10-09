"use client";

import { Maximize, Minus, Plus } from "lucide-react";
import dynamic from "next/dynamic";
import { createElement, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { GraphNoteSpec } from "@/data/graph-notes";
import { initialsOf, splitBillLabel } from "@/lib/catalog";
import { iconForEntity } from "@/lib/icons";
import { useReducedMotion } from "@/lib/motion";
import { getOrbitConfig, useDemoStore } from "@/lib/store";
import type { Catalog, Entity } from "@/lib/types";
import { makeOrbitConfig, monthOfDay, orbitLayout, toDay } from "../orbit-layout";
import { createBridge, type OrbitBridge } from "./bridge";
import { buildOrbitView, type OrbitView, type ViewNode } from "./model";
import { dateLabel } from "./notes";
import { OrbitTimeline, TIMELINE_HEIGHT } from "./OrbitTimeline";

const loadScene = () => import("./OrbitScene");
// Start loading the WebGL scene with the page, not after it.
if (typeof window !== "undefined") void loadScene();
const OrbitScene = dynamic(loadScene, { ssr: false, loading: () => null });

export interface OrbitGraphProps {
  catalog: Catalog;
  rootId: string;
  /** A click on a node (not a ghost). */
  onNodeClick: (id: string) => void;
  /** Space (px) the header takes at the top of the canvas. */
  topInset: number;
  /** Changes after the chat is resized: the camera re-fits. */
  refitToken?: number;
  /** A node shown pressed (presenter mode presses it on screen). */
  pressedId?: string;
  /** The scene has drawn its first frame. */
  onReady?: () => void;
  /** Overlays above the canvas (the header). */
  children?: ReactNode;
  /** The notes the graph can show for an answer (src/data/graph-notes.ts). */
  notes?: GraphNoteSpec[];
}

const CONTROLS_INSET = 56;

/**
 * The Explore graph as an orbit (Orbit + Chronos): the focused entity at the
 * center of a tilted 3D scene, one ring per relationship type, the angle on a
 * ring is the date, and a timeline of the records by month below. Reads the
 * demo store; positions come from the store's orbit layout.
 */
const NO_NOTES: GraphNoteSpec[] = [];

export function OrbitGraph({ catalog, rootId, onNodeClick, topInset, refitToken = 0, pressedId, onReady, children, notes = NO_NOTES }: OrbitGraphProps) {
  const graph = useDemoStore((s) => s.graph);
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const [bridge] = useState<OrbitBridge>(() => {
    const b = createBridge();
    b.setInsets({ top: topInset, right: 8, bottom: CONTROLS_INSET, left: 8 });
    return b;
  });
  // Before the scene's effects run (they fit the camera to these insets).
  useLayoutEffect(() => {
    bridge.setInsets({ top: topInset, right: 8, bottom: CONTROLS_INSET, left: 8 });
  }, [bridge, topInset]);

  // The store's orbit config (shared layout cache); a local one when the store lays out another way.
  const [fallbackCfg] = useState(() => makeOrbitConfig(catalog, rootId));
  const cfg = getOrbitConfig() ?? fallbackCfg;
  const view: OrbitView = useMemo(() => {
    const content = {
      entityIds: graph.entityIds,
      edgeIds: graph.edgeIds,
      ghostEntityIds: graph.ghostEntityIds,
      ghostEdgeIds: graph.ghostEdgeIds,
      focusId: graph.focusId,
    };
    return buildOrbitView(catalog, rootId, content, orbitLayout(cfg, content), notes);
  }, [catalog, rootId, cfg, graph.entityIds, graph.edgeIds, graph.ghostEntityIds, graph.ghostEdgeIds, graph.focusId, notes]);

  // A hover on a node that left the graph ends.
  const hoverOn = hover && view.byId.has(hover) ? hover : null;

  const onClick = useCallback(
    (n: ViewNode) => {
      if (n.tier === "ghost") return;
      setHover(null);
      // An unopened record opens its category (its records land on the ring).
      onNodeClick(n.tier === "hint" && n.category ? n.category : n.id);
    },
    [onNodeClick],
  );

  // Timeline axis: every dated record in the catalog.
  const axis = useMemo(() => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const e of Object.values(catalog.edges)) {
      if (!e.date) continue;
      const m = monthOfDay(toDay(e.date));
      lo = Math.min(lo, m);
      hi = Math.max(hi, m);
    }
    return isFinite(lo) ? { m0: lo, months: hi - lo + 1 } : { m0: 2025 * 12, months: 12 };
  }, [catalog]);
  const counts = useMemo(() => {
    const out = new Array<number>(axis.months).fill(0);
    // The records the answer is about: a person's own records when the center is a person
    // with categories (the counts on the ring labels), else the records on the rings and above
    // them. Never the faint context at the edge.
    const personal = view.nodes.some((n) => n.category);
    for (const n of view.nodes) {
      if (n.day === undefined || n.tier === "ghost" || n.tier === "faint" || n.tier === "hidden" || n.tier === "center") continue;
      if (personal && !n.category) continue;
      const i = monthOfDay(n.day) - axis.m0;
      if (i >= 0 && i < axis.months) out[i]++;
    }
    return out;
  }, [view, axis]);
  const focusNode = view.focusId ? view.byId.get(view.focusId) : undefined;

  // Build-in: the timeline bars rise at the last reasoning step (Render), with the context.
  const cue = graph.motion === "animate" ? graph.cue : undefined;
  const animateBars = graph.motion === "animate" && !reduced;
  const holdBars = animateBars && !!cue && cue.step < cue.steps - 1;
  const [shownCounts, setShownCounts] = useState(counts);
  if (!holdBars && shownCounts !== counts) setShownCounts(counts);

  const empty = graph.entityIds.length === 0;

  return (
    <div data-orbit className="privy-orbit relative h-full w-full overflow-hidden bg-bg">
      <div className="absolute inset-x-0 top-0" style={{ bottom: empty ? 0 : TIMELINE_HEIGHT }}>
        <OrbitScene
          view={view}
          bridge={bridge}
          revision={graph.revision}
          instant={graph.motion === "instant"}
          loadToken={graph.loadToken}
          reduced={reduced}
          hover={hoverOn}
          pressed={pressedId}
          refitToken={refitToken}
          onReady={onReady}
          cue={cue}
        />
        <Overlay view={view} bridge={bridge} hover={hoverOn} pressedId={pressedId} onHover={setHover} onClick={onClick} />
        {empty ? null : <ZoomControls bridge={bridge} />}
      </div>
      {children}
      {empty ? null : (
        <OrbitTimeline
          m0={axis.m0}
          months={axis.months}
          counts={shownCounts}
          animate={animateBars}
          focusMonth={focusNode?.day !== undefined ? monthOfDay(focusNode.day) : undefined}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

function ZoomControls({ bridge }: { bridge: OrbitBridge }) {
  const btn = "flex h-8 w-8 items-center justify-center text-fg-2 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1";
  return (
    <div data-caption-avoid className="pointer-events-auto absolute bottom-4 left-5 z-10 flex items-center overflow-hidden rounded-button border border-line bg-surface-1">
      <button type="button" aria-label="Zoom out" className={btn} onClick={() => bridge.camera?.zoom(1)}>
        <Minus size={16} strokeWidth={1.5} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <button type="button" aria-label="Zoom in" className={btn} onClick={() => bridge.camera?.zoom(-1)}>
        <Plus size={16} strokeWidth={1.5} />
      </button>
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <button type="button" aria-label="Fit the graph" className={btn} onClick={() => bridge.camera?.fit()}>
        <Maximize size={15} strokeWidth={1.5} />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DOM overlay                                                         */
/* ------------------------------------------------------------------ */


interface OverlayProps {
  view: OrbitView;
  bridge: OrbitBridge;
  hover: string | null;
  pressedId?: string;
  onHover: (id: string | null) => void;
  onClick: (n: ViewNode) => void;
}

/** Labels, face cards, and hit targets. The scene writes their screen positions every frame. */
function Overlay({ view, bridge, hover, pressedId, onHover, onClick }: OverlayProps) {
  const marks = view.marks;
  const dial = view.rings.length ? marks.dial : [];

  return (
    <div data-orbit-overlay className="pointer-events-none absolute inset-0 overflow-hidden" style={{ contain: "strict" }}>
      {dial.map((d) => (
        <span
          key={`dial-${d.key}-${d.day}`}
          data-dial-label=""
          data-day={d.day}
          ref={(el) => {
            const k = `${d.key}-${d.day}`;
            if (el) bridge.dial.set(k, el);
            else bridge.dial.delete(k);
          }}
          className="absolute top-0 left-0 text-[11px] leading-4 font-medium whitespace-nowrap text-fg-2 tabular-nums transition-opacity duration-200"
          style={{ visibility: "hidden" }}
        >
          {d.text}
        </span>
      ))}
      {marks.note ? <Note key={marks.note.id} id={marks.note.id} text={marks.note.text} bridge={bridge} /> : null}
      {marks.chips.map((c) => (
        <span
          key={`chip-${c.node}`}
          data-orbit-chip=""
          data-caption-avoid=""
          ref={(el) => {
            if (el) bridge.chips.set(c.node, el);
            else bridge.chips.delete(c.node);
          }}
          className="absolute top-0 left-0 rounded-[3px] border border-teal/60 px-1.5 text-[11px] leading-4 font-medium whitespace-nowrap text-fg-1 tabular-nums"
          style={{ background: "var(--label-bg)", visibility: "hidden", opacity: 0 }}
        >
          {c.text}
        </span>
      ))}
      {view.rings
        .filter((r) => !r.anchorId)
        .map((r) => (
          <span
            key={`ring-${r.key}`}
            data-ring-label={r.key}
            ref={(el) => {
              if (el) bridge.ringLabels.set(r.key, el);
              else bridge.ringLabels.delete(r.key);
            }}
            className="absolute top-0 left-0 rounded-[3px] border border-transparent bg-bg px-1.5 text-[11px] leading-[14px] font-medium whitespace-nowrap text-teal-bright"
            style={{ visibility: "hidden" }}
          >
            {r.text}
          </span>
        ))}
      {view.edges
        .filter((e) => e.showLabel)
        .map((e) => (
          <span
            key={`edge-${e.id}`}
            data-edge-label=""
            data-edge-id={e.id}
            data-on-path={e.tier === "path" ? "" : undefined}
            ref={(el) => {
              if (el) bridge.edgeLabels.set(e.id, el);
              else bridge.edgeLabels.delete(e.id);
            }}
            className={`absolute top-0 left-0 rounded-[3px] border px-1.5 text-[11px] leading-4 font-medium whitespace-nowrap ${
              e.tier === "path" ? "border-orange/70 text-orange-ink" : "border-teal/60 text-teal-bright"
            }`}
            style={{ background: "var(--label-bg)", visibility: "hidden" }}
          >
            {e.label}
          </span>
        ))}
      {view.nodes.map((n) =>
        n.tier === "hidden" ? null : (
          <NodeOverlay
            key={n.id}
            node={n}
            bridge={bridge}
            hovered={hover === n.id}
            pressed={pressedId === n.id}
            onHover={onHover}
            onClick={onClick}
          />
        ),
      )}
    </div>
  );
}

/**
 * The note of the answer on screen: one short line in the graph, next to what it
 * refers to, joined to it by a thin teal leader. Product UI (the edge label type
 * scale), not a presenter caption.
 */
function Note({ id, text, bridge }: { id: string; text: string; bridge: OrbitBridge }) {
  const el = useRef<HTMLDivElement>(null);
  const leader = useRef<SVGLineElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  useLayoutEffect(() => {
    if (!el.current) return;
    const note = { el: el.current, leader: leader.current, dot: dot.current };
    bridge.setNote(note);
    return () => bridge.setNote(null, note);
  }, [bridge]);
  return (
    <>
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" style={{ opacity: 0 }}>
        <line ref={leader} stroke="var(--teal)" strokeWidth={1} />
        <circle ref={dot} r={2} fill="var(--teal-bright)" />
      </svg>
      <div
        ref={el}
        data-orbit-note={id}
        data-caption-avoid=""
        role="note"
        className="absolute top-0 left-0 rounded-[3px] px-1.5 text-[11px] leading-4 font-medium whitespace-nowrap text-fg-2"
        style={{ background: "var(--label-bg)", visibility: "hidden", opacity: 0 }}
      >
        {text}
      </div>
    </>
  );
}

function UkraineFlag({ size }: { size: number }) {
  return (
    <svg width={size} height={(size * 2) / 3} viewBox="0 0 30 20" aria-hidden="true" style={{ borderRadius: 2, display: "block" }}>
      <rect width="30" height="10" fill="var(--flag-ua-blue)" />
      <rect y="10" width="30" height="10" fill="var(--flag-ua-yellow)" />
    </svg>
  );
}

function Avatar({ entity, size, orange }: { entity: Entity; size: number; orange: boolean }) {
  const flag = entity.type === "topic" && /^flag[-_: ]?ua$/i.test(entity.icon ?? "");
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full border-[1.5px] bg-surface-2 font-semibold ${
        orange ? "border-orange text-fg-1" : "border-teal text-fg-2"
      }`}
      style={{ width: size, height: size, fontSize: size >= 30 ? 11 : 10 }}
    >
      {entity.type === "person"
        ? initialsOf(entity)
        : flag
          ? <UkraineFlag size={Math.round(size * 0.56)} />
          : createElement(iconForEntity(entity), { size: Math.round(size * 0.46), strokeWidth: 1.5 })}
    </span>
  );
}

/** "S. 456" and "Defense Support Act" for a bill; the label and sublabel otherwise. */
function cardText(e: Entity): { title: string; sub?: string } {
  if (e.type === "bill") {
    const { number, title } = splitBillLabel(e);
    return { title: number, sub: title };
  }
  return { title: e.label, sub: e.sublabel };
}

const halo = { background: "var(--label-bg)" };

const NodeOverlay = memo(function NodeOverlay({
  node: n,
  bridge,
  hovered,
  pressed,
  onHover,
  onClick,
}: {
  node: ViewNode;
  bridge: OrbitBridge;
  hovered: boolean;
  pressed: boolean;
  onHover: (id: string | null) => void;
  onClick: (n: ViewNode) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLButtonElement>(null);
  const labelRef = useRef<HTMLElement>(null);
  const id = n.id;
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    bridge.nodes.set(id, { root, hit: hitRef.current, label: labelRef.current });
    return () => {
      if (bridge.nodes.get(id)?.root === root) bridge.nodes.delete(id);
    };
  });

  const e = n.entity;
  const orange = n.tier === "center" || n.onPath || n.focused;
  const ghost = n.tier === "ghost";
  const events = {
    onPointerEnter: () => onHover(id),
    onPointerLeave: () => onHover(null),
    onClick: () => onClick(n),
  };
  const { title, sub } = cardText(e);
  const hint = n.tier === "hint";
  const name = e.type === "category" ? (n.ringText ?? e.label) : e.label;

  let label: ReactNode = null;
  const show = n.label !== "none";
  if (n.label === "center") {
    label = (
      <div
        ref={labelRef as React.Ref<HTMLDivElement>}
        data-node-label=""
        data-kind="center"
        data-show="1"
        className="pointer-events-auto absolute top-0 left-0 max-w-[240px] cursor-default rounded-card border border-line-strong bg-surface-1/95 px-2.5 py-1 text-center whitespace-nowrap"
        onPointerEnter={events.onPointerEnter}
        onPointerLeave={events.onPointerLeave}
      >
        <span className="block truncate text-[13px] leading-[17px] font-semibold text-fg-1">{title}</span>
        {sub ? <span className="block truncate text-[11px] leading-[14px] font-medium text-fg-3">{sub}</span> : null}
      </div>
    );
  } else if (n.label === "card") {
    label = (
      <div
        ref={labelRef as React.Ref<HTMLDivElement>}
        data-node-label=""
        data-kind="card"
        data-show="1"
        {...events}
        className={`pointer-events-auto absolute top-0 left-0 flex max-w-[250px] cursor-pointer items-center gap-2 rounded-card border py-1 pr-2.5 pl-1 whitespace-nowrap transition-colors duration-[120ms] ${
          hovered || pressed ? "border-line-strong bg-surface-2" : "border-line bg-surface-1/90"
        }`}
      >
        <Avatar entity={e} size={24} orange={orange} />
        <span className="min-w-0">
          <span className={`block truncate text-[12px] leading-4 font-semibold ${n.focused ? "text-orange-ink" : "text-fg-1"}`}>{title}</span>
          {sub ? <span className="block truncate text-[11px] leading-[14px] font-medium text-fg-3">{sub}</span> : null}
        </span>
      </div>
    );
  } else if (n.label === "ring") {
    label = (
      <button
        type="button"
        ref={labelRef as React.Ref<HTMLButtonElement>}
        data-node-label=""
        data-kind="ring"
        data-show="1"
        aria-label={`${e.label}: open the records`}
        aria-pressed={n.focused}
        {...events}
        className={`pointer-events-auto absolute top-0 left-0 rounded-[3px] border px-1.5 text-[11px] leading-[14px] font-medium whitespace-nowrap transition-colors duration-[120ms] ${
          n.focused
            ? "border-orange/80 bg-bg text-orange-ink"
            : hovered || pressed
              ? "border-line-strong bg-surface-2 text-fg-1"
              : "border-transparent bg-bg text-teal-bright"
        }`}
      >
        {name}
      </button>
    );
  } else {
    // Records and second-hop nodes: a short label under the node. Faint context and
    // unopened records show it on hover only (an unopened record with its date).
    const record = n.label === "record";
    const recordSub = hint ? (n.day !== undefined ? dateLabel(n.day) : undefined) : e.sublabel;
    label = (
      <div
        ref={labelRef as React.Ref<HTMLDivElement>}
        data-node-label=""
        data-kind={record ? "record" : "tag"}
        data-show={show && !hint ? "1" : "0"}
        {...events}
        className={`absolute top-0 left-0 max-w-[176px] rounded-chip px-1 text-center whitespace-nowrap ${ghost ? "pointer-events-none" : "pointer-events-auto cursor-pointer"}`}
        style={halo}
      >
        <span
          className={`block truncate ${record ? "text-[12px] leading-4 font-medium" : "text-[11px] leading-[15px] font-medium"} ${
            n.focused ? "text-orange-ink" : hovered || pressed || record || n.onPath ? "text-fg-1" : "text-fg-2"
          }`}
        >
          {e.type === "bill" ? title : e.label}
        </span>
        {record && recordSub ? <span className="block truncate text-[11px] leading-[14px] font-medium text-fg-3">{recordSub}</span> : null}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      data-graph-node=""
      data-node-id={id}
      data-state={n.tier}
      data-focused={n.focused ? "" : undefined}
      data-emphasis={n.emphasis ? "" : undefined}
      data-on-path={n.onPath ? "" : undefined}
      data-pressed={pressed ? "" : undefined}
      className="absolute top-0 left-0"
      style={{ visibility: "hidden" }}
    >
      {n.tier === "anchor" ? null : (
        <button
          ref={hitRef}
          type="button"
          data-node-hit=""
          aria-label={ghost ? undefined : `${e.label}${e.sublabel ? `, ${e.sublabel}` : ""}`}
          aria-hidden={ghost || undefined}
          tabIndex={ghost ? -1 : 0}
          {...events}
          className={`absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 rounded-full outline-offset-2 transition-[outline-color] duration-[120ms] focus-visible:outline-2 focus-visible:outline-teal-bright ${
            pressed || (hovered && !ghost) ? "outline-2 outline-teal-bright" : "outline-0 outline-transparent"
          } ${
            ghost ? "pointer-events-auto cursor-default" : "pointer-events-auto cursor-pointer"
          }`}
          style={{ width: 20, height: 20 }}
        />
      )}
      {label}
    </div>
  );
});
