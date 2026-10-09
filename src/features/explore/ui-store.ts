"use client";

import { create } from "zustand";
import type { SourceDoc } from "@/lib/types";

/** Explore UI state outside the graph and chat: the open source, the chat draft, the last save. */
export interface ExploreUi {
  source: SourceDoc | null;
  draft: string;
  /** The graph revision at the last save (the Save button reads "Saved" while it holds). */
  savedRevision: number | null;
  /** The chat's send button shows pressed (presenter mode presses it on screen). */
  sendPressed: boolean;
  /** The Save button shows pressed (presenter mode presses it on screen). */
  savePressed: boolean;
  /** A graph node shown pressed (presenter mode clicks it on screen). */
  pressedNode: string | null;
  /** The graph has drawn its first frame (the route curtain waits for it). */
  graphReady: boolean;
}

export const useExploreUi = create<ExploreUi>(() => ({ source: null, draft: "", savedRevision: null, sendPressed: false, savePressed: false, pressedNode: null, graphReady: false }));
