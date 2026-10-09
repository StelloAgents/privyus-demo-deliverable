/**
 * Geometry for the presenter spotlight: the cutouts around the targets, what a
 * caption must not cover, and where the caption goes.
 *
 * The caption rule (PRESENTER-MODE.md section 2):
 * - A target that includes the graph is large: the caption docks inside the
 *   graph, in its emptiest region (least node, label, and edge cover, away
 *   from the focus), never over the canvas controls, the graph header, or the
 *   Save button.
 * - A small target inside the graph (the Save button): the caption docks in
 *   the graph, as near to the target as it can.
 * - Any other target is small: the caption sits beside the cutout.
 * - On Explore the caption never covers the Exploration Chat panel.
 */

import { sampleCanvasEdges } from "@/lib/graph-scene";

export type Rect = { x: number; y: number; w: number; h: number };
/** A cutout and the `data-tour` id it was measured from. */
export type Hole = Rect & { id: string };
type Weighted = Rect & { k: number };
type Pt = { x: number; y: number; k: number };

export const PAD = 8; // cutout padding around the target
const GAP = 16; // caption distance from the cutout
const EDGE = 16; // caption distance from the window edge
const EDGE_BOTTOM = 44; // keeps the caption above the disclaimer footer
const TOP_BAR = 88; // the top bar stays clear when any other spot fits
export const CARD_W = 360;
/** Caption widths to try: a wider (shorter) caption can fit where a tall one cannot. */
const WIDTHS = [CARD_W, 400, 480, 540];
/**
 * Caption widths to try when docked in the graph, in order of preference. The
 * body wraps at 44ch, so wider than 400 does not help; a narrower caption
 * (taller, about 34 characters a line) fits between nodes where 360 cannot.
 */
const DOCK_WIDTHS = [CARD_W, 400, 320];
/** Inset of a docked caption from the graph panel edge. */
const DOCK_MARGIN = 16;
/** Grid step of the docked-caption scan. */
const DOCK_STEP = 8;
/** Below this distance (px) from the focused node and its label a docked caption pays a cost. */
const FOCUS_CLEAR = 48;
/** Cost per px of distance from a small target, for a caption docked in the graph for it. */
const NEAR_PULL = 12;
/** Fixed cost of touching an obstacle at all (times its weight): a graze is never free. */
const TOUCH = 400;

/** Union rect (padded, inside the window) of every element with `data-tour="<id>"`, or null when none is on screen. */
export function measureTarget(id: string): Hole | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(id)}"]`).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    x0 = Math.min(x0, r.left);
    y0 = Math.min(y0, r.top);
    x1 = Math.max(x1, r.right);
    y1 = Math.max(y1, r.bottom);
  });
  if (!isFinite(x0)) return null;
  const vx0 = Math.max(0, x0 - PAD);
  const vy0 = Math.max(0, y0 - PAD);
  const vx1 = Math.min(window.innerWidth, x1 + PAD);
  const vy1 = Math.min(window.innerHeight, y1 + PAD);
  return { id, x: vx0, y: vy0, w: Math.max(0, vx1 - vx0), h: Math.max(0, vy1 - vy0) };
}

export function sameRects(a: Rect[], b: Rect[], tol = 0.5): boolean {
  return (
    a.length === b.length &&
    a.every((r, i) => Math.abs(r.x - b[i].x) < tol && Math.abs(r.y - b[i].y) < tol && Math.abs(r.w - b[i].w) < tol && Math.abs(r.h - b[i].h) < tol)
  );
}

const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const overlapArea = (a: Rect, b: Rect) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const inside = (p: { x: number; y: number }, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const fromDom = (r: DOMRect, m = 0): Rect => ({ x: r.left - m, y: r.top - m, w: r.width + 2 * m, h: r.height + 2 * m });

/**
 * How strongly each thing counts against a caption, per px² covered. A node or
 * label at full strength (and an edge label) is what the step is about: it
 * counts many times more than faint context, so a caption covers a ghost or
 * dimmed node only when no spot clear of full-strength content exists.
 */
const K_FULL = 6;
const K_GHOST = 0.4;
const K_DIM = 0.5;
/** Faint edges barely draw; the orange focus path counts most. */
const K_EDGE = { full: 1, faint: 0.15, path: 4 };
/** Cost of one sampled edge point under the caption (about a 6x6 px patch of line). */
const EDGE_PT = 36;

/** What a caption should avoid inside the graph, read once per placement. */
interface GraphScene {
  /** Node circles, visible labels, and edge labels, weighted by how strongly they draw. */
  obstacles: Weighted[];
  /** Points sampled along the drawn edges, weighted the same way (the orange path counts most). */
  edgePts: Pt[];
  /** The focused node (circle and label), which a caption never covers. */
  focus: Rect[];
  /** Graph header, canvas controls: never covered. */
  avoid: Rect[];
}

function readGraph(): GraphScene {
  const scene: GraphScene = { obstacles: [], edgePts: [], focus: [], avoid: [] };
  document.querySelectorAll<HTMLElement>('[data-tour="graph"]').forEach((g) => {
    const box = g.getBoundingClientRect();
    const clip = (r: DOMRect, m: number): Rect | null => {
      const x0 = Math.max(r.left, box.left);
      const y0 = Math.max(r.top, box.top);
      const x1 = Math.min(r.right, box.right);
      const y1 = Math.min(r.bottom, box.bottom);
      return x1 > x0 && y1 > y0 ? { x: x0 - m, y: y0 - m, w: x1 - x0 + 2 * m, h: y1 - y0 + 2 * m } : null;
    };
    g.querySelectorAll("[data-caption-avoid]").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) scene.avoid.push(fromDom(r, 8));
    });
    g.querySelectorAll(".react-flow__node").forEach((n) => {
      const root = n.firstElementChild;
      const cls = root?.classList;
      if (!cls || cls.contains("opacity-0")) return;
      const k = cls.contains("privy-ghost") ? K_GHOST : cls.contains("privy-dim") ? K_DIM : K_FULL;
      const focused = root.hasAttribute("data-focused");
      const parts: Element[] = [];
      const circle = n.querySelector(".rounded-full");
      if (circle) parts.push(circle);
      const label = n.querySelector("[data-node-label]");
      // A hidden label (its wrapper has opacity-0) shows on hover only.
      if (label && !label.parentElement?.classList.contains("opacity-0")) parts.push(label);
      for (const el of parts) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (focused) {
          const c = clip(r, 16);
          if (c) scene.focus.push(c);
        } else {
          const c = clip(r, 6);
          if (c) scene.obstacles.push({ ...c, k });
        }
      }
    });
    // The orbit graph (WebGL): nodes, labels, and ring labels are DOM overlays; edges come from the canvas sampler.
    const shown = (el: Element) => getComputedStyle(el).visibility === "visible";
    g.querySelectorAll<HTMLElement>("[data-graph-node]").forEach((n) => {
      const state = n.getAttribute("data-state");
      if (!state || state === "hidden" || !shown(n)) return;
      const k = state === "ghost" || state === "faint" ? K_GHOST : state === "dim" || (state === "hint" && !n.hasAttribute("data-emphasis")) ? K_DIM : K_FULL;
      const focused = n.hasAttribute("data-focused") || state === "center";
      const parts: Element[] = [];
      const circle = n.querySelector("[data-node-hit]");
      if (circle) parts.push(circle);
      const label = n.querySelector("[data-node-label]");
      if (label && shown(label)) parts.push(label);
      for (const el of parts) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        const c = clip(r, focused ? 16 : 6);
        if (!c) continue;
        if (focused) scene.focus.push(c);
        else scene.obstacles.push({ ...c, k });
      }
    });
    g.querySelectorAll<HTMLElement>("[data-ring-label]").forEach((l) => {
      if (!shown(l)) return;
      const c = clip(l.getBoundingClientRect(), 6);
      if (c) scene.obstacles.push({ ...c, k: K_FULL });
    });
    for (const p of sampleCanvasEdges()) {
      if (p.x >= box.left && p.x <= box.right && p.y >= box.top && p.y <= box.bottom) {
        scene.edgePts.push({ x: p.x, y: p.y, k: p.weight === "path" ? K_EDGE.path : p.weight === "full" ? K_EDGE.full : K_EDGE.faint });
      }
    }
    g.querySelectorAll<HTMLElement>("[data-orbit-overlay] [data-edge-label]").forEach((l) => {
      if (!shown(l)) return;
      const c = clip(l.getBoundingClientRect(), 6);
      if (c) scene.obstacles.push({ ...c, k: K_FULL });
    });
    g.querySelectorAll<HTMLElement>(".react-flow__edgelabel-renderer [data-edge-label]").forEach((l) => {
      const c = clip(l.getBoundingClientRect(), 6);
      if (c) scene.obstacles.push({ ...c, k: K_FULL });
    });
    g.querySelectorAll<SVGPathElement>("path.react-flow__edge-path").forEach((p) => {
      const o = p.style.opacity;
      if (o === "0") return;
      const onPath = p.hasAttribute("data-on-path");
      const k = onPath ? K_EDGE.path : o.includes("ghost") || o.includes("dim") ? K_EDGE.faint : K_EDGE.full;
      const m = p.getScreenCTM();
      if (!m) return;
      let len = 0;
      try {
        len = p.getTotalLength();
      } catch {
        return;
      }
      const n = Math.max(2, Math.ceil((len * Math.hypot(m.a, m.b)) / 10));
      for (let i = 0; i <= n; i++) {
        const q = p.getPointAtLength((len * i) / n);
        const x = m.a * q.x + m.c * q.y + m.e;
        const y = m.b * q.x + m.d * q.y + m.f;
        if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) scene.edgePts.push({ x, y, k });
      }
    });
  });
  return scene;
}

/** The graph panel, when it is on screen. */
function graphRect(): Rect | null {
  const r = document.querySelector('[data-tour="graph"]')?.getBoundingClientRect();
  return r && r.width && r.height ? fromDom(r) : null;
}

/** The Exploration Chat panel (padded), when it is on screen. */
function chatRect(): Rect | null {
  const el = document.querySelector('[data-tour="explore-chat"]');
  const r = el?.getBoundingClientRect();
  return r && r.width && r.height ? fromDom(r, PAD) : null;
}

const union = (rs: Rect[]): Rect =>
  rs.reduce((u, r) => {
    const x0 = Math.min(u.x, r.x);
    const y0 = Math.min(u.y, r.y);
    return { x: x0, y: y0, w: Math.max(u.x + u.w, r.x + r.w) - x0, h: Math.max(u.y + u.h, r.y + r.h) - y0 };
  });

/** A caption spot. `tier` ranks the kind of spot; within a tier, `cost` decides. */
interface Candidate {
  x: number;
  y: number;
  w: number;
  tier: number;
  cost: number;
}

export interface Placement {
  x: number;
  y: number;
  w: number;
  /** True when the caption sits inside a target. */
  docked: boolean;
  /** Cover cost of the chosen spot (0: nothing under it). */
  cost: number;
}

/** Lowest cost wins; earlier candidates win near-ties (stable, deterministic). */
function best(list: Candidate[]): Candidate {
  let b = list[0];
  for (const c of list) if (c.cost < b.cost - 1) b = c;
  return b;
}

/**
 * Where the caption goes, given the cutouts and the caption height at a width.
 * A target that includes the graph: dock inside the graph (see `dock`). Else
 * beside a target at the narrowest width that fits; else any spot outside the
 * targets; else docked inside the largest target. On Explore no spot covers the
 * chat panel.
 */
export function placeCaption(holes: Hole[], heightAt: (w: number) => number): Placement {
  const W = window.innerWidth;
  const H = window.innerHeight;
  if (holes.length === 0) {
    const h = heightAt(CARD_W);
    return { x: (W - CARD_W) / 2, y: (H - h) / 2, w: CARD_W, docked: false, cost: 0 };
  }
  const scene = readGraph();
  const chat = chatRect();
  const graph = holes.find((r) => r.id === "graph");
  if (graph) return dock(graph, heightAt, scene, chat);
  // A small target inside the graph (the Save button in the graph header): every spot beside it
  // covers the header, so the caption docks in the graph as near to the target as it can.
  const panel = graphRect();
  if (panel && holes.every((r) => r.x >= panel.x - PAD && r.y >= panel.y - PAD && r.x + r.w <= panel.x + panel.w + PAD && r.y + r.h <= panel.y + panel.h + PAD)) {
    return dock(panel, heightAt, scene, chat, union(holes));
  }

  const all = union(holes);
  // The union of the targets stays clear only when the targets sit together
  // (side by side panels); a union of far-apart targets would block the page.
  const area = holes.reduce((a, r) => a + r.w * r.h, 0);
  const noGo: Rect[] = holes.length > 1 && all.w * all.h <= 1.5 * area ? [...holes, all] : [...holes];
  if (chat) noGo.push(chat);
  const topBar = { x: 0, y: 0, w: W, h: TOP_BAR };
  const box = (c: { x: number; y: number }, w: number, h: number) => ({ x: c.x - 4, y: c.y - 4, w: w + 8, h: h + 8 });
  // Beside a target, the graph header and canvas controls count as content at full strength.
  const cover = (b: Rect) => coverCost(b, scene) + scene.avoid.reduce((a, r) => a + overlapArea(b, r) * K_FULL, 0);
  const inWindow = (c: { x: number; y: number }, w: number, h: number) =>
    c.x >= EDGE - 0.5 && c.y >= EDGE - 0.5 && c.x + w <= W - EDGE + 0.5 && c.y + h <= H - EDGE_BOTTOM + 0.5;
  const ux = all.x + all.w / 2;
  const uy = all.y + all.h / 2;

  // Beside a target: every width; a clear spot at the narrowest width wins, else the least cover.
  const beside: Candidate[] = [];
  for (let wi = 0; wi < WIDTHS.length; wi++) {
    const w = WIDTHS[wi];
    const h = heightAt(w);
    const clampX = (x: number) => Math.max(EDGE, Math.min(x, W - EDGE - w));
    const clampY = (y: number) => Math.max(EDGE, Math.min(y, H - EDGE_BOTTOM - h));
    // Beside a target or the union of the targets, then the corners.
    // Each side at three alignments (centered on the target, then flush with either end), at the
    // full gap and then at half of it (a half gap can clear a node the full gap would touch).
    const sides: { x: number; y: number }[] = [];
    for (const gap of [GAP, GAP / 2]) {
      for (const r of [all, ...holes]) {
        const ys = [r.y + r.h / 2 - h / 2, r.y, r.y + r.h - h].map(clampY);
        const xs = [r.x + r.w / 2 - w / 2, r.x, r.x + r.w - w].map(clampX);
        for (const cy of ys) sides.push({ x: r.x + r.w + gap, y: cy }, { x: r.x - gap - w, y: cy });
        for (const cx of xs) sides.push({ x: cx, y: r.y + r.h + gap }, { x: cx, y: r.y - gap - h });
      }
    }
    sides.push({ x: W - EDGE - w, y: H - EDGE - h - 40 }, { x: EDGE, y: H - EDGE - h - 40 }, { x: W - EDGE - w, y: EDGE + 80 }, { x: EDGE, y: EDGE + 80 });
    for (const c of sides) {
      if (inWindow(c, w, h) && !overlaps(box(c, w, h), topBar) && noGo.every((r) => !overlaps(box(c, w, h), r))) {
        beside.push({ ...c, w, tier: wi, cost: cover(box(c, w, h)) });
      }
    }
  }
  if (beside.length) {
    const clear = beside.find((c) => c.cost < 1);
    const b = clear ?? best(beside.map((c) => ({ ...c, cost: c.cost + c.tier * 400 })));
    return { x: b.x, y: b.y, w: b.w, docked: false, cost: clear ? 0 : cover(box(b, b.w, heightAt(b.w))) };
  }
  for (const w of WIDTHS) {
    const h = heightAt(w);
    // No side fits: scan the window for a spot outside the targets (and the chat), nearest to them.
    const clear: Candidate[] = [];
    for (let y = EDGE; y <= H - EDGE_BOTTOM - h; y += 12) {
      for (let x = EDGE; x <= W - EDGE - w; x += 12) {
        const b = box({ x, y }, w, h);
        if (noGo.some((r) => overlaps(b, r))) continue;
        clear.push({ x, y, w, tier: 1, cost: Math.hypot(x + w / 2 - ux, y + h / 2 - uy) + cover(b) });
      }
    }
    if (clear.length) {
      const b = best(clear);
      return { x: b.x, y: b.y, w, docked: false, cost: cover(box(b, w, h)) };
    }
  }
  // The targets fill the window: dock inside the largest target.
  const big = holes.reduce((a, r) => (r.w * r.h > a.w * a.h ? r : a));
  return dock(big, heightAt, scene, chat);
}

/** Weighted cover of a caption box: nodes, labels, edge labels, and edge points under it (`strongOnly`: full-strength ones and the focus path). */
function coverCost(b: Rect, scene: GraphScene, strongOnly = false): number {
  let c = 0;
  for (const r of scene.obstacles) {
    if (strongOnly && r.k < K_FULL) continue;
    const a = overlapArea(b, r);
    if (a > 0) c += (TOUCH + a) * r.k;
  }
  for (const p of scene.edgePts) if ((!strongOnly || p.k >= K_EDGE.path) && inside(p, b)) c += EDGE_PT * p.k;
  return c;
}

/**
 * Docks the caption inside `host` (the graph, or the largest target): a grid
 * scan of the host below its header, scored by what the caption covers, plus a
 * cost for coming near the focused node and a small pull to the host's edges
 * (a docked caption reads as an annotation in a corner, not a card in the
 * middle), or, with `near`, a pull to that small target. Never over the focus, the header, the canvas controls, or the chat.
 */
function dock(host: Rect, heightAt: (w: number) => number, scene: GraphScene, chat: Rect | null, near?: Rect): Placement {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const hard = [...scene.avoid, ...scene.focus, ...(chat ? [chat] : [])];
  const fc = scene.focus.length ? union(scene.focus) : null;
  const list: Candidate[] = [];
  for (let wi = 0; wi < DOCK_WIDTHS.length; wi++) {
    const w = DOCK_WIDTHS[wi];
    const h = heightAt(w);
    // Docked for a small target, the caption may sit closer to the panel edge (it reads as attached to the target).
    const margin = near ? DOCK_MARGIN / 2 : DOCK_MARGIN;
    const x0 = Math.max(EDGE, host.x + PAD + margin);
    const x1 = Math.min(host.x + host.w - PAD - margin - w, W - EDGE - w);
    // Below the graph header (an avoid rect across the top of the host).
    const header = scene.avoid.filter((r) => r.y <= host.y + 40 && r.w > host.w / 2).reduce((a, r) => Math.max(a, r.y + r.h + 4), 0);
    const y0 = Math.max(EDGE, TOP_BAR, host.y + PAD + DOCK_MARGIN, header);
    const y1 = Math.min(host.y + host.h - PAD - DOCK_MARGIN - h, H - EDGE_BOTTOM - h);
    if (x1 < x0 || y1 < y0) continue;
    // Scan from the bottom-right: on equal cost the lower-right spot wins.
    const xs: number[] = [];
    for (let x = x1; x >= x0; x -= DOCK_STEP) xs.push(x);
    if (xs[xs.length - 1] !== x0) xs.push(x0);
    const ys: number[] = [];
    for (let y = y1; y >= y0; y -= DOCK_STEP) ys.push(y);
    if (ys[ys.length - 1] !== y0) ys.push(y0);
    for (const y of ys) {
      for (const x of xs) {
        const b = { x: x - 4, y: y - 4, w: w + 8, h: h + 8 };
        if (hard.some((r) => overlaps(b, r))) continue;
        // Docked for a small target, only full-strength content counts: faint context may sit under it.
        let cost = coverCost(b, scene, !!near);
        if (fc) {
          const dx = Math.max(b.x - (fc.x + fc.w), 0, fc.x - (b.x + b.w));
          const dy = Math.max(b.y - (fc.y + fc.h), 0, fc.y - (b.y + b.h));
          cost += Math.max(0, FOCUS_CLEAR - Math.hypot(dx, dy)) * 10;
        }
        if (near) {
          // Docked for a small target: a pull to the target.
          const dx = Math.max(b.x - (near.x + near.w), 0, near.x - (b.x + b.w));
          const dy = Math.max(b.y - (near.y + near.h), 0, near.y - (b.y + b.h));
          cost += Math.hypot(dx, dy) * NEAR_PULL;
        } else {
          // A light pull to the edges (a tie-breaker): distance to the nearest side and to the nearest top or bottom.
          cost += (Math.min(x - x0, x1 - x) + Math.min(y - y0, y1 - y)) / 4;
        }
        // A wider caption only wins on a clear gain.
        cost += wi * 400;
        list.push({ x, y, w, tier: 9, cost });
      }
    }
  }
  if (list.length) {
    const b = best(list);
    const h = heightAt(b.w);
    return { x: b.x, y: b.y, w: b.w, docked: true, cost: coverCost({ x: b.x - 4, y: b.y - 4, w: b.w + 8, h: h + 8 }, scene) };
  }
  // Nothing clear of the header and the focus (a very small host): bottom-right of the host.
  const h = heightAt(CARD_W);
  return {
    x: Math.max(EDGE, Math.min(host.x + host.w - PAD - DOCK_MARGIN - CARD_W, W - EDGE - CARD_W)),
    y: Math.max(EDGE, Math.min(host.y + host.h - PAD - DOCK_MARGIN - h, H - EDGE_BOTTOM - h)),
    w: CARD_W,
    docked: true,
    cost: Infinity,
  };
}

/** Where a caption's notch goes: the edge facing the cutout, and the offset (px) along that edge. */
export interface Notch {
  side: "left" | "right" | "top" | "bottom";
  at: number;
}

/** A notch shows only when the caption sits at most this far (px) from a cutout. */
const NOTCH_REACH = GAP + 8;
/** The notch keeps this far (px) from the caption's corners. */
const NOTCH_INSET = 16;

/**
 * The notch for a caption beside a cutout: on the caption edge that faces the
 * nearest cutout, centered on the part of the edge the cutout spans. Null when
 * no cutout is near or none faces an edge (a caption in a corner of a target).
 */
export function notchFor(card: { x: number; y: number; w: number; h: number }, holes: Rect[]): Notch | null {
  let best: (Notch & { gap: number }) | null = null;
  const consider = (side: Notch["side"], gap: number, lo: number, hi: number, len: number) => {
    if (gap < -0.5 || gap > NOTCH_REACH) return;
    const a = Math.max(lo, NOTCH_INSET);
    const b = Math.min(hi, len - NOTCH_INSET);
    if (b < a) return;
    if (!best || gap < best.gap) best = { side, at: (a + b) / 2, gap };
  };
  for (const r of holes) {
    // The span of the cutout along each caption edge, relative to the caption.
    const ySpan: [number, number] = [r.y - card.y, r.y + r.h - card.y];
    const xSpan: [number, number] = [r.x - card.x, r.x + r.w - card.x];
    consider("left", card.x - (r.x + r.w), ySpan[0], ySpan[1], card.h);
    consider("right", r.x - (card.x + card.w), ySpan[0], ySpan[1], card.h);
    consider("top", card.y - (r.y + r.h), xSpan[0], xSpan[1], card.w);
    consider("bottom", r.y - (card.y + card.h), xSpan[0], xSpan[1], card.w);
  }
  if (!best) return null;
  const { side, at } = best as Notch & { gap: number };
  return { side, at: Math.round(at) };
}
