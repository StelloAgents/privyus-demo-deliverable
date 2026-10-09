"use client";

import { createContext, memo, useContext } from "react";
import { EdgeLabelRenderer, useInternalNode, useStore, type Edge as RFEdge, type EdgeProps } from "@xyflow/react";
import { MOTION } from "@/lib/motion";
import { edgeLabelSize } from "./layout";
import { GraphActionsContext, isNodeCut } from "./nodes";

export type PrivyEdgeData = {
  label: string;
  onPath: boolean;
  dimmed: boolean;
  /** Ghost context edge (GraphDelta.ghost). */
  ghost: boolean;
  hovered: boolean;
  /** Never show a label (for example person to category: it repeats the node name). */
  noLabel: boolean;
  /** Draw-in animation delay (ms). */
  enterDelay: number;
  animate: boolean;
  reduced: boolean;
};

export type PrivyEdgeType = RFEdge<PrivyEdgeData, "privy">;

export type Rect = { x0: number; y0: number; x1: number; y1: number; id: string; kind?: "circle" | "label" };

/** Node + label boxes in flow coordinates. Edge labels avoid them. */
export const LabelObstaclesContext = createContext<Rect[]>([]);

function center(node: ReturnType<typeof useInternalNode>) {
  if (!node) return null;
  const w = node.measured.width ?? 0;
  const h = node.measured.height ?? 0;
  return {
    x: node.internals.positionAbsolute.x + w / 2,
    y: node.internals.positionAbsolute.y + h / 2,
    r: Math.min(w, h) / 2,
  };
}

const CANDIDATES: number[] = [];
for (let k = 0.5, i = 0; i < 19; i++) {
  // 0.50, 0.46, 0.54, 0.42, 0.58, ... out to 0.14 and 0.86
  const off = Math.ceil(i / 2) * 0.04 * (i % 2 ? -1 : 1);
  CANDIDATES.push(Math.round((k + off) * 100) / 100);
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

function PrivyEdgeView({ id, source, target, data }: EdgeProps<PrivyEdgeType>) {
  const s = center(useInternalNode(source));
  const t = center(useInternalNode(target));
  const obstacles = useContext(LabelObstaclesContext);
  const { insets } = useContext(GraphActionsContext);
  // Visible flow-space rectangle inside the insets, rounded to limit re-renders.
  const view = useStore((st) => {
    const [tx, ty, z] = st.transform;
    const r = (v: number) => Math.round(v / 4) * 4;
    return `${r((-tx + (insets?.left ?? 0)) / z)},${r((-ty + (insets?.top ?? 0)) / z)},${r((st.width - tx - (insets?.right ?? 0)) / z)},${r((st.height - ty - (insets?.bottom ?? 0)) / z)}`;
  });
  // An edge to a non-context node that is hidden (cut by the view) hides too,
  // so no edge ends in empty space inside the canvas.
  const endHidden = useStore((st) => {
    const a = st.nodeLookup.get(source)?.data as { dimmed?: boolean; ghost?: boolean } | undefined;
    const b = st.nodeLookup.get(target)?.data as { dimmed?: boolean; ghost?: boolean } | undefined;
    return (
      (!!a && !a.dimmed && !a.ghost && isNodeCut(st, source, insets)) ||
      (!!b && !b.dimmed && !b.ghost && isNodeCut(st, target, insets))
    );
  });
  if (!s || !t || !data) return null;

  const dx = t.x - s.x;
  const dy = t.y - s.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // Trim to the node rims, with a 3px gap.
  const sx = s.x + ux * (s.r + 3);
  const sy = s.y + uy * (s.r + 3);
  const tx = t.x - ux * (t.r + 3);
  const ty = t.y - uy * (t.r + 3);
  // Slight curve: control point offset perpendicular by 7% of the length.
  const bend = len * 0.07;
  const cx = (sx + tx) / 2 - uy * bend;
  const cy = (sy + ty) / 2 + ux * bend;
  const path = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`;

  const { onPath, dimmed, ghost, hovered, animate, enterDelay, reduced, label, noLabel } = data;
  const stroke = onPath ? "var(--orange)" : hovered ? "var(--teal-bright)" : "var(--teal)";
  const strokeOpacity = onPath ? 1 : hovered ? 0.9 : "var(--edge-opacity)";
  const showLabel = !noLabel && (onPath || hovered) && !dimmed && !ghost && len > 110;

  // Place the label at the point of the curve that is clear of every node
  // circle and node label box. A hover label with no clear point hides; a
  // focus-path label takes the least-covered point (the layout keeps one clear).
  let lx = 0;
  let ly = 0;
  let labelVisible = showLabel;
  if (showLabel) {
    const { w, h } = edgeLabelSize(label);
    let best = { score: Infinity, x: 0, y: 0 };
    // On the curve first; a focus-path label may also sit just beside it.
    const offsets = onPath ? [0, h * 0.9, -h * 0.9] : [0];
    const cands: { k: number; o: number }[] = [];
    for (const o of offsets) for (const k of CANDIDATES) cands.push({ k, o });
    for (const { k, o } of cands) {
      const m = 1 - k;
      const px = m * m * sx + 2 * m * k * cx + k * k * tx - uy * o;
      const py = m * m * sy + 2 * m * k * cy + k * k * ty + ux * o;
      const box: Rect = { x0: px - w / 2 - 4, x1: px + w / 2 + 4, y0: py - h / 2 - 3, y1: py + h / 2 + 3, id };
      let score = 0;
      for (const o of obstacles) score += overlapArea(box, o) * (o.kind === "circle" ? 6 : 1);
      if (score === 0) {
        best = { score, x: px, y: py };
        break;
      }
      if (score < best.score) best = { score, x: px, y: py };
    }
    lx = best.x;
    ly = best.y;
    if (best.score > 0 && !onPath) labelVisible = false;
    // Never cut a label at the canvas edge or under an overlay: hide it unless it is fully inside.
    const [vx0, vy0, vx1, vy1] = view.split(",").map(Number);
    if (lx - w / 2 < vx0 || lx + w / 2 > vx1 || ly - h / 2 < vy0 || ly + h / 2 > vy1) labelVisible = false;
  }

  const opacity = endHidden ? 0 : ghost ? "var(--graph-ghost-opacity)" : dimmed ? "var(--graph-dim-opacity)" : 1;
  if (endHidden) labelVisible = false;

  return (
    <>
      <path
        d={path}
        fill="none"
        strokeLinecap="round"
        className="react-flow__edge-path"
        data-on-path={onPath ? "" : undefined}
        pathLength={1}
        style={{
          stroke,
          strokeWidth: onPath ? 2 : 1.25,
          strokeOpacity,
          opacity,
          transition: `opacity ${MOTION.edgeDrawMs}ms ease, stroke ${MOTION.hoverMs}ms ease`,
          strokeDasharray: animate && !reduced ? 1 : undefined,
          animation:
            animate && !reduced
              ? `privy-edge-draw ${MOTION.edgeDrawMs}ms cubic-bezier(0.22, 1, 0.36, 1) ${enterDelay}ms both`
              : animate
                ? `privy-fade-in 180ms ease-out both`
                : undefined,
        }}
      />
      {/* Wide invisible stroke for hover. */}
      <path d={path} fill="none" stroke="transparent" strokeWidth={14} className="react-flow__edge-interaction" />
      {labelVisible ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded-chip border px-2 py-[3px] text-[12px] leading-[16px] font-medium whitespace-nowrap"
            style={{
              transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
              background: "var(--edge-label-bg)",
              borderColor: onPath ? "var(--edge-label-border-path)" : "var(--edge-label-border)",
              color: onPath ? "var(--orange-ink)" : "var(--edge-label-text)",
              animation: `privy-fade-in ${MOTION.hoverMs}ms ease-out both`,
              zIndex: 5,
            }}
            data-edge-label={id}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

export const PrivyEdgeComponent = memo(PrivyEdgeView);
export const edgeTypes = { privy: PrivyEdgeComponent };
