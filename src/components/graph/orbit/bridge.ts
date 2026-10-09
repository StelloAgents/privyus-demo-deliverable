import type { RingKey } from "../orbit-layout";

/**
 * The link between the orbit scene (WebGL, inside the canvas) and its DOM
 * overlay (labels and hit targets, outside the canvas). React renders the
 * overlay elements and registers them here; the scene's frame loop projects
 * every node and writes their screen positions. Nothing in it re-renders React.
 */
export interface NodeEls {
  root: HTMLElement;
  hit?: HTMLElement | null;
  label?: HTMLElement | null;
}

export interface NoteEls {
  el: HTMLElement;
  leader: SVGLineElement | null;
  dot: SVGCircleElement | null;
}

export interface OrbitBridge {
  nodes: Map<string, NodeEls>;
  edgeLabels: Map<string, HTMLElement>;
  ringLabels: Map<RingKey, HTMLElement>;
  /** Dial labels (each carries its day in `data-day`). */
  dial: Map<string, HTMLElement>;
  /** The note of the answer, its leader line, and the date chips (keyed by node id). */
  note: NoteEls | null;
  /** Registers the note's elements; `null` with the elements to remove them (only if still registered). */
  setNote: (note: NoteEls | null, prev?: NoteEls) => void;
  chips: Map<string, HTMLElement>;
  /** Space (px) taken by the header and the controls over the canvas. */
  insets: { top: number; right: number; bottom: number; left: number };
  setInsets: (insets: OrbitBridge["insets"]) => void;
  /** Set by the scene: camera actions for the canvas controls. */
  camera: { fit: (instant?: boolean) => void; zoom: (dir: 1 | -1) => void } | null;
}

export function createBridge(): OrbitBridge {
  const bridge: OrbitBridge = {
    nodes: new Map(),
    edgeLabels: new Map(),
    ringLabels: new Map(),
    dial: new Map(),
    note: null,
    setNote: (note, prev) => {
      if (note || !prev || bridge.note === prev) bridge.note = note;
    },
    chips: new Map(),
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
    setInsets: (insets) => {
      bridge.insets = insets;
    },
    camera: null,
  };
  return bridge;
}
