"use client";

import { CornerDownRight, SquarePen } from "lucide-react";
import { useEffect, useRef } from "react";
import { AskBar } from "@/components/ui";
import { useReducedMotion } from "@/lib/motion";
import { useDemoStore } from "@/lib/store";
import type { SourceDoc } from "@/lib/types";
import { AgentRow, ChatTurn } from "./ChatTurn";
import { FIRST_QUESTION, setDraft, suggestionsFor } from "./controller";
import { useExploreUi } from "./ui-store";

export interface ChatPanelProps {
  onAsk: (q: string) => void;
  onSource: (src: SourceDoc) => void;
  onReset: () => void;
}

function StartState({ onAsk }: { onAsk: (q: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <AgentRow>
        <p className="t-body text-fg-1">
          Ask about a topic, a bill, or a member of Congress. I build the graph from public records while I answer, and I
          cite each source.
        </p>
      </AgentRow>
      <div className="ml-11 flex flex-col gap-1.5">
        <p className="t-meta mb-0.5">Try this question</p>
        <button
          type="button"
          onClick={() => onAsk(FIRST_QUESTION)}
          className="group flex items-center gap-2 rounded-card border border-line px-3 py-2 text-left text-[13px] leading-[18px] font-medium text-fg-2 transition-[background-color,border-color,color] duration-[120ms] hover:border-line-strong hover:bg-surface-2 hover:text-fg-1"
        >
          <CornerDownRight size={14} strokeWidth={1.5} className="shrink-0 text-teal group-hover:text-teal-bright" aria-hidden="true" />
          {FIRST_QUESTION}
        </button>
      </div>
    </div>
  );
}

/** The left panel: questions, reasoning steps, streamed answers, sources, follow-ups (2.2, 2.6, 2.7). */
export function ChatPanel({ onAsk, onSource, onReset }: ChatPanelProps) {
  const chat = useDemoStore((s) => s.chat);
  const draft = useExploreUi((s) => s.draft);
  const sendPressed = useExploreUi((s) => s.sendPressed);
  // Suggestions depend on which nodes are open.
  useDemoStore((s) => s.graph.expanded);
  const reduced = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const last = chat[chat.length - 1];
  const lastKey = last?.key;
  const progress = last ? `${last.phase}|${last.shownWords}|${last.steps.filter((s) => s.status === "done").length}` : "";

  // Keep the newest turn in view while it streams, unless the user scrolls up to read.
  const userScrolled = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onUp = (e: WheelEvent) => {
      if (e.deltaY < 0) userScrolled.current = true;
      else if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) userScrolled.current = false;
    };
    el.addEventListener("wheel", onUp, { passive: true });
    return () => el.removeEventListener("wheel", onUp);
  }, []);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    userScrolled.current = false;
    el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [lastKey, reduced]);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || userScrolled.current) return;
    const frame = requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [progress]);

  const busy = !!last && last.phase !== "done";
  const firstStoryIndex = chat.findIndex((t) => t.turnId === "ukraine-stance");

  return (
    <section data-tour="explore-chat" className="flex min-h-0 min-w-0 flex-col rounded-panel border border-line bg-surface-1">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-6 py-5">
        <h2 className="t-panel-title">Exploration Chat</h2>
        {chat.length ? (
          <button
            type="button"
            onClick={onReset}
            className="-mr-2 flex h-8 items-center gap-1.5 rounded-button px-2 text-[13px] font-medium text-fg-3 transition-colors duration-[120ms] hover:bg-surface-2 hover:text-fg-1"
          >
            <SquarePen size={14} strokeWidth={1.5} aria-hidden="true" />
            New
          </button>
        ) : null}
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {chat.length === 0 ? (
          <StartState onAsk={onAsk} />
        ) : (
          <div className="flex flex-col gap-6">
            {chat.map((turn, i) => (
              <ChatTurn
                key={turn.key}
                turn={turn}
                isLast={i === chat.length - 1}
                suggestions={i === chat.length - 1 ? suggestionsFor(turn, chat) : []}
                onSuggestion={onAsk}
                onSource={onSource}
                showHint={i === firstStoryIndex}
              />
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 px-6 pt-2 pb-6">
        <AskBar
          value={draft}
          onChange={setDraft}
          onSubmit={(q) => {
            setDraft("");
            onAsk(q);
          }}
          placeholder={chat.length ? "Ask a follow-up" : "Ask anything"}
          disabled={false}
          submitPressed={sendPressed}
          multiline
          className={busy ? "opacity-90" : undefined}
        />
      </div>
    </section>
  );
}
