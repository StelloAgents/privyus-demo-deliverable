import { create } from "zustand";
import { NODES, T_END, T_START, nodeAt } from "./data";

export interface ChronosState {
  /** Playhead (ms since epoch). */
  t: number;
  playing: boolean;
  depth: boolean;
  focusId: string | null;
  hoverId: string | null;
  /** Bumped by "Reset view" so the scene flies back to the overview. */
  resetTick: number;
  setT: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setDepth: (d: boolean) => void;
  setFocus: (id: string | null) => void;
  setHover: (id: string | null) => void;
  reset: () => void;
}

export const useChronos = create<ChronosState>((set) => ({
  t: T_END,
  playing: false,
  depth: false,
  focusId: null,
  hoverId: null,
  resetTick: 0,
  setT: (t) => set({ t: Math.min(T_END, Math.max(T_START, t)) }),
  setPlaying: (playing) => set({ playing }),
  setDepth: (depth) => set({ depth }),
  setFocus: (focusId) => set({ focusId }),
  setHover: (hoverId) => set({ hoverId }),
  reset: () => set((s) => ({ focusId: null, resetTick: s.resetTick + 1 })),
}));

const SORTED = NODES.map((n) => nodeAt.get(n.id)!).sort((a, b) => a - b);
/** The number of nodes revealed at time t. It changes only when a record crosses the playhead. */
export const revealedCount = (t: number) => SORTED.filter((d) => d <= t).length;
