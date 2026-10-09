"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { entities } from "@/data/entities";
import { sources } from "@/data/sources";
import type { SourceDoc, SourceKind } from "@/data/types";
import { GLOBE_ARCS, travelArc, type GlobeArc } from "./globe-data";
import { useHome } from "./homeStore";
import { isTourActive } from "@/lib/tour";

/**
 * Live data on Home: every ~20s the next public record from src/data/sources.ts
 * (newest first, looping) arrives as a new activity row, ticks "New activity" by one,
 * and, for travel records, draws a new arc on the globe. Every motion stands for a record.
 */

export type LiveKind = "vote" | "travel" | "hearing" | "statement" | "filing" | "lobbying" | "foreign";

export interface LiveRow {
  id: string;
  date: string;
  kind: LiveKind;
  kindLabel: string;
  title: string;
  description: string;
  entityId?: string;
  /** The public record behind a live row. */
  sourceId?: string;
  /** Set on rows that arrived live: when they arrived (ms since epoch). */
  arrivedAt?: number;
  /** Presenter mode: draw this record's map arc even where arcs are normally hidden. */
  forceArc?: boolean;
  /** Presenter mode: a record put in place by a step state (not the step it arrives on): no arc, no arrival motion. */
  silent?: boolean;
}

const KIND: Record<SourceKind, { kind: LiveKind; label: string }> = {
  FEC: { kind: "filing", label: "FEC filing" },
  LDA: { kind: "lobbying", label: "LDA report" },
  FARA: { kind: "foreign", label: "FARA filing" },
  CONGRESS: { kind: "vote", label: "Congress record" },
  DISCLOSURE: { kind: "filing", label: "Disclosure" },
  TRAVEL: { kind: "travel", label: "Travel filing" },
  STATEMENT: { kind: "statement", label: "Statement" },
};

const byId = new Map(entities.map((e) => [e.id, e]));
const ORDER: SourceDoc[] = [...sources].sort((a, b) => b.date.localeCompare(a.date));

/** Abbreviations that end with a period but do not end a sentence. */
const ABBREV = /(?:^|\s)(?:S|H\.R|Sen|Rep|Reps|U\.S|St|Dr|Mr|Ms|Mrs|No|Inc|Corp|Co|Jr|Sr|Gov|Gen)\.$/;

/** The first full sentence (abbreviations do not end it), or a clause cut at a word with an ellipsis. */
function firstSentence(text: string): string {
  const re = /[.!?](?=\s+[A-Z0-9“"]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const head = text.slice(0, m.index + 1);
    if (!ABBREV.test(head)) return head.trim();
  }
  if (text.length <= 110) return text.trim();
  const cut = text.slice(0, 110);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "")}…`;
}

const others = (n: number) => (n > 1 ? ` +${n - 1}` : "");

function rowFor(src: SourceDoc, n: number): LiveRow {
  const k = KIND[src.kind];
  const subjects = (src.subjectIds ?? []).map((id) => byId.get(id)).filter(Boolean);
  const people = subjects.filter((e) => e!.type === "person");
  const lead = people[0] ?? subjects[0];
  return {
    id: `live-${src.id}-${n}`,
    date: src.date,
    kind: k.kind,
    kindLabel: k.label,
    // Never empty: the lead subject, else the record title, else the record kind.
    title: (lead ? `${lead.label}${others(people.length)}` : src.title.split(/\s+·\s+/)[0]).trim() || src.title || k.label,
    description: firstSentence(src.excerpt),
    entityId: lead?.id,
    arrivedAt: Date.now(),
    sourceId: src.id,
  };
}

interface LiveState {
  /** Rows that arrived live, newest first. */
  arrivals: LiveRow[];
  /** Records that arrived since the page opened (the "New activity" tick). */
  bumps: number;
  /** The arcs on the globe. Objects stay stable; a travel record adds one. */
  arcs: GlobeArc[];
  cursor: number;
  next: () => void;
  /** Adds one fixed record now (presenter mode). It draws its arc even in the vote view, unless `silent`. */
  inject: (sourceId: string, opts?: { silent?: boolean }) => void;
  /** Removes the records that presenter mode added (a clean run). */
  clearInjected: () => void;
}

export const useLive = create<LiveState>((set, get) => ({
  arrivals: [],
  bumps: 0,
  arcs: [...GLOBE_ARCS],
  cursor: 0,
  inject: (sourceId, opts) => {
    const src = sources.find((s) => s.id === sourceId);
    if (!src) return;
    const { cursor, arrivals, bumps } = get();
    set({
      cursor: cursor + 1,
      arrivals: [{ ...rowFor(src, cursor), forceArc: true, silent: !!opts?.silent }, ...arrivals].slice(0, 24),
      bumps: bumps + 1,
    });
  },
  clearInjected: () => {
    const { arrivals, bumps } = get();
    const kept = arrivals.filter((a) => !a.forceArc);
    if (kept.length === arrivals.length) return;
    set({ arrivals: kept, bumps: Math.max(0, bumps - (arrivals.length - kept.length)) });
  },
  next: () => {
    const { cursor, arrivals, bumps, arcs } = get();
    const src = ORDER[cursor % ORDER.length];
    let nextArcs = arcs;
    const arc = travelArc(src);
    if (arc && !arcs.some((a) => a.id === arc.id)) {
      nextArcs = [...arcs, arc];
      const latest = nextArcs.reduce((a, b) => (b.date > a ? b.date : a), "");
      // Mutate the flag in place, so the existing arcs are not redrawn.
      for (const a of nextArcs) a.latest = a.date === latest;
    }
    set({
      cursor: cursor + 1,
      arrivals: [rowFor(src, cursor), ...arrivals].slice(0, 24),
      bumps: bumps + 1,
      arcs: nextArcs,
    });
  },
}));

const INTERVAL_S = 20;

/** Runs the live replay. Time counts only while the tab is visible. */
export function LiveTicker() {
  useEffect(() => {
    let seconds = 0;
    const id = window.setInterval(() => {
      // The replay starts after the page reveal, and pauses while the tab is hidden.
      // Presenter mode pauses the replay; its steps trigger records instead.
      if (document.hidden || !useHome.getState().ready || isTourActive()) return;
      seconds += 1;
      if (seconds >= INTERVAL_S) {
        seconds = 0;
        useLive.getState().next();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  return null;
}

/** "Just now", "1 min ago", "5 min ago" for a row that arrived live. */
export function ago(arrivedAt: number, now: number): string {
  const min = Math.floor((now - arrivedAt) / 60000);
  return min < 1 ? "Just now" : `${min} min ago`;
}

/** The current time, refreshed every 15s (for "1 min ago" labels). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
