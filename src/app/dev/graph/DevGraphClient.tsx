"use client";

import { Bookmark, RotateCcw, Play, Crosshair, MousePointerClick } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { GraphCanvas } from "@/components/graph";
import { Button, Panel, ReasoningSteps, SourceChip, sourceKindLabel, useToast } from "@/components/ui";
import { describeCheckpoint, listSavedCheckpoints, restoreSavedCheckpoint, saveCurrentExploration } from "@/lib/checkpoints";
import { configureGraphLayout, useDemoStore, visibleAnswer } from "@/lib/store";
import { finishCurrentTurn, gotoTurnState, playTurn, turnForNodeClick } from "@/lib/script-engine";
import { realCatalog, realTurns } from "./data-mode";
import { sampleCatalog as demoCatalog, sampleTurns as demoTurns } from "./sample";


export function DevGraphClient() {
  const params = useSearchParams();
  const real = params.get("data") === "real";
  const sampleCatalog = real ? realCatalog : demoCatalog;
  const sampleTurns = real ? realTurns : demoTurns;
  // The store lays the graph out against this catalog (idempotent).
  configureGraphLayout(sampleCatalog, undefined, "force");
  const STORY = sampleTurns.map((t) => t.id);
  const chat = useDemoStore((s) => s.chat);
  const focusId = useDemoStore((s) => s.graph.focusId);
  const last = chat[chat.length - 1];

  const replay = useCallback(() => {
    finishCurrentTurn();
    const s = useDemoStore.getState();
    s.resetGraph();
    s.clearChat();
    playTurn(sampleTurns[0]);
  }, [sampleTurns]);

  // Deep link: ?turn=<id>&step=<n> sets the state with no animation. Otherwise play the build.
  useEffect(() => {
    const turn = params.get("turn");
    const checkpoint = params.get("checkpoint");
    const step = params.get("step");
    const t = setTimeout(() => {
      if (checkpoint) {
        const id = checkpoint === "latest" ? listSavedCheckpoints()[0]?.id : checkpoint;
        if (id && restoreSavedCheckpoint(id, sampleTurns)) return;
      }
      if (turn && gotoTurnState(sampleTurns, turn, step === null ? undefined : Number(step))) {
        const focus = params.get("focus");
        if (focus) useDemoStore.getState().setFocus(focus === "none" ? undefined : focus);
        return;
      }
      replay();
    }, 0);
    return () => clearTimeout(t);
  }, [params, replay, sampleTurns]);

  const onNodeClick = useCallback((id: string) => {
    const turn = turnForNodeClick(id, sampleTurns);
    if (turn && !useDemoStore.getState().graph.expanded.includes(id)) playTurn(turn);
    else useDemoStore.getState().setFocus(id);
  }, [sampleTurns]);

  const toast = useToast();
  const save = () => {
    const cp = saveCurrentExploration(sampleCatalog);
    toast.show(cp ? "Exploration saved" : "Exploration saved for this session");
    if (cp) console.info("[checkpoint]", cp.id, describeCheckpoint(cp));
  };

  const playNext = () => {
    const done = new Set(useDemoStore.getState().chat.map((c) => c.turnId));
    const next = sampleTurns.find((t) => !done.has(t.id));
    if (next) playTurn(next);
  };

  return (
    <div className="h-workspace grid grid-cols-[400px_1fr] gap-4">
      <Panel title="Graph engine test" subtitle="Sample data. Click nodes, or step through the story." divider>
        <div className="flex h-full flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={<RotateCcw size={14} />} onClick={replay}>
              Replay build
            </Button>
            <Button variant="secondary" size="sm" icon={<Play size={14} />} onClick={playNext}>
              Next step
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Crosshair size={14} />}
              onClick={() => useDemoStore.getState().setFocus(undefined)}
              disabled={!focusId}
            >
              Clear focus
            </Button>
            <Button variant="ghost" size="sm" icon={<Bookmark size={14} />} onClick={save}>
              Save
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STORY.map((id) => (
              <a
                key={id}
                href={`/dev/graph?${real ? "data=real&" : ""}turn=${id}`}
                className="rounded-chip border border-line px-2 py-1 text-[12px] leading-4 text-fg-2 transition-colors duration-[120ms] hover:border-line-strong hover:text-fg-1"
              >
                {id}
              </a>
            ))}
          </div>
          {last ? (
            <div className="flex min-h-0 flex-col gap-3" key={last.key}>
              {last.question ? (
                <div className="t-body self-end rounded-card border border-line bg-surface-2 px-4 py-3 text-fg-1">
                  {last.question}
                </div>
              ) : null}
              <ReasoningSteps steps={last.steps} complete={last.phase !== "thinking"} thoughtSeconds={last.thoughtSeconds} />
              {last.phase !== "thinking" ? <p className="t-body text-fg-1">{visibleAnswer(last)}</p> : null}
              {last.phase === "done" ? (
                <div className="flex flex-wrap gap-2">
                  {last.citations.map((id) => {
                    const src = sampleCatalog.sources[id];
                    return src ? <SourceChip key={id} kind={src.kind} label={sourceKindLabel(src.kind)} /> : null;
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="t-meta mt-auto flex items-center gap-1.5">
            <MousePointerClick size={14} strokeWidth={1.5} aria-hidden="true" />
            {chat.length} turns played · focus: {focusId ?? "none"}
          </p>
        </div>
      </Panel>
      <section className="relative min-h-0 overflow-hidden rounded-panel border border-line">
        <GraphCanvas catalog={sampleCatalog} onNodeClick={onNodeClick} onExpand={onNodeClick} insets={{ top: 64 }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 pt-5">
            <div>
              <div className="t-panel-title">Smart View: US Stance on Ukraine</div>
              <div className="t-meta mt-1">Click nodes to explore · Drag to reposition · Zoom and pan to navigate</div>
            </div>
          </div>
        </GraphCanvas>
      </section>
    </div>
  );
}
