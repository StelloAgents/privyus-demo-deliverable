"use client";

import { createContext, createElement, memo, useContext, type CSSProperties, type ReactNode } from "react";
import { Handle, Position, useStore, type Node, type NodeProps } from "@xyflow/react";
import { motion } from "motion/react";
import { Plus } from "lucide-react";
import { initialsOf, splitBillLabel } from "@/lib/catalog";
import { iconForEntity } from "@/lib/icons";
import { MOTION } from "@/lib/motion";
import type { Entity } from "@/lib/types";
import { LABEL_WIDTH, NODE_SIZE, PLUS_SIZE, nodeBox } from "./geometry";

export type PrivyNodeData = {
  entity: Entity;
  isRoot: boolean;
  /** The orange focus. */
  focused: boolean;
  /** Root glow shows only when nothing else has focus. */
  glow: boolean;
  /** On the focus path (root to focus). */
  onPath: boolean;
  /** Outside the one-hop context of the focus: low opacity, label on hover only. */
  dimmed: boolean;
  /** Ghost context (GraphDelta.ghost): low opacity, label on hover only, no focus. */
  ghost: boolean;
  /** Has unloaded neighbors: the "+" control shows on hover. */
  hasMore: boolean;
  /** Plays the enter motion after this delay (ms). */
  enterDelay: number;
  animate: boolean;
  reduced: boolean;
};

export type PrivyNode = Node<PrivyNodeData, "privy">;

/** Callbacks that the node components call. GraphCanvas provides them. */
export const GraphActionsContext = createContext<{
  onExpand?: (id: string) => void;
  /** Overlay areas (header, controls). Ghost nodes inside them hide. */
  insets?: { top?: number; right?: number; bottom?: number; left?: number };
}>({});

/**
 * Where the node sits against the overlay areas (insets) and the canvas edge:
 * 0 = clear, 1 = its label crosses an inset or the edge, 2 = its circle does too.
 * Selecting a small number keeps re-renders rare during pans.
 */
type Insets = { top?: number; right?: number; bottom?: number; left?: number };
type RFState = Parameters<Parameters<typeof useStore>[0]>[0];

/** 0 = clear, 1 = label cut by an inset or the edge, 2 = circle cut. */
export function insetStateOf(st: RFState, id: string, entity: Entity, insets: Insets | undefined): number {
  const n = st.nodeLookup.get(id);
  if (!n) return 0;
  const size = NODE_SIZE[entity.type];
  const [tx, ty, zoom] = st.transform;
  const top = insets?.top ?? 0;
  const bottom = st.height - (insets?.bottom ?? 0);
  const left = insets?.left ?? 0;
  const right = st.width - (insets?.right ?? 0);
  const cx = (n.internals.positionAbsolute.x + size / 2) * zoom + tx;
  const cy = (n.internals.positionAbsolute.y + size / 2) * zoom + ty;
  const r = (size / 2) * zoom;
  if (cy - r < top || cy + r > bottom || cx - r < left || cx + r > right) return 2;
  const b = nodeBox(entity.type, entity.label, entity.sublabel);
  const lx0 = cx - (b.w / 2) * zoom;
  const lx1 = cx + (b.w / 2) * zoom;
  const ly1 = cy + (b.h - size / 2) * zoom;
  return ly1 > bottom || lx0 < left || lx1 > right ? 1 : 0;
}

/**
 * True when a node is hidden because it would be cut: a node and its label
 * are both fully in view or both out. The focus never hides. Ghost and
 * dimmed context hides only when its circle is cut (its label is hidden anyway).
 */
export function isNodeCut(st: RFState, id: string, insets: Insets | undefined): boolean {
  const n = st.nodeLookup.get(id);
  const data = n?.data as PrivyNodeData | undefined;
  if (!data || data.focused) return false;
  const state = insetStateOf(st, id, data.entity, insets);
  return data.ghost || data.dimmed ? state === 2 : state > 0;
}

function useInsetState(id: string, entity: Entity, active: boolean): number {
  const { insets } = useContext(GraphActionsContext);
  return useStore((st) => (active ? insetStateOf(st, id, entity, insets) : 0));
}

const RING: Record<Entity["type"], number> = {
  topic: 2,
  bill: 2,
  org: 2,
  person: 1.5,
  category: 1.5,
  detail: 1.5,
};


const ICON_SIZE: Record<Entity["type"], number> = {
  topic: 30,
  bill: 24,
  org: 22,
  person: 20,
  category: 18,
  detail: 14,
};

const halo: CSSProperties = {
  textShadow: "0 0 3px var(--label-halo), 0 0 6px var(--label-halo), 0 0 10px var(--label-halo)",
};

function UkraineFlag() {
  return (
    <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true" style={{ borderRadius: 4, display: "block" }}>
      <rect width="34" height="12" fill="var(--flag-ua-blue)" />
      <rect y="12" width="34" height="12" fill="var(--flag-ua-yellow)" />
    </svg>
  );
}

function Label({ entity, width, hidden }: { entity: Entity; width: number; hidden?: boolean }) {
  const t = entity.type;
  let content: ReactNode;
  if (t === "topic") {
    content = (
      <div className="font-display text-[17px] leading-[22px] font-bold text-fg-1">{entity.label}</div>
    );
  } else if (t === "bill") {
    const { number, title } = splitBillLabel(entity);
    content = (
      <>
        <div className="font-display text-[15px] leading-[19px] font-bold text-fg-1">{number}</div>
        {title ? <div className="text-[12px] leading-[16px] font-medium text-fg-2">{title}</div> : null}
      </>
    );
  } else if (t === "person" || t === "org") {
    content = (
      <>
        <div className="text-[13px] leading-[17px] font-semibold text-fg-1">{entity.label}</div>
        {entity.sublabel ? <div className="t-meta">{entity.sublabel}</div> : null}
      </>
    );
  } else if (t === "category") {
    content = (
      <>
        <div className="text-[12px] leading-[16px] font-medium text-fg-2">{entity.label}</div>
        {entity.sublabel ? <div className="text-[11px] leading-[14px] font-medium text-fg-3">{entity.sublabel}</div> : null}
      </>
    );
  } else {
    content = (
      <>
        <div className="line-clamp-2 text-[12px] leading-[16px] font-medium text-fg-1">{entity.label}</div>
        {entity.sublabel ? <div className="text-[11px] leading-[14px] font-medium text-fg-2">{entity.sublabel}</div> : null}
      </>
    );
  }
  return (
    <div
      className={[
        "pointer-events-none absolute left-1/2 flex justify-center text-center transition-opacity duration-[280ms]",
        hidden ? "opacity-0 group-hover:opacity-100" : "opacity-100",
      ].join(" ")}
      style={{ top: "calc(100% + 6px)", width, transform: "translateX(-50%)" }}
    >
      <div data-node-label="" className="rounded-chip px-1.5 py-0.5" style={{ background: "var(--label-bg)", ...halo }}>
        {content}
      </div>
    </div>
  );
}

function PrivyNodeView({ id, data }: NodeProps<PrivyNode>) {
  const { entity, focused, glow, isRoot, dimmed, ghost, hasMore, enterDelay, animate, reduced } = data;
  const { onExpand } = useContext(GraphActionsContext);
  const size = NODE_SIZE[entity.type];
  // Ghost and dimmed context hides under the header and controls. Any other
  // node (except the focus) hides its label when the label would be cut.
  const insetState = useInsetState(id, entity, !focused);
  // A node and its label are both fully in view or both out: a cut circle or
  // label hides the whole node (the focus never hides). Ghost and dimmed
  // context only hides when its circle is cut (its label is hidden anyway).
  const hiddenGhost = (ghost || dimmed) ? insetState === 2 : insetState > 0;
  const hideLabel = dimmed || ghost || insetState > 0;
  // Only the focused node is orange. The root is orange only while nothing else has focus.
  const orange = focused || (isRoot && glow);
  const ring = focused ? 2 : RING[entity.type];
  const isFlag = entity.type === "topic" && /^flag[-_: ]?ua$/i.test(entity.icon ?? "");

  const circleStyle: CSSProperties = {
    width: size,
    height: size,
    borderWidth: ring,
    borderStyle: "solid",
    borderColor: orange ? "var(--orange)" : undefined,
    boxShadow: focused || (isRoot && glow) ? "var(--focus-glow)" : "none",
    transition: `border-color ${MOTION.hoverMs}ms ease, box-shadow ${MOTION.dimMs}ms ease, color ${MOTION.hoverMs}ms ease`,
  };

  const inner =
    entity.type === "person" ? (
      <span className="font-display text-[18px] leading-none font-bold tracking-[0.01em] text-fg-1">
        {initialsOf(entity)}
      </span>
    ) : isFlag ? (
      <UkraineFlag />
    ) : (
      createElement(iconForEntity(entity), { size: ICON_SIZE[entity.type], strokeWidth: 1.5 })
    );

  const plusOffset = size / 2 + (size / 2) * Math.SQRT1_2 - PLUS_SIZE / 2;

  const enter = animate
    ? {
        initial: reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 },
        animate: { opacity: 1, scale: 1 },
        transition: reduced
          ? { duration: 0.18 }
          : { ...MOTION.rootSpring, delay: enterDelay / 1000, opacity: { duration: 0.16, delay: enterDelay / 1000 } },
      }
    : // Keep the target: a node still entering when `animate` turns off finishes its
      // fade (without it, motion stops mid-way and the node stays half drawn).
      { initial: false as const, animate: { opacity: 1, scale: 1 } };

  return (
    <div
      data-focused={focused ? "" : undefined}
      className={[
        "group relative",
        hiddenGhost ? "pointer-events-none opacity-0" : ghost ? "privy-ghost" : dimmed ? "privy-dim" : "opacity-100",
      ].join(" ")}
      style={{
        width: size,
        height: size,
        // Ghost to full fades over 280ms; dimming over 200ms.
        transition: `opacity ${ghost || dimmed ? MOTION.dimMs : MOTION.edgeDrawMs}ms ease`,
      }}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />
      <Handle type="source" position={Position.Bottom} isConnectable={false} />
      <motion.div className="relative h-full w-full" {...enter}>
        <div
          className={[
            "flex items-center justify-center rounded-full bg-surface-1",
            orange
              ? "text-fg-1"
              : "border-teal text-teal group-hover:border-teal-bright group-hover:text-teal-bright",
          ].join(" ")}
          style={circleStyle}
        >
          {inner}
        </div>
        <Label entity={entity} width={LABEL_WIDTH[entity.type]} hidden={hideLabel} />
        {hasMore && onExpand && !ghost ? (
          <button
            type="button"
            aria-label={`Show more about ${entity.label}`}
            className="nodrag nopan absolute flex scale-60 items-center justify-center rounded-full border border-teal bg-surface-2 text-teal-bright opacity-0 transition-[opacity,transform,background-color] duration-[120ms] group-hover:scale-100 group-hover:opacity-100 hover:bg-surface-3 focus-visible:scale-100 focus-visible:opacity-100"
            style={{ width: PLUS_SIZE, height: PLUS_SIZE, left: plusOffset, top: plusOffset }}
            onClick={(e) => {
              e.stopPropagation();
              onExpand(id);
            }}
          >
            <Plus size={12} strokeWidth={2} />
          </button>
        ) : null}
      </motion.div>
    </div>
  );
}

export const PrivyNodeComponent = memo(PrivyNodeView);

export const nodeTypes = { privy: PrivyNodeComponent };
