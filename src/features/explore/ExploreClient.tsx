"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SourceDrawer } from "@/components/ui";
import { listSavedCheckpoints } from "@/lib/checkpoints";
import { usePageReady } from "@/lib/page-ready";
import { finishCurrentTurn } from "@/lib/script-engine";
import { useDemoStore } from "@/lib/store";
import { tourOwnsPage } from "@/lib/tour";
import type { SourceDoc } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";
import {
  ask,
  closeSource,
  gotoStoryState,
  openCheckpoint,
  openEntity,
  resetExploration,
  saveExploration,
  trimChatToLastTurn,
} from "./controller";
import { GraphPanel } from "./GraphPanel";
import { CHAT_DEFAULT_WIDTH, ResizeHandle, maxChatWidth, readStoredChatWidth } from "./ResizeHandle";
import { useExploreUi } from "./ui-store";

/**
 * Exploration Mode (Screen 2). Entry points (BUILD-SPEC.md section 5):
 * - `?turn=<id>&step=<n>`: exact story state, no animation (presenter recovery, screenshots)
 * - `?checkpoint=<id|latest>`: a saved exploration or a dashboard fixture checkpoint
 * - `?q=<question>`: the dashboard ask bar; the matching turn plays on arrival
 * - `?entity=<id>`: the dashboard watchlist and radar; opens the story at that entity
 * - no params: the empty start state with the suggested first question
 */
export function ExploreClient() {
  const params = useSearchParams();
  const router = useRouter();
  const source = useExploreUi((s) => s.source);
  const savedRevision = useExploreUi((s) => s.savedRevision);
  const revision = useDemoStore((s) => s.graph.revision);
  const chatLength = useDemoStore((s) => s.chat.length);
  const key = params.toString();

  useEffect(() => {
    const p = new URLSearchParams(key);
    // Presenter mode puts the exploration in place itself.
    if (tourOwnsPage()) return;
    const t = setTimeout(() => {
      const checkpoint = p.get("checkpoint");
      const turn = p.get("turn");
      const step = p.get("step");
      const q = p.get("q");
      const entityId = p.get("entity") ?? p.get("focus");
      if (checkpoint && openCheckpoint(checkpoint, listSavedCheckpoints()[0]?.id)) return;
      if (turn && gotoStoryState(turn, step === null ? undefined : Number(step))) {
        // `?focus=<id>` with a turn: the orange focus moves there, if the node is on the graph.
        const focus = p.get("focus");
        if (focus && useDemoStore.getState().graph.entityIds.includes(focus)) {
          useDemoStore.getState().setFocus(focus);
          trimChatToLastTurn();
        }
        return;
      }
      if (q) {
        resetExploration();
        ask(q);
        return;
      }
      if (entityId && openEntity(entityId)) return;
      resetExploration();
    }, 0);
    return () => clearTimeout(t);
  }, [key]);

  useEffect(() => () => finishCurrentTurn(), []);
  // The route curtain lifts once Explore is on screen, with its graph drawn.
  const graphReady = useExploreUi((s) => s.graphReady);
  usePageReady("/explore", graphReady);

  const onAsk = useCallback((q: string) => ask(q), []);

  const onReset = useCallback(() => {
    resetExploration();
    if (key) router.replace("/explore", { scroll: false });
  }, [key, router]);

  const onSource = useCallback((src: SourceDoc) => useExploreUi.setState({ source: src }), []);

  // Chat width (resizable against the graph). The live drag writes a CSS variable only.
  const rowRef = useRef<HTMLDivElement>(null);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH);
  const [refitToken, setRefitToken] = useState(0);
  useLayoutEffect(() => {
    const stored = readStoredChatWidth();
    const row = rowRef.current;
    if (stored && row) {
      setChatWidth(Math.min(stored, maxChatWidth(row.clientWidth)));
    }
  }, []);
  const previewWidth = useCallback((w: number) => rowRef.current?.style.setProperty("--chat-w", `${w}px`), []);
  const commitWidth = useCallback((w: number) => {
    rowRef.current?.style.setProperty("--chat-w", `${w}px`);
    setChatWidth(w);
    setRefitToken((t) => t + 1);
  }, []);

  return (
    <div
      ref={rowRef}
      className="h-workspace flex"
      style={{ ["--chat-w" as string]: `${chatWidth}px` }}
    >
      <div className="grid min-h-0 shrink-0" style={{ width: "var(--chat-w)" }}>
        <ChatPanel onAsk={onAsk} onSource={onSource} onReset={onReset} />
      </div>
      <ResizeHandle containerRef={rowRef} width={chatWidth} onPreview={previewWidth} onCommit={commitWidth} />
      <div className="grid min-h-0 min-w-0 flex-1">
        <GraphPanel
          onSave={saveExploration}
          saved={savedRevision === revision && chatLength > 0}
          refitToken={refitToken}
        />
      </div>
      <SourceDrawer source={source} onClose={closeSource} />
    </div>
  );
}
