"use client";

import { CornerDownRight, MousePointerClick, Sparkles, UserRound } from "lucide-react";
import { IconRing, SourceChip, cx } from "@/components/ui";
import { fadeRiseStyle } from "@/lib/motion";
import { visibleAnswer, type ChatTurnState } from "@/lib/store";
import type { SourceDoc } from "@/lib/types";
import { PublicStatements } from "@/features/feeds";
import { catalog, entity, sourceChipLabel } from "./catalog";
import { clickedEntity, turnFocus } from "./controller";
import { ExploreReasoning } from "./ExploreReasoning";

export function AgentRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <IconRing icon={Sparkles} size={32} iconSize={16} className="mt-0.5" />
      <div className="min-w-0 flex-1 rounded-card border border-line bg-surface-2 px-4 py-3.5">{children}</div>
    </div>
  );
}

function UserRow({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3">
      <IconRing icon={UserRound} size={32} iconSize={16} className="mt-0.5" />
      <p className="t-body min-w-0 flex-1 pt-1.5 font-medium text-fg-1">{text}</p>
    </div>
  );
}

function ClickRow({ id }: { id: string }) {
  const e = entity(id);
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center text-fg-3">
        <MousePointerClick size={16} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <p className="t-meta min-w-0 truncate">
        You opened <span className="text-fg-2">{e?.label ?? id}</span>
      </p>
    </div>
  );
}

/** The blinking cursor at the end of an answer that is still streaming. */
function StreamCursor() {
  return (
    <span
      aria-hidden="true"
      className="ml-0.5 inline-block h-[14px] w-[2px] translate-y-[2px] bg-teal-bright"
      style={{ animation: "privy-pulse 900ms ease-in-out infinite" }}
    />
  );
}

type AnswerBlock = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

/** Answer text: one paragraph per line; lines that start with "- " form a bullet list. */
function answerBlocks(text: string): AnswerBlock[] {
  const blocks: AnswerBlock[] = [];
  for (const line of text.split("\n")) {
    const item = /^-(?:\s|$)/.exec(line);
    const last = blocks.at(-1);
    if (item) {
      const body = line.slice(item[0].length);
      if (last?.kind === "ul") last.items.push(body);
      else blocks.push({ kind: "ul", items: [body] });
    } else if (line.trim()) blocks.push({ kind: "p", text: line });
  }
  return blocks;
}

function AnswerText({ text, streaming }: { text: string; streaming: boolean }) {
  const blocks = answerBlocks(text);
  const cursor = streaming ? <StreamCursor /> : null;
  if (!blocks.length) return <p className="t-body mt-2.5 text-fg-1">{cursor}</p>;
  return (
    <div className="t-body mt-2.5 flex flex-col gap-2 text-fg-1">
      {blocks.map((b, i) => {
        const end = i === blocks.length - 1 ? cursor : null;
        if (b.kind === "p")
          return (
            <p key={i}>
              {b.text}
              {end}
            </p>
          );
        return (
          <ul key={i} className="flex flex-col gap-1">
            {b.items.map((item, j) => (
              <li key={j} className="relative pl-3.5">
                <span aria-hidden="true" className="absolute top-2 left-0.5 h-1 w-1 rounded-full bg-fg-3" />
                {item}
                {j === b.items.length - 1 ? end : null}
              </li>
            ))}
          </ul>
        );
      })}
    </div>
  );
}

export interface ChatTurnProps {
  turn: ChatTurnState;
  isLast: boolean;
  /** Follow-up questions to show under the last answer. */
  suggestions: string[];
  onSuggestion: (q: string) => void;
  onSource: (src: SourceDoc) => void;
  /** Show the "click a node" hint under this answer. */
  showHint?: boolean;
}

export function ChatTurn({ turn, isLast, suggestions, onSuggestion, onSource, showHint }: ChatTurnProps) {
  const clicked = clickedEntity(turn);
  const complete = turn.phase !== "thinking";
  const text = visibleAnswer(turn);
  const done = turn.phase === "done";
  const sources = turn.citations.map((id) => catalog.sources[id]).filter((s): s is SourceDoc => !!s);
  // A member in focus: their public statements, under the answer in their own block (never a
  // cited record, never in Sources). Only on the latest turn, for the member in focus now.
  const focus = isLast && done ? turnFocus(turn) : undefined;
  const member = focus && entity(focus)?.type === "person" ? focus : undefined;

  return (
    <div className="flex flex-col gap-3" style={fadeRiseStyle(0)} data-turn={turn.turnId} data-turn-phase={turn.phase}>
      {turn.question ? <UserRow text={turn.question} /> : clicked ? <ClickRow id={clicked} /> : null}
      <AgentRow>
        <ExploreReasoning steps={turn.steps} complete={complete} thoughtSeconds={turn.thoughtSeconds} />
        {complete ? <AnswerText text={text} streaming={!done} /> : null}
        {done && showHint ? (
          <p className="t-meta mt-3 flex items-start gap-2" style={fadeRiseStyle(1)}>
            <MousePointerClick size={14} strokeWidth={1.5} className="mt-px shrink-0 text-teal" aria-hidden="true" />
            Click a node to explore its connections. Click + on a node to show more records.
          </p>
        ) : null}
        {member ? (
          // Its own block, apart from the answer and its sources.
          <div className="-mx-2 mt-3 border-t border-line pt-3" style={fadeRiseStyle(1)}>
            <PublicStatements personId={member} limit={2} />
          </div>
        ) : null}
        {done && sources.length ? (
          <div className="mt-3.5 border-t border-line pt-3" style={fadeRiseStyle(1)}>
            <p className="t-meta mb-2">Sources</p>
            <div className="flex flex-wrap gap-1.5" data-tour={isLast ? "sources" : undefined}>
              {sources.map((s) => (
                <SourceChip key={s.id} kind={s.kind} label={sourceChipLabel(s)} onClick={() => onSource(s)} />
              ))}
            </div>
          </div>
        ) : null}
      </AgentRow>
      {isLast && done && suggestions.length ? (
        <div className="ml-11 flex flex-col gap-1.5">
          {suggestions.map((q, i) => (
            <button
              key={q}
              type="button"
              onClick={() => onSuggestion(q)}
              style={fadeRiseStyle(i + 2)}
              className="group flex items-center gap-2 rounded-card border border-line px-3 py-2 text-left text-[13px] leading-[18px] font-medium text-fg-2 transition-[background-color,border-color,color] duration-[120ms] hover:border-line-strong hover:bg-surface-2 hover:text-fg-1"
            >
              <CornerDownRight
                size={14}
                strokeWidth={1.5}
                className="shrink-0 text-teal transition-colors duration-[120ms] group-hover:text-teal-bright"
                aria-hidden="true"
              />
              {q}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
