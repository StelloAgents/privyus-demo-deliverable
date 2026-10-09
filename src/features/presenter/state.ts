"use client";

import { dismissToast } from "@/components/ui/Toast";
import { TOUR_STORY } from "@/data/tour-story";
import { clearSavedCheckpoints, hasSavedCheckpoints, stashCheckpoints, unstashCheckpoints } from "@/lib/checkpoints";
import { saveCurrentExploration } from "@/lib/checkpoints";
import { cancelCurrentTurn } from "@/lib/script-engine";
import { useDemoStore } from "@/lib/store";
import type { TourApp } from "@/lib/tour";
import { applyHomeView, type HomeView } from "@/features/dashboard/home-controller";
import { catalog } from "@/features/explore/catalog";
import { replayStory } from "@/features/explore/controller";
import { useExploreUi } from "@/features/explore/ui-store";
import { resetTimeWindow } from "@/components/graph/orbit/time";
import { setSearchText } from "@/features/search/search-store";

/**
 * The state of the demo at the end of a presenter step. Each part describes a
 * page's store; a part that is left out stays as it is (it is not on screen, and
 * changing it would show through the fading route curtain).
 */
export interface StepState {
  route: "/" | "/explore" | "/search";
  home?: HomeView;
  /**
   * The presenter story played up to and including this turn (src/data/tour-story.ts;
   * null: a clean exploration), the open source, and the unsent text in the chat field.
   */
  explore?: { turnId: string | null; sourceOpen?: string; draft?: string };
  /** The text in the search field. */
  search?: string;
  /** This run has saved its one checkpoint (the save step and after). */
  checkpoint: boolean;
}

/** Home at the start of a run: Ukraine Aid Package, the United States map, the full seat chart. */
export const HOME_START: HomeView = { topic: 0, radarTab: "vote", mapView: "us", stateCard: null, liveRecord: false };

export const CLEAN: StepState = { route: "/", home: HOME_START, search: "", checkpoint: false };

/** The explore state that `applyState` put in place, and the graph revision it left. */
let applied: { key: string; revision: number; chat: number } | null = null;

function applyExplore(e: NonNullable<StepState["explore"]>): void {
  const n = e.turnId === null ? 0 : TOUR_STORY.findIndex((s) => s.turnId === e.turnId) + 1;
  const key = String(n);
  const st = useDemoStore.getState();
  const same = applied && applied.key === key && applied.revision === st.graph.revision && applied.chat === st.chat.length;
  if (!same) {
    replayStory(TOUR_STORY.slice(0, n));
    const now = useDemoStore.getState();
    applied = { key, revision: now.graph.revision, chat: now.chat.length };
  }
  const source = e.sourceOpen ? (catalog.sources[e.sourceOpen] ?? null) : null;
  const draft = e.draft ?? "";
  const ui = useExploreUi.getState();
  if (ui.source !== source || ui.draft !== draft || ui.savedRevision !== null || ui.sendPressed || ui.savePressed || ui.pressedNode) {
    useExploreUi.setState({ source, draft, savedRevision: null, sendPressed: false, savePressed: false, pressedNode: null });
  }
  // The timeline stays idle in presenter mode: the whole window, no playback.
  resetTimeWindow();
}

/**
 * Checkpoints are a function of the step: none before the save step, exactly
 * one (this run's) from it on. The one checkpoint is the exploration of the
 * story, so the explore part must be in place first.
 */
function applyCheckpoint(saved: boolean): void {
  const has = hasSavedCheckpoints();
  if (!saved && has) clearSavedCheckpoints();
  if (saved && !has) saveCurrentExploration(catalog);
}

/** Puts a step state in place at once. Synchronous and idempotent; it does not navigate. */
export function applyState(s: StepState): void {
  cancelCurrentTurn();
  dismissToast();
  if (s.home) applyHomeView(s.home);
  if (s.explore) applyExplore(s.explore);
  if (s.search !== undefined) setSearchText(s.search);
  applyCheckpoint(s.checkpoint);
}

/** How the tour engine reaches this demo's states. */
export const presenterApp: TourApp<StepState> = {
  clean: CLEAN,
  route: (s) => s.route,
  apply: applyState,
  start: () => {
    applied = null;
    stashCheckpoints();
  },
  exit: () => {
    applied = null;
    unstashCheckpoints();
  },
};
