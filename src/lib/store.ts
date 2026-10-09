"use client";

import { create } from "zustand";
import { layoutGraph, makeLayoutConfig, type LayoutConfig } from "@/components/graph/graph-layout";
import { makeOrbitConfig, orbitPositions, type OrbitConfig } from "@/components/graph/orbit-layout";
import type { Catalog, GraphDelta, GraphSnapshot, Viewport, XY } from "./types";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

let layoutConfig: LayoutConfig | null = null;
let orbitConfig: OrbitConfig | null = null;

/**
 * "orbit": the 3D orbit layout (Explore's default graph), a pure function of
 * the graph content and the focus. "force": the 2D force layout (the React
 * Flow graph), anchored on the positions before each change.
 */
export type GraphLayoutKind = "orbit" | "force";

/**
 * Makes graph positions part of the store: every change (a delta, a focus
 * change) lays the graph out once. The same sequence of changes always gives
 * the same positions. Call once per catalog, at module scope, before any delta
 * applies.
 */
export function configureGraphLayout(catalog: Catalog, rootId?: string, kind: GraphLayoutKind = "force"): void {
  if (kind === "orbit") {
    if (orbitConfig?.catalog === catalog && orbitConfig.rootId === rootId && !layoutConfig) return;
    layoutConfig = null;
    orbitConfig = makeOrbitConfig(catalog, rootId);
    return;
  }
  if (layoutConfig?.catalog === catalog && layoutConfig.rootId === rootId && !orbitConfig) return;
  orbitConfig = null;
  layoutConfig = makeLayoutConfig(catalog, rootId);
}

/** The orbit layout config, when the store lays the graph out as an orbit. */
export function getOrbitConfig(): OrbitConfig | null {
  return orbitConfig;
}

/** Positions for `next`, laid out from `prev`. Unchanged positions when no layout is configured. */
function positionsFor(prev: GraphState, next: Omit<GraphState, "positions">): Record<string, XY> {
  if (orbitConfig) return orbitPositions(orbitConfig, next);
  if (!layoutConfig) return prev.positions;
  return layoutGraph(layoutConfig, prev, next);
}

/* ------------------------------------------------------------------ */
/* Chat state                                                          */
/* ------------------------------------------------------------------ */

export type StepStatus = "pending" | "active" | "done";
export type TurnPhase = "thinking" | "streaming" | "done";

export interface ChatTurnState {
  /** Unique per played turn (a turn can play twice). */
  key: string;
  turnId: string;
  /** What the user typed or clicked. Empty for narration of a node click. */
  question?: string;
  steps: { label: string; status: StepStatus }[];
  /** The full answer text. */
  answer: string;
  /** How many words of the answer show now (streaming). */
  shownWords: number;
  phase: TurnPhase;
  /** For the folded line "Thought for 3s". */
  thoughtSeconds: number;
  citations: string[];
  suggestions: string[];
}

/** The answer text that shows now, for a turn that streams word by word. */
export function visibleAnswer(turn: ChatTurnState): string {
  if (turn.phase === "done") return turn.answer;
  if (turn.shownWords <= 0) return "";
  const words = turn.answer.split(/(\s+)/);
  // words alternates [word, space, word, ...]; keep shownWords words.
  return words.slice(0, turn.shownWords * 2 - 1).join("");
}

/* ------------------------------------------------------------------ */
/* Graph state                                                         */
/* ------------------------------------------------------------------ */

/**
 * Which reasoning step a scripted graph change belongs to. The orbit graph
 * times its build-in from these (the ring sweep at the step that adds the
 * records, the edges at the next step, the context at the last), so the graph
 * and the steps in the chat stay in sync however fast the turn plays.
 */
export interface BuildCue {
  /** The played turn (ChatTurnState.key). */
  key: string;
  /** The step that just completed (0-based), and the number of steps. */
  step: number;
  steps: number;
  /** Time between two steps. */
  stepMs: number;
}

export interface GraphState extends GraphSnapshot {
  /** "animate" plays the build motion for new nodes; "instant" places them. */
  motion: "animate" | "instant";
  /** Increases on every change the canvas must react to. */
  revision: number;
  /** The last entity the user or the script asked to expand. */
  lastExpanded?: string;
  /** Increases on every `loadGraph` (checkpoint load, deep link, presenter step state): the canvas places nodes exactly. */
  loadToken?: number;
  /** Nodes the user dragged: the layout keeps them in place. */
  pinned?: string[];
  /** The reasoning step of the last change, when a played turn made it (animated only). */
  cue?: BuildCue;
}

const EMPTY_GRAPH: GraphState = {
  entityIds: [],
  edgeIds: [],
  ghostEntityIds: [],
  ghostEdgeIds: [],
  focusId: undefined,
  expanded: [],
  positions: {},
  viewport: undefined,
  motion: "animate",
  revision: 0,
};

export interface DemoStore {
  graph: GraphState;
  chat: ChatTurnState[];

  /** Adds the delta's entities and edges, and sets focus and expand. */
  applyDelta: (delta: GraphDelta, opts?: { instant?: boolean; cue?: BuildCue }) => void;
  /** Sets the orange focus. `undefined` clears it. */
  setFocus: (id?: string) => void;
  /** The canvas writes back dragged positions here. They stay pinned. */
  setPositions: (positions: Record<string, XY>) => void;
  /** The canvas writes back the viewport after a pan or zoom. */
  setViewport: (viewport: Viewport) => void;
  /** Replaces the whole graph (checkpoint load, deep link). No animation. */
  loadGraph: (snapshot: GraphSnapshot) => void;
  /** Marks the current graph as loaded: the canvas places it exactly, with no animation, and refits. */
  markLoaded: () => void;
  resetGraph: () => void;
  /** The serializable graph, for checkpoints. */
  snapshot: () => GraphSnapshot;

  pushTurn: (turn: ChatTurnState) => void;
  updateTurn: (key: string, patch: Partial<ChatTurnState>) => void;
  setChat: (turns: ChatTurnState[]) => void;
  clearChat: () => void;
}

function uniqueAppend(list: string[], add: string[]): string[] {
  if (add.length === 0) return list;
  const seen = new Set(list);
  const out = list.slice();
  for (const id of add) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export const useDemoStore = create<DemoStore>((set, get) => ({
  graph: EMPTY_GRAPH,
  chat: [],

  applyDelta: (delta, opts) =>
    set((s) => {
      const g = s.graph;
      const entityIds = uniqueAppend(g.entityIds, delta.add.entities);
      const edgeIds = uniqueAppend(g.edgeIds, delta.add.edges);
      const realEnt = new Set(entityIds);
      const realEdge = new Set(edgeIds);
      // A ghost that is now added for real leaves the ghost lists (it fades up in place).
      const ghostEntityIds = uniqueAppend(g.ghostEntityIds ?? [], delta.ghost?.entities ?? []).filter(
        (id) => !realEnt.has(id),
      );
      const ghostEdgeIds = uniqueAppend(g.ghostEdgeIds ?? [], delta.ghost?.edges ?? []).filter(
        (id) => !realEdge.has(id),
      );
      const ghostSet = new Set(ghostEntityIds);
      const next = {
        ...g,
        entityIds,
        edgeIds,
        ghostEntityIds,
        ghostEdgeIds,
        // Ghosts never take focus.
        focusId: delta.focus && !ghostSet.has(delta.focus) ? delta.focus : g.focusId,
        expanded: delta.expand ? uniqueAppend(g.expanded, [delta.expand]) : g.expanded,
        lastExpanded: delta.expand ?? g.lastExpanded,
        motion: (opts?.instant ? "instant" : "animate") as GraphState["motion"],
        cue: opts?.instant ? undefined : opts?.cue,
        revision: g.revision + 1,
      };
      return { graph: { ...next, positions: positionsFor(g, next) } };
    }),

  setFocus: (id) =>
    set((s) => {
      if (id && (s.graph.ghostEntityIds ?? []).includes(id)) return s;
      const next = { ...s.graph, focusId: id, motion: "animate" as const, cue: undefined, revision: s.graph.revision + 1 };
      return { graph: { ...next, positions: positionsFor(s.graph, next) } };
    }),

  setPositions: (positions) =>
    set((s) => ({
      graph: {
        ...s.graph,
        positions: { ...s.graph.positions, ...positions },
        pinned: Array.from(new Set([...(s.graph.pinned ?? []), ...Object.keys(positions)])),
      },
    })),

  setViewport: (viewport) => set((s) => ({ graph: { ...s.graph, viewport } })),

  loadGraph: (snapshot) =>
    set((s) => {
      const next: GraphState = {
        ...EMPTY_GRAPH,
        ...snapshot,
        expanded: snapshot.expanded ?? [],
        positions: snapshot.positions ?? {},
        ghostEntityIds: snapshot.ghostEntityIds ?? [],
        ghostEdgeIds: snapshot.ghostEdgeIds ?? [],
        motion: "instant",
        revision: s.graph.revision + 1,
        loadToken: (s.graph.loadToken ?? 0) + 1,
      };
      // Older snapshots may miss some positions: lay out only those, around the saved ones.
      return { graph: { ...next, positions: positionsFor(next, next) } };
    }),

  markLoaded: () =>
    set((s) => ({
      graph: { ...s.graph, motion: "instant", cue: undefined, revision: s.graph.revision + 1, loadToken: (s.graph.loadToken ?? 0) + 1 },
    })),

  resetGraph: () =>
    set((s) => ({ graph: { ...EMPTY_GRAPH, revision: s.graph.revision + 1, loadToken: s.graph.loadToken } })),

  snapshot: () => {
    const g = get().graph;
    return {
      entityIds: g.entityIds.slice(),
      edgeIds: g.edgeIds.slice(),
      focusId: g.focusId,
      expanded: g.expanded.slice(),
      positions: { ...g.positions },
      viewport: g.viewport ? { ...g.viewport } : undefined,
      ghostEntityIds: (g.ghostEntityIds ?? []).slice(),
      ghostEdgeIds: (g.ghostEdgeIds ?? []).slice(),
    };
  },

  pushTurn: (turn) => set((s) => ({ chat: [...s.chat, turn] })),
  updateTurn: (key, patch) =>
    set((s) => ({ chat: s.chat.map((t) => (t.key === key ? { ...t, ...patch } : t)) })),
  setChat: (turns) => set({ chat: turns }),
  clearChat: () => set({ chat: [] }),
}));
