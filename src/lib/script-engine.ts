"use client";

import { MOTION, prefersReducedMotion } from "./motion";
import { useDemoStore, type ChatTurnState } from "./store";
import type { ScriptTurn } from "./types";

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

const STOP = new Set(
  "a an the of on in to for and or is are was were be what which who whom how why do does did i me my we our you your it its this that these those with about more know want tell show can could would please us united states s".split(
    " ",
  ),
);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9$.\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[.-]+|[.-]+$/g, ""))
    .filter((w) => w && !STOP.has(w));
}

/**
 * Finds the script turn nearest to a typed question.
 * Scores keyword hits (phrases count when the question contains them) and
 * word overlap with the turn's trigger question. Returns `null` when nothing
 * matches; the caller then offers the suggested questions.
 */
export function matchTurn(question: string, turns: ScriptTurn[]): ScriptTurn | null {
  const q = question.toLowerCase();
  const qTokens = new Set(tokens(question));
  let best: ScriptTurn | null = null;
  let bestScore = 0;
  for (const turn of turns) {
    let score = 0;
    for (const kw of turn.trigger.keywords ?? []) {
      const k = kw.toLowerCase().trim();
      if (!k) continue;
      if (k.includes(" ") ? q.includes(k) : qTokens.has(k) || q.includes(k)) score += 2;
    }
    if (turn.trigger.question) {
      if (turn.trigger.question.toLowerCase().trim() === q.trim()) score += 100;
      const tq = tokens(turn.trigger.question);
      if (tq.length) {
        const hits = tq.filter((t) => qTokens.has(t)).length;
        score += (hits / tq.length) * 3;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = turn;
    }
  }
  return bestScore >= 1.5 ? best : null;
}

/** The turn that narrates a click on `entityId` (2.6), if the script has one. */
export function turnForNodeClick(entityId: string, turns: ScriptTurn[]): ScriptTurn | null {
  return turns.find((t) => t.trigger.nodeClick === entityId) ?? null;
}

/* ------------------------------------------------------------------ */
/* Timing                                                              */
/* ------------------------------------------------------------------ */

export interface PlayOptions {
  /** The text the user typed. Shown as the user bubble. */
  question?: string;
  /** Place everything at once: no animation, the answer shows in full. */
  instant?: boolean;
  /** Stop after this many steps (0..steps.length). Implies `instant`. */
  upToStep?: number;
  /** Total time for all steps. Default: 3000ms for 3+ steps (DESIGN.md: 2.5 to 3.5s). */
  stepsTotalMs?: number;
  /** Called after each step's delta is applied. */
  onStep?: (index: number) => void;
  /** Called when the answer has finished streaming. */
  onDone?: () => void;
  /** Streaming speed of the answer. Default: MOTION.wordsPerSecond (about 35). */
  wordsPerSecond?: number;
  /**
   * The time shown in "Thought for Ns". Default: the steps' total time. Set it
   * when the turn plays faster than its nominal pace (presenter mode), so the
   * chat reads the same as a turn placed at once with the same value.
   */
  thoughtMs?: number;
}

export interface TurnHandle {
  key: string;
  /** Stops the timers. The state stays where it is. */
  cancel: () => void;
  /** Jumps to the end state at once. */
  finish: () => void;
  /** Resolves when the answer has finished (or the turn was finished or cancelled). */
  done: Promise<void>;
  /** Resolves when the last step's graph change has applied (the answer may still stream). */
  graphBuilt: Promise<void>;
}

function stepDurations(turn: ScriptTurn, totalMs?: number): number {
  const n = Math.max(turn.steps.length, 1);
  const total = totalMs ?? (n >= 3 ? 3000 : 700 * n);
  return Math.max(250, total / n);
}

let keyCounter = 0;
const nextKey = (turnId: string) => `${turnId}#${++keyCounter}`;

function thoughtSecondsFor(turn: ScriptTurn, stepMs: number, thoughtMs?: number): number {
  return Math.max(1, Math.round((thoughtMs ?? stepMs * turn.steps.length) / 1000));
}

/** A finished chat entry for `turn`, used for deep links and checkpoint loads. */
export function completedTurnState(turn: ScriptTurn, question?: string, thoughtMs?: number): ChatTurnState {
  const stepMs = stepDurations(turn);
  return {
    key: nextKey(turn.id),
    turnId: turn.id,
    question: question ?? turn.trigger.question,
    steps: turn.steps.map((s) => ({ label: s.label, status: "done" })),
    answer: turn.answer,
    shownWords: countWords(turn.answer),
    phase: "done",
    thoughtSeconds: thoughtSecondsFor(turn, stepMs, thoughtMs),
    citations: turn.citations,
    suggestions: turn.suggestions,
  };
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */

let current: TurnHandle | null = null;

/**
 * Plays one script turn into the store:
 * 1. Pushes a chat entry (user question, pending steps).
 * 2. Each step turns active, then done; its graph delta applies at the same
 *    moment it completes, so the steps and the graph stay in sync (2.2).
 * 3. The reasoning folds ("Thought for 3s") and the answer streams at about
 *    35 words per second.
 * A new call cancels the turn that still plays (it jumps to its end state).
 */
export function playTurn(turn: ScriptTurn, opts: PlayOptions = {}): TurnHandle {
  current?.finish();

  const store = useDemoStore.getState();
  const key = nextKey(turn.id);
  const reduced = prefersReducedMotion();
  const stepMs = stepDurations(turn, opts.stepsTotalMs);
  const totalWords = countWords(turn.answer);
  const timers: ReturnType<typeof setTimeout>[] = [];
  let finished = false;
  let applied = 0;
  let resolveDone = () => {};
  let resolveBuilt = () => {};
  const done = new Promise<void>((r) => (resolveDone = r));
  const graphBuilt = new Promise<void>((r) => (resolveBuilt = r));

  const entry: ChatTurnState = {
    key,
    turnId: turn.id,
    question: opts.question ?? turn.trigger.question,
    steps: turn.steps.map((s) => ({ label: s.label, status: "pending" })),
    answer: turn.answer,
    shownWords: 0,
    phase: "thinking",
    thoughtSeconds: thoughtSecondsFor(turn, stepMs, opts.thoughtMs),
    citations: turn.citations,
    suggestions: turn.suggestions,
  };

  const update = (patch: Partial<ChatTurnState>) => useDemoStore.getState().updateTurn(key, patch);
  const stepStatuses = (doneCount: number, active: boolean) =>
    turn.steps.map((s, i) => ({
      label: s.label,
      status: (i < doneCount ? "done" : i === doneCount && active ? "active" : "pending") as
        | "done"
        | "active"
        | "pending",
    }));

  const applyStep = (i: number, instant: boolean) => {
    if (i < applied) return;
    useDemoStore.getState().applyDelta(turn.steps[i].delta, {
      instant,
      cue: instant ? undefined : { key, step: i, steps: turn.steps.length, stepMs },
    });
    applied = i + 1;
    opts.onStep?.(i);
    if (applied >= turn.steps.length) resolveBuilt();
  };

  const end = () => {
    finished = true;
    timers.forEach(clearTimeout);
    if (current === handle) current = null;
    resolveBuilt();
    resolveDone();
  };

  const handle: TurnHandle = {
    key,
    done,
    graphBuilt,
    cancel: () => {
      if (finished) return;
      end();
    },
    finish: () => {
      if (finished) return;
      timers.forEach(clearTimeout);
      for (let i = applied; i < turn.steps.length; i++) applyStep(i, true);
      update({ steps: stepStatuses(turn.steps.length, false), phase: "done", shownWords: totalWords });
      end();
      opts.onDone?.();
    },
  };

  store.pushTurn(entry);

  // Instant: deep links, checkpoint restore, reduced motion is NOT instant (it fades).
  if (opts.instant || opts.upToStep !== undefined) {
    const upTo = Math.min(opts.upToStep ?? turn.steps.length, turn.steps.length);
    for (let i = 0; i < upTo; i++) applyStep(i, true);
    const complete = upTo >= turn.steps.length;
    update({
      steps: stepStatuses(upTo, !complete),
      phase: complete ? "done" : "thinking",
      shownWords: complete ? totalWords : 0,
    });
    end();
    return handle;
  }

  current = handle;
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));

  update({ steps: stepStatuses(0, true) });
  turn.steps.forEach((_, i) => {
    at((i + 1) * stepMs, () => {
      applyStep(i, false);
      update({ steps: stepStatuses(i + 1, i + 1 < turn.steps.length) });
    });
  });

  // The answer streams from one ticking loop (about 30 updates per second, not
  // one timer and store update per word). Shown words follow the clock.
  const streamStart = turn.steps.length * stepMs + 200;
  const wps = opts.wordsPerSecond ?? MOTION.wordsPerSecond;
  const complete = () => {
    update({ phase: "done", shownWords: totalWords });
    end();
    opts.onDone?.();
  };
  at(streamStart, () => {
    if (reduced) {
      update({ phase: "streaming", shownWords: totalWords });
      at(20, complete);
      return;
    }
    const t0 = Date.now();
    let shown = 1;
    update({ phase: "streaming", shownWords: shown });
    const tick = () => {
      if (finished) return;
      const n = Math.min(totalWords, 1 + Math.floor(((Date.now() - t0) * wps) / 1000));
      if (n >= totalWords) return complete();
      if (n !== shown) update({ shownWords: (shown = n) });
      at(33, tick);
    };
    at(33, tick);
  });

  return handle;
}

/** Stops (and completes) the turn that plays now, if any. */
export function finishCurrentTurn(): void {
  current?.finish();
}

/** Stops the turn that plays now, if any, and leaves the state where it is (the caller replaces it). */
export function cancelCurrentTurn(): void {
  current?.cancel();
}

/**
 * Sets the exact state for a deep link `?turn=<id>&step=<n>`, with no animation.
 * All turns before `turnId` in `turns` (the demo story order) apply in full.
 * `step` is the number of completed steps of `turnId` (0 to steps.length);
 * omit it for the finished turn, answer included.
 * Returns false when `turnId` is not in the script.
 */
export function gotoTurnState(turns: ScriptTurn[], turnId: string, step?: number): boolean {
  const index = turns.findIndex((t) => t.id === turnId);
  if (index < 0) return false;
  current?.cancel();
  const s = useDemoStore.getState();
  s.resetGraph();
  s.clearChat();
  for (let i = 0; i < index; i++) {
    for (const st of turns[i].steps) useDemoStore.getState().applyDelta(st.delta, { instant: true });
    useDemoStore.getState().pushTurn(completedTurnState(turns[i]));
  }
  playTurn(turns[index], { upToStep: step ?? turns[index].steps.length });
  return true;
}
