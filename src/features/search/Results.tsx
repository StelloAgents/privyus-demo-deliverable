"use client";

import { CornerDownLeft, FileText, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, IconRing, cx } from "@/components/ui";
import { initialsOf } from "@/lib/catalog";
import { iconForEntity } from "@/lib/icons";
import { catalog } from "@/features/explore/catalog";
import { GROUP_ORDER, KIND_TAG, hitGroup, shortDate, type SearchHit } from "./search-index";

export type Option =
  | { kind: "hit"; key: string; hit: SearchHit }
  | { kind: "ask"; key: string; query: string };

export function Highlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (!ranges.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], i) => {
    if (s > at) out.push(text.slice(at, s));
    out.push(
      <mark key={i} className="bg-transparent font-semibold text-fg-1 underline decoration-teal decoration-2 underline-offset-[3px]">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  });
  if (at < text.length) out.push(text.slice(at));
  return <>{out}</>;
}

export function EntityMark({ id, size = 32 }: { id: string; size?: number }) {
  const e = catalog.entities[id];
  if (!e) return null;
  if (e.type === "person") return <Avatar initials={initialsOf(e)} size={size} />;
  if (e.type === "topic") {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-1"
        style={{ width: size, height: size, border: "1.5px solid var(--teal)" }}
      >
        <svg width="16" height="11" viewBox="0 0 34 24" aria-hidden="true" style={{ borderRadius: 2 }}>
          <rect width="34" height="12" fill="var(--flag-ua-blue)" />
          <rect y="12" width="34" height="12" fill="var(--flag-ua-yellow)" />
        </svg>
      </span>
    );
  }
  return <IconRing icon={iconForEntity(e)} size={size} iconSize={16} />;
}

/** A small record-type tag, such as LDA or FEC. */
export function KindTag({ kind }: { kind: keyof typeof KIND_TAG }) {
  return (
    <span
      className={cx(
        "inline-flex h-5 shrink-0 items-center rounded-chip border px-1.5 text-[11px] leading-none font-semibold",
        kind === "FARA" ? "border-lavender text-lavender" : "border-line-strong text-fg-2",
      )}
    >
      {KIND_TAG[kind]}
    </span>
  );
}

export interface ResultsProps {
  listId: string;
  options: Option[];
  activeIndex: number;
  optionId: (i: number) => string;
  onActive: (i: number) => void;
  onChoose: (opt: Option) => void;
  /** Shown when no record matches (the Ask row still shows). */
  emptyNote?: string;
}

/** The typeahead results, inline under the input (replaces the content area while typing). */
export function Results({ listId, options, activeIndex, optionId, onActive, onChoose, emptyNote }: ResultsProps) {
  const indexed = options.map((opt, index) => ({ opt, index }));
  const groups = GROUP_ORDER.map((g) => ({
    title: g,
    rows: indexed.filter((r) => r.opt.kind === "hit" && hitGroup(r.opt.hit) === g),
  })).filter((g) => g.rows.length);
  const ask = indexed.find((r) => r.opt.kind === "ask");

  const row = ({ opt, index }: { opt: Option; index: number }) => {
    const active = index === activeIndex;
    return (
      <div
        key={opt.key}
        id={optionId(index)}
        role="option"
        aria-selected={active}
        onMouseEnter={() => onActive(index)}
        onClick={() => onChoose(opt)}
        className={cx(
          "flex min-h-12 cursor-pointer items-center gap-3 rounded-card px-3 py-1.5 transition-colors duration-[120ms]",
          active ? "bg-surface-3" : "hover:bg-surface-2",
        )}
      >
        {opt.kind === "hit" && opt.hit.kind === "entity" ? (
          <>
            <EntityMark id={opt.hit.entry.id} />
            <p className="min-w-0 flex-1 truncate text-[14px] leading-5 font-medium text-fg-1">
              <Highlight text={opt.hit.entry.label} ranges={opt.hit.ranges} />
            </p>
            <span className="t-meta hidden shrink-0 sm:inline">{opt.hit.entry.sublabel}</span>
          </>
        ) : opt.kind === "hit" && opt.hit.kind === "filing" ? (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-fg-3">
              <FileText size={18} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] leading-5 font-medium text-fg-1">
                <Highlight text={opt.hit.source.title} ranges={opt.hit.ranges} />
              </span>
              {opt.hit.subject ? <span className="t-meta block truncate">Subject: {opt.hit.subject}</span> : null}
            </span>
            <KindTag kind={opt.hit.source.kind} />
            <span className="t-meta w-[92px] shrink-0 text-right">{shortDate(opt.hit.source.date)}</span>
          </>
        ) : opt.kind === "ask" ? (
          <>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center text-teal">
              <Sparkles size={18} strokeWidth={1.5} aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 truncate text-[14px] leading-5 text-fg-2">
              Ask Privyus: <span className="font-medium text-fg-1">‘{opt.query}’</span>
            </p>
          </>
        ) : null}
        <span className={cx("t-meta flex w-12 shrink-0 items-center justify-end gap-1", !active && "invisible")}>
          {opt.kind === "ask" ? "Ask" : "Open"}
          <CornerDownLeft size={13} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </div>
    );
  };

  return (
    <div
      id={listId}
      role="listbox"
      aria-label="Search results"
      data-tour="search-results"
      onMouseDown={(e) => e.preventDefault()}
      className="rounded-panel border border-line bg-surface-1 p-2"
    >
      {groups.map((g) => (
        <div key={g.title} role="group" aria-label={g.title} className="pb-1">
          <p className="t-meta flex items-center justify-between px-3 pt-2 pb-1.5">
            {g.title}
            <span>{g.rows.length}</span>
          </p>
          {g.rows.map(row)}
        </div>
      ))}
      {!groups.length && emptyNote ? <p className="t-body px-3 pt-3 pb-2 text-fg-2">{emptyNote}</p> : null}
      {ask ? (
        <div role="group" aria-label="Ask" className={cx(groups.length || emptyNote ? "mt-1 border-t border-line pt-2" : "")}>
          {row(ask)}
        </div>
      ) : null}
    </div>
  );
}
