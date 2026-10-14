"use client";

import { cancelCurrentTurn, completedTurnState, finishCurrentTurn, matchTurn, playTurn, type PlayOptions, type TurnHandle } from "@/lib/script-engine";
import { showToast } from "@/components/ui/Toast";
import { prefersReducedMotion } from "@/lib/motion";
import { isTourActive, sleep, typeInto } from "@/lib/tour";
import { useDemoStore, type ChatTurnState } from "@/lib/store";
import type { GraphDelta, ScriptTurn } from "@/lib/types";
import { restoreSavedCheckpoint, saveCurrentExploration } from "@/lib/checkpoints";
import { dashboard } from "@/data/dashboard";
import { FIRST_QUESTION } from "@/data/tour-story";
import { RECORDS_IN_COMMON_QUESTION } from "@/data/script";
import { ROOT_ID, adjacency, catalog, entity, scriptById, shortLabel, storyTurns } from "./catalog";
import { NODE_TURN_PREFIX, buildNoMatchTurn, buildNodeTurn, nodeTurnId } from "./narration";
import { animateTimeBounds, monthBounds, resetTimeWindow, setTimeBounds, timeAxis } from "@/components/graph/orbit/time";
import { monthStart } from "@/components/graph/orbit-layout";
import { useExploreUi } from "./ui-store";

/* ------------------------------------------------------------------ */
/* Targets                                                             */
/* ------------------------------------------------------------------ */

export type Target = { kind: "turn"; id: string } | { kind: "node"; id: string };

/** Each script turn needs the graph of the turn before it in the story. */
const PARENT_TURN: Record<string, string | undefined> = {
  "ukraine-stance": undefined,
  "s5025-cosponsors": "ukraine-stance",
  "wicker-profile": "s5025-cosponsors",
  "wicker-contacts": "wicker-profile",
  "moran-contact": "wicker-contacts",
  "wicker-contributions": "wicker-profile",
  "defense-pac-contributions": "wicker-profile",
  "moran-registrant": "wicker-profile",
  "hr5334-path": "ukraine-stance",
  "moran-network": "moran-contact",
  "munich-trip": "wicker-profile",
  // After the firm's network: each turn adds the records it needs, on the graph of the turn before it.
  "records-in-common": "moran-network",
  "same-date-wicker": "moran-network",
  "member-shared-records": "s5025-cosponsors",
};

/** A click on a node plays this script turn (the script's own nodeClick triggers come first). */
const CLICK_TURN: Record<string, string> = { hr5334: "hr5334-path" };

/** The suggested questions in the script, mapped to what they do. */
const SUGGESTION_TARGETS: Record<string, Target> = {
  "what is the united states' stance on ukraine": { kind: "turn", id: "ukraine-stance" },
  "who cosponsored s. 5025": { kind: "node", id: "s5025" },
  "how did h.r. 5334 become law": { kind: "turn", id: "hr5334-path" },
  "explore sen. roger wicker": { kind: "node", id: "wicker" },
  "show wicker contacts": { kind: "node", id: "cat-contacts" },
  "show wicker contributions": { kind: "node", id: "cat-contributions" },
  "who filed the june 9 contact": { kind: "node", id: "contact-ua-0609" },
  "which fara registrant contacted wicker": { kind: "turn", id: "moran-registrant" },
  "which defense pacs gave to wicker": { kind: "turn", id: "defense-pac-contributions" },
  "who else did moran global strategies contact for ukraine": { kind: "turn", id: "moran-network" },
  "who was on the munich 2025 delegation list with wicker": { kind: "turn", id: "munich-trip" },
  "who traveled with wicker": { kind: "turn", id: "munich-trip" },
  [normalize(RECORDS_IN_COMMON_QUESTION)]: { kind: "turn", id: "records-in-common" },
};

/** Suggestions in demo-story order, used to top up the list under the last answer. */
const STORY_SUGGESTIONS = [
  "Who cosponsored S. 5025?",
  "Explore Sen. Roger Wicker",
  "Show Wicker contacts",
  "Who filed the June 9 contact?",
  "Which defense PACs gave to Wicker?",
  "Which FARA registrant contacted Wicker?",
  "How did H.R. 5334 become law?",
  "Show Wicker contributions",
];

export { FIRST_QUESTION };

/** Keyword rules for typed questions, checked in order. */
const RULES: { re: RegExp; target: Target }[] = [
  { re: /records? in common|(cosponsor|voted).*(5025|5334).*(5025|5334)/, target: { kind: "turn", id: "records-in-common" } },
  { re: /who else|other (senators|contacts)|moran.*\b(contact|met|meet)/, target: { kind: "turn", id: "moran-network" } },
  { re: /munich|travell?ed with|same trip|delegation/, target: { kind: "turn", id: "munich-trip" } },
  { re: /june 9|jun 9|ministry|principal/, target: { kind: "node", id: "contact-ua-0609" } },
  { re: /fara|registrant|lobby|moran|foreign agent/, target: { kind: "turn", id: "moran-registrant" } },
  { re: /defense pac|\bpacs?\b|contractor|boeing|lockheed|northrop|raytheon|\brtx\b|general dynamics/, target: { kind: "turn", id: "defense-pac-contributions" } },
  { re: /h\.?\s?r\.?\s?5334|became law|become law|public law|signed/, target: { kind: "turn", id: "hr5334-path" } },
  { re: /\bs\.?\s?5025\b|cosponsor|senate bill|sanctions bill/, target: { kind: "node", id: "s5025" } },
  { re: /contact|meeting|\bmet\b|email/, target: { kind: "node", id: "cat-contacts" } },
  { re: /contribution|donation|donor|receipt|money|\bfund(s|ed|ing|er|ers)?\b|financ/, target: { kind: "node", id: "cat-contributions" } },
  { re: /trip|travel/, target: { kind: "node", id: "cat-trips" } },
  { re: /\bvot(e|es|ed|ing)\b|roll call/, target: { kind: "node", id: "cat-votes" } },
  { re: /statement|opinion|said|press release|quote/, target: { kind: "node", id: "cat-statements" } },
  { re: /wicker/, target: { kind: "node", id: "wicker" } },
  { re: /stance|ukraine|united states|u\.s\.|position|support|russia/, target: { kind: "turn", id: "ukraine-stance" } },
];

function normalize(q: string): string {
  return q.toLowerCase().trim().replace(/[?.!\s]+$/, "").replace(/[’‘]/g, "'");
}

/** The nearest target for a typed question, or null (then the chat offers suggestions). */
export function resolveQuestion(question: string): Target | null {
  const q = normalize(question);
  if (!q) return null;
  const alias = SUGGESTION_TARGETS[q];
  if (alias) return alias;
  for (const r of RULES) if (r.re.test(q)) return r.target;
  // A member, firm, or record named in the question.
  for (const e of Object.values(catalog.entities)) {
    if (e.type !== "person" && e.type !== "org") continue;
    const last = e.label.replace(/^(Sen|Rep|Dr)\.\s+/, "").split(/\s+/).pop()!.toLowerCase();
    if (last.length > 3 && new RegExp(`\\b${last}\\b`).test(q)) return { kind: "node", id: e.id };
  }
  const t = matchTurn(question, storyTurns);
  return t ? (t.trigger.nodeClick ? { kind: "node", id: t.trigger.nodeClick } : { kind: "turn", id: t.id }) : null;
}

/* ------------------------------------------------------------------ */
/* Graph helpers                                                       */
/* ------------------------------------------------------------------ */

function visibleSet(): Set<string> {
  return new Set(useDemoStore.getState().graph.entityIds);
}

function addedBy(turn: ScriptTurn): string[] {
  return turn.steps.flatMap((s) => s.delta.add.entities);
}

/** The first story turn that brings `entityId` into the graph. */
function turnThatAdds(entityId: string): ScriptTurn | undefined {
  return storyTurns.find((t) => addedBy(t).includes(entityId));
}

/**
 * A copy of `turn` ready to play on the current graph:
 * - every catalog edge between a new node and a node already on screen is added
 *   in the step that adds the node, so new nodes never float alone;
 * - a first step that says "Set root node" for a node that is not the root reads
 *   "Focus <node>" instead.
 */
export function prepareTurn(turn: ScriptTurn, visible: Set<string> = visibleSet()): ScriptTurn {
  const shown = new Set(visible);
  const graphEdges = new Set(useDemoStore.getState().graph.edgeIds);
  const listed = new Set(turn.steps.flatMap((s) => s.delta.add.edges));
  const steps = turn.steps.map((step) => {
    const fresh = step.delta.add.entities.filter((id) => !shown.has(id));
    fresh.forEach((id) => shown.add(id));
    const extra: string[] = [];
    for (const id of fresh) {
      for (const n of adjacency.get(id) ?? []) {
        if (!shown.has(n.node) || graphEdges.has(n.edge) || listed.has(n.edge) || catalog.edges[n.edge]?.explicit) continue;
        listed.add(n.edge);
        extra.push(n.edge);
      }
    }
    let label = step.label;
    const focus = step.delta.focus;
    if (/^set root node$/i.test(label) && focus && focus !== ROOT_ID) label = `Focus ${shortLabel(focus)}`;
    const delta: GraphDelta = extra.length
      ? { ...step.delta, add: { entities: step.delta.add.entities, edges: [...step.delta.add.edges, ...extra] } }
      : step.delta;
    return { label, delta };
  });
  return { ...turn, steps };
}

/** Applies a turn at once, graph and chat, with no animation. */
function applyInstant(turn: ScriptTurn, question?: string, thoughtMs?: number) {
  const prepared = prepareTurn(turn);
  const s = useDemoStore.getState();
  for (const st of prepared.steps) s.applyDelta(st.delta, { instant: true });
  useDemoStore.getState().pushTurn(completedTurnState(prepared, question, thoughtMs));
}

/** The nominal time of a script turn played by a click or a question (presenter mode plays faster, but reads the same). */
function nominalMs(click: boolean): number {
  return click ? CLICK_MS : QUESTION_MS;
}

/** Makes sure the graph that `turnId` builds on is present (and its chat turn). */
function ensureTurnApplied(turnId: string | undefined) {
  if (!turnId) return;
  const turn = scriptById.get(turnId);
  if (!turn) return;
  const vis = visibleSet();
  const added = addedBy(turn);
  const played = useDemoStore.getState().chat.some((c) => c.turnId === turnId);
  if (added.length && added.every((id) => vis.has(id))) return;
  if (!added.length && played) return;
  ensureTurnApplied(PARENT_TURN[turnId]);
  applyInstant(turn, turn.trigger.nodeClick ? "" : undefined, nominalMs(!!turn.trigger.nodeClick));
}

/**
 * Puts `id` on the graph with no animation: through the story turn that adds it,
 * or else next to a connected neighbor that can be placed (search can open any entity).
 */
function bringIntoGraph(id: string, depth = 0): boolean {
  const onGraph = () => useDemoStore.getState().graph.entityIds.includes(id);
  if (onGraph()) return true;
  const adder = turnThatAdds(id);
  // A record whose own click turn adds it (a shared contact date): that turn puts it on the graph
  // when it plays, on the graph of the turn before it.
  if (adder?.trigger.nodeClick === id && !useDemoStore.getState().chat.some((c) => c.turnId === adder.id)) {
    ensureTurnApplied(PARENT_TURN[adder.id]);
    return false;
  }
  ensureTurnApplied(adder?.id ?? "ukraine-stance");
  if (onGraph()) return true;
  if (depth > 2) return false;
  const nbrs = (adjacency.get(id) ?? []).slice().sort((a, b) => {
    const vis = useDemoStore.getState().graph.entityIds;
    return Number(vis.includes(b.node)) - Number(vis.includes(a.node)) || Number(!!turnThatAdds(b.node)) - Number(!!turnThatAdds(a.node));
  });
  for (const n of nbrs) {
    if (!catalog.entities[n.node] || catalog.entities[n.node].type === "detail") continue;
    if (bringIntoGraph(n.node, depth + 1)) {
      useDemoStore.getState().applyDelta({ add: { entities: [id], edges: [n.edge] } }, { instant: true });
      return true;
    }
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Click origin of chat turns                                          */
/* ------------------------------------------------------------------ */

/** Entity clicked for a chat turn key (clicks have no question). */
const clickedByKey = new Map<string, string>();

/** The entity a click turn describes, or undefined for a typed question. */
export function clickedEntity(turn: ChatTurnState): string | undefined {
  if (turn.question) return undefined;
  const fromKey = clickedByKey.get(turn.key);
  if (fromKey) return fromKey;
  if (turn.turnId.startsWith(NODE_TURN_PREFIX)) return turn.turnId.slice(NODE_TURN_PREFIX.length);
  const script = scriptById.get(turn.turnId);
  if (script?.trigger.nodeClick) return script.trigger.nodeClick;
  return Object.entries(CLICK_TURN).find(([, t]) => t === turn.turnId)?.[0];
}

/** The entity a chat turn leaves in focus: its last focus step, or the node it narrates. */
export function turnFocus(turn: ChatTurnState): string | undefined {
  const script = scriptById.get(turn.turnId);
  if (script) return [...script.steps].reverse().find((st) => st.delta.focus)?.delta.focus;
  return turn.turnId.startsWith(NODE_TURN_PREFIX) ? turn.turnId.slice(NODE_TURN_PREFIX.length) : undefined;
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const QUESTION_MS = 3000;
const CLICK_MS = 2400;
const NARRATE_MS = 700;
/** Presenter mode plays turns a little faster, so every step settles quickly. */
const TOUR_PACE = 0.55;
/** Presenter mode streams the answer at this speed (the audience reads the graph). */
const TOUR_WORDS_PER_SECOND = 120;

/** Plays a turn with animation (faster in presenter mode). */
function play(turn: ScriptTurn, opts: PlayOptions): TurnHandle {
  const tour = isTourActive();
  return playTurn(turn, {
    ...opts,
    stepsTotalMs: opts.stepsTotalMs ? Math.round(opts.stepsTotalMs * (tour ? TOUR_PACE : 1)) : undefined,
    // "Thought for Ns" reads the nominal time, so a faster presenter turn looks the same as a replayed one.
    thoughtMs: opts.stepsTotalMs,
    wordsPerSecond: tour ? TOUR_WORDS_PER_SECOND : undefined,
  });
}

/** The first script turn a click on `id` plays (its opening turn). */
function scriptedClickTurn(id: string): ScriptTurn | undefined {
  const t = storyTurns.find((x) => x.trigger.nodeClick === id);
  if (t) return t;
  const alias = CLICK_TURN[id];
  return alias ? scriptById.get(alias) : undefined;
}

/**
 * The script turn a click on `id` plays now: the first of its click turns (story order) that
 * has not played yet. A node with more than one (Wicker: his profile, then the records he shares
 * with other people) plays them one by one. The opening turn does not play when the node was
 * already expanded some other way; then the click narrates the node instead.
 */
function nextClickTurn(id: string): ScriptTurn | undefined {
  const s = useDemoStore.getState();
  const played = (t: ScriptTurn) => s.chat.some((c) => c.turnId === t.id);
  const opening = scriptedClickTurn(id);
  if (!opening) return undefined;
  if (!played(opening)) return s.graph.expanded.includes(id) ? undefined : opening;
  return storyTurns.find((t) => t.trigger.nodeClick === id && t !== opening && !played(t));
}

/** A click on a node, or its "+" control (2.3 to 2.6). Returns the turn it plays. */
export function clickNode(id: string): TurnHandle | undefined {
  if (!entity(id)) return undefined;
  finishCurrentTurn();
  bringIntoGraph(id);
  const scripted = nextClickTurn(id);
  if (scripted) {
    ensureTurnApplied(PARENT_TURN[scripted.id]);
    const h = play(prepareTurn(scripted), { question: "", stepsTotalMs: CLICK_MS });
    clickedByKey.set(h.key, id);
    return h;
  }
  const turn = buildNodeTurn(id, visibleSet());
  const h = play(prepareTurn(turn), {
    question: "",
    stepsTotalMs: turn.steps.length > 2 ? CLICK_MS - 400 : NARRATE_MS,
  });
  clickedByKey.set(h.key, id);
  return h;
}

/** How long a node shows pressed before the click plays (presenter mode). */
const NODE_PRESS_MS = 220;

/**
 * Presses a graph node on screen (it shows hovered and pressed), then clicks
 * it (presenter mode). Returns the turn it plays; nothing when `signal` aborts first.
 */
export async function pressNode(id: string, signal?: AbortSignal): Promise<TurnHandle | undefined> {
  if (signal?.aborted) return undefined;
  useExploreUi.setState({ pressedNode: id });
  await sleep(prefersReducedMotion() ? 0 : NODE_PRESS_MS, signal);
  useExploreUi.setState({ pressedNode: null });
  return signal?.aborted ? undefined : clickNode(id);
}

/** A typed or suggested question (2.7). Never shows an error. Returns the turn it plays. */
export function ask(question: string): TurnHandle | undefined {
  const q = question.trim();
  if (!q) return undefined;
  finishCurrentTurn();
  const target = resolveQuestion(q);
  if (!target) return play(buildNoMatchTurn(), { question: q, stepsTotalMs: 600 });
  if (target.kind === "node") {
    const id = target.id;
    bringIntoGraph(id);
    const scripted = nextClickTurn(id);
    const turn = scripted ?? buildNodeTurn(id, visibleSet());
    if (scripted) ensureTurnApplied(PARENT_TURN[scripted.id]);
    return play(prepareTurn(turn), { question: q, stepsTotalMs: turn.steps.length > 2 ? QUESTION_MS : NARRATE_MS });
  }
  const turn = scriptById.get(target.id)!;
  ensureTurnApplied(PARENT_TURN[turn.id]);
  return play(prepareTurn(turn), { question: q, stepsTotalMs: QUESTION_MS });
}

/** Clears the graph and the chat: the empty start state. */
export function resetExploration() {
  cancelCurrentTurn();
  const s = useDemoStore.getState();
  s.resetGraph();
  s.clearChat();
  resetTimeWindow();
  useExploreUi.setState({ source: null, draft: "", savedRevision: null, sendPressed: false, savePressed: false, pressedNode: null });
}

/* ------------------------------------------------------------------ */
/* Timeline window                                                     */
/* ------------------------------------------------------------------ */

/** A timeline window as its first and last month, inclusive ("YYYY-MM"); `null`: every month. */
export type MonthWindow = readonly [from: string, to: string] | null;

/** The window edges as days (`null`: the whole axis). */
function windowBounds(w: MonthWindow): [number | null, number | null] {
  return w ? [monthBounds(w[0])[0], monthBounds(w[1])[1]] : [null, null];
}

/** Sets the timeline window at once (a presenter step's settled state). */
export function setTimeWindow(w: MonthWindow): void {
  const [start, end] = windowBounds(w);
  setTimeBounds(start, end);
}

/** How long the window edges take to move, as a person drags them. */
const WINDOW_MOVE_MS = 1000;

/**
 * Moves both window edges to `w`, as a drag of the handles: smoothly over about
 * a second (at once with reduced motion). Records outside the window fade.
 */
export function moveTimeWindow(w: MonthWindow, signal?: AbortSignal): Promise<void> {
  const [start, end] = windowBounds(w);
  const { m0, months } = timeAxis(catalog);
  return animateTimeBounds(start, end, monthStart(m0), monthStart(m0 + months), prefersReducedMotion() ? 0 : WINDOW_MOVE_MS, signal);
}

/* ------------------------------------------------------------------ */
/* Sources, drafts, and saves                                          */
/* ------------------------------------------------------------------ */

export function openSource(sourceId: string): void {
  useExploreUi.setState({ source: catalog.sources[sourceId] ?? null });
}

export function closeSource(): void {
  if (useExploreUi.getState().source) useExploreUi.setState({ source: null });
}

export function setDraft(draft: string): void {
  useExploreUi.setState({ draft });
}

/** Types a follow-up question into the chat field (presenter mode). */
export function typeDraft(question: string, totalMs: number, signal?: AbortSignal): Promise<void> {
  return typeInto(setDraft, question, totalMs, signal);
}

/** Submits the chat field: asks its text and clears it. */
export function submitDraft(): TurnHandle | undefined {
  const q = useExploreUi.getState().draft;
  setDraft("");
  return ask(q);
}

/** How long the send button shows pressed. */
const SEND_PRESS_MS = 120;

/**
 * Presses the chat's send button on screen, then submits the field (presenter
 * mode). Returns the turn it plays; nothing when `signal` aborts first.
 */
export async function pressSend(signal?: AbortSignal): Promise<TurnHandle | undefined> {
  if (signal?.aborted) return undefined;
  useExploreUi.setState({ sendPressed: true });
  await sleep(prefersReducedMotion() ? 0 : SEND_PRESS_MS, signal);
  useExploreUi.setState({ sendPressed: false });
  return signal?.aborted ? undefined : submitDraft();
}

/** The Save button: stores the exploration as a checkpoint, says so in a toast, and reads "Saved". */
export function saveExploration(): void {
  finishCurrentTurn();
  saveCurrentExploration(catalog);
  useExploreUi.setState({ savedRevision: useDemoStore.getState().graph.revision });
  showToast("Exploration saved");
}

/** How long the Save button shows pressed. */
const SAVE_PRESS_MS = 160;

/**
 * Presses the Save button on screen, then saves (presenter mode). Nothing is
 * saved when `signal` aborts first; returns true when it saved.
 */
export async function pressSave(signal?: AbortSignal): Promise<boolean> {
  if (signal?.aborted) return false;
  useExploreUi.setState({ savePressed: true });
  await sleep(prefersReducedMotion() ? 0 : SAVE_PRESS_MS, signal);
  useExploreUi.setState({ savePressed: false });
  if (signal?.aborted) return false;
  saveExploration();
  return true;
}

/**
 * Deep link `?turn=<id>&step=<n>`: the exact story state, no animation.
 * The turns before `turnId` in story order apply in full; `step` is the number
 * of completed steps of `turnId`. Returns false when the turn is unknown.
 */
export function gotoStoryState(turnId: string, step?: number): boolean {
  const index = storyTurns.findIndex((t) => t.id === turnId);
  if (index < 0) return false;
  resetExploration();
  for (let i = 0; i < index; i++) applyInstant(storyTurns[i], undefined, nominalMs(!!storyTurns[i].trigger.nodeClick));
  const turn = storyTurns[index];
  const n = step === undefined || Number.isNaN(step) ? turn.steps.length : Math.max(0, Math.min(step, turn.steps.length));
  playTurn(prepareTurn(turn), { upToStep: n, thoughtMs: nominalMs(!!turn.trigger.nodeClick) });
  useDemoStore.getState().markLoaded();
  return true;
}

/** One played turn of a story: a typed question, or a click (no question). */
export interface StoryEntry {
  turnId: string;
  /** The typed question. Omit for a node click. */
  question?: string;
}

/**
 * Puts the graph and chat of a sequence of played turns in place at once, with
 * no animation. Each turn's graph changes apply in the same order, through the
 * same layout calls, as when the turns play one after the other, so the
 * positions are the same. Returns false when a turn is unknown.
 */
export function replayStory(entries: StoryEntry[]): boolean {
  if (entries.some((e) => !scriptById.has(e.turnId))) return false;
  resetExploration();
  for (const e of entries) {
    const turn = scriptById.get(e.turnId)!;
    applyInstant(turn, e.question ?? "", nominalMs(e.question === undefined));
  }
  useDemoStore.getState().markLoaded();
  return true;
}

/** `?entity=<id>`: open the story at an entity (dashboard watchlist and radar). Animated. */
export function openEntity(id: string): boolean {
  if (!entity(id)) return false;
  resetExploration();
  if (id === ROOT_ID) {
    const first = storyTurns[0];
    play(prepareTurn(first), { question: first.trigger.question, stepsTotalMs: QUESTION_MS });
    return true;
  }
  const scripted = scriptedClickTurn(id);
  if (scripted) {
    ensureTurnApplied(PARENT_TURN[scripted.id]);
    // Keep the parent graph, but the chat starts clean: only the entity's own turn.
    useDemoStore.getState().clearChat();
    const h = play(prepareTurn(scripted), {
      question: scripted.trigger.question ? undefined : "",
      stepsTotalMs: QUESTION_MS,
    });
    if (!scripted.trigger.question) clickedByKey.set(h.key, id);
    return true;
  }
  bringIntoGraph(id);
  useDemoStore.getState().clearChat();
  clickNode(id);
  return true;
}

/** `?turn=<id>&focus=<id>`: the story graph, the focus moved, and a chat with only the target turn. */
export function trimChatToLastTurn() {
  const chat = useDemoStore.getState().chat;
  if (chat.length > 1) useDemoStore.getState().setChat(chat.slice(-1));
}

/** Every turn a saved checkpoint can refer to: the script, node turns, and the no-match reply. */
export function restorableTurns(): ScriptTurn[] {
  return [...storyTurns, ...Object.keys(catalog.entities).map((id) => buildNodeTurn(id)), buildNoMatchTurn()];
}

/**
 * `?checkpoint=<id>`: a saved checkpoint (localStorage), "latest", or one of the
 * two fixture checkpoints on the dashboard. Returns false when nothing matches.
 */
export function openCheckpoint(id: string, latestId?: string): boolean {
  finishCurrentTurn();
  const savedId = id === "latest" ? latestId : id;
  if (savedId && restoreSavedCheckpoint(savedId, restorableTurns())) return true;
  const fixture = dashboard.checkpoints.find((c) => c.id === id);
  if (!fixture) return false;
  // Fixture checkpoints: the story state around their central entity, no animation.
  if (fixture.entityId === ROOT_ID) {
    // "Central: Ukraine": the bills, S. 5025's cosponsors, and H.R. 5334's path to law, the whole map in view (no focus).
    resetExploration();
    applyInstant(storyTurns[0]);
    applyInstant(scriptById.get("s5025-cosponsors")!);
    applyInstant(scriptById.get("hr5334-path")!);
    useDemoStore.getState().setFocus(undefined);
    return true;
  }
  return gotoStoryState(scriptedClickTurn(fixture.entityId)?.id ?? "ukraine-stance");
}

/** True when a suggestion has already been followed in this exploration. */
function suggestionDone(text: string): boolean {
  const t = SUGGESTION_TARGETS[normalize(text)];
  if (!t) return false;
  const s = useDemoStore.getState();
  const onGraph = new Set(s.graph.entityIds);
  const played = (id: string) => s.chat.some((c) => c.turnId === id);
  // The graph already shows a turn's answer when every node it adds is on screen.
  const shown = (turn: ScriptTurn) => {
    const added = addedBy(turn);
    return added.length > 0 && added.every((id) => onGraph.has(id));
  };
  if (t.kind === "turn") {
    const turn = scriptById.get(t.id);
    return played(t.id) || (!!turn && shown(turn));
  }
  const scripted = scriptedClickTurn(t.id);
  // A played turn that ended focused on this node has already opened its records
  // (the contractor follow-up ends on Contributions, for example).
  const endedOn = s.chat.some((c) => {
    const turn = scriptById.get(c.turnId);
    const lastFocus = turn ? [...turn.steps].reverse().find((st) => st.delta.focus)?.delta.focus : undefined;
    return lastFocus === t.id && addedBy(turn!).length > 0;
  });
  return s.graph.expanded.includes(t.id) || endedOn || (!!scripted && (played(scripted.id) || shown(scripted)));
}

/**
 * Up to 3 follow-up questions for the last turn: its own first, then the story order.
 * Only suggestions with a known outcome show, so no suggestion promises a graph it cannot build.
 */
export function suggestionsFor(turn: ChatTurnState, chat: ChatTurnState[]): string[] {
  const own = scriptById.get(turn.turnId)?.suggestions ?? [];
  const lastScripted = [...chat].reverse().find((c) => scriptById.has(c.turnId));
  const inherited = own.length ? [] : (lastScripted ? scriptById.get(lastScripted.turnId)?.suggestions : undefined) ?? [];
  const pool = [...own, ...inherited, ...STORY_SUGGESTIONS];
  const out: string[] = [];
  const targets = new Set<string>();
  for (const q of pool) {
    if (out.length >= 3) break;
    const t = SUGGESTION_TARGETS[normalize(q)];
    if (!t) continue;
    const tKey = `${t.kind}:${t.id}`;
    if (targets.has(tKey) || suggestionDone(q)) continue;
    targets.add(tKey);
    out.push(q);
  }
  return out;
}

export { nodeTurnId };
