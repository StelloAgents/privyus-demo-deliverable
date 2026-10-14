"use client";

import { completedTurnState } from "./script-engine";
import { useDemoStore } from "./store";
import type { Catalog, GraphSnapshot, ScriptTurn } from "./types";

/** localStorage key for saved explorations (1.7, 2.9). */
export const CHECKPOINT_STORAGE_KEY = "privyus.demo.checkpoints.v1";

export interface CheckpointCounts {
  members: number;
  bills: number;
  orgs: number;
  travels: number;
}

export interface Checkpoint {
  id: string;
  /** "Exploration, 10/3/2026" */
  title: string;
  /** ISO timestamp. */
  createdAt: string;
  /** The root topic label, for "Central: Ukraine". */
  central: string;
  counts: CheckpointCounts;
  graph: GraphSnapshot;
  /** The chat turns, in order. The answers come back from the script. */
  chat: { turnId: string; question?: string }[];
}

/** "Exploration, 10/3/2026" style date (M/D/YYYY). */
export function formatCheckpointDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

/** "Central: Ukraine. 12 members, 3 bills, 1 org, 43 travels" */
export function describeCheckpoint(cp: Pick<Checkpoint, "central" | "counts">): string {
  const { members, bills, orgs, travels } = cp.counts;
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
  return `Central: ${cp.central}. ${n(members, "member", "members")}, ${n(bills, "bill", "bills")}, ${n(orgs, "org", "orgs")}, ${n(travels, "travel", "travels")}`;
}

const MEMBER_RE = /^(Sen|Rep)\.?\s/i;

/** True for a member of Congress (a person with a "Sen." or "Rep." title or an "R-OH" style sublabel). */
function isMember(e: { type: string; label: string; sublabel?: string }): boolean {
  return e.type === "person" && (MEMBER_RE.test(e.label) || /^[RDI]-[A-Z]{2}$/.test(e.sublabel ?? ""));
}

/**
 * Counts for the checkpoint summary line. Members and bills come from the
 * graph; bills, orgs, and travels also come from the catalog relations of the
 * members on the graph (their bills, their trip records, the organizations
 * around their records), so a saved story never reads "0 orgs".
 */
export function countGraph(catalog: Catalog, graph: GraphSnapshot): { central: string; counts: CheckpointCounts } {
  const ents = graph.entityIds.map((id) => catalog.entities[id]).filter(Boolean);
  const root = ents.find((e) => e.type === "topic");

  const adj = new Map<string, string[]>();
  for (const e of Object.values(catalog.edges)) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  }
  const nbrs = (id: string) => (adj.get(id) ?? []).map((n) => catalog.entities[n]).filter(Boolean);
  const isTripCategory = (e: { type: string; label: string }) => e.type === "category" && /trip|travel/i.test(e.label);
  const isTrip = (e: { type: string; icon?: string; label: string }) =>
    e.type === "detail" && (/plane|travel|trip/i.test(e.icon ?? "") || /trip|travel/i.test(e.label));

  const members = ents.filter(isMember);
  const bills = new Set(ents.filter((e) => e.type === "bill").map((e) => e.id));
  const orgs = new Set(ents.filter((e) => e.type === "org").map((e) => e.id));
  const travels = new Set(ents.filter(isTrip).map((e) => e.id));

  for (const m of members) {
    // Walk up to three hops: member -> category -> detail -> org.
    const seen = new Set([m.id]);
    let frontier = [m.id];
    for (let hop = 1; hop <= 3; hop++) {
      const next: string[] = [];
      for (const id of frontier) {
        const from = catalog.entities[id];
        for (const n of nbrs(id)) {
          if (seen.has(n.id)) continue;
          // Do not walk through other members, bills, or the topic.
          if (n.type === "topic") continue;
          if (hop === 1 && n.type === "bill") bills.add(n.id);
          if (n.type === "org") orgs.add(n.id);
          if (n.type === "detail" && (isTripCategory(from) || isTrip(n))) travels.add(n.id);
          seen.add(n.id);
          if (n.type === "category" || n.type === "detail") next.push(n.id);
        }
      }
      frontier = next;
    }
  }

  return {
    central: root ? root.label.replace(/^US stance on\s+/i, "") : "Exploration",
    counts: { members: members.length, bills: bills.size, orgs: orgs.size, travels: travels.size },
  };
}

function readAll(): Checkpoint[] {
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Checkpoint[]) : [];
  } catch {
    return [];
  }
}

const listeners = new Set<() => void>();

/** Calls `fn` whenever the saved checkpoints change in this tab. Returns an unsubscribe function. */
export function subscribeCheckpoints(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function changed(): void {
  listeners.forEach((fn) => fn());
}

function writeAll(list: Checkpoint[]): boolean {
  try {
    window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  } finally {
    changed();
  }
}

/** True when at least one checkpoint is saved. */
export function hasSavedCheckpoints(): boolean {
  return typeof window !== "undefined" && readAll().length > 0;
}

/** Removes every saved checkpoint (presenter mode: the run's own, the user's are stashed). */
export function clearSavedCheckpoints(): void {
  try {
    if (window.localStorage.getItem(CHECKPOINT_STORAGE_KEY) === null) return;
    window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
  } catch {
    // Storage can fail; nothing to clear then.
  }
  changed();
}

const STASH_KEY = "privyus.tour.stash.checkpoints";

/**
 * Keeps the user's own checkpoints aside (sessionStorage) and empties the list.
 * A stash that already exists (a reload, a second start in the same tab) is the
 * user's original: it stays, and the list is emptied of the earlier run's save.
 */
export function stashCheckpoints(): void {
  try {
    if (window.sessionStorage.getItem(STASH_KEY) === null) {
      window.sessionStorage.setItem(STASH_KEY, window.localStorage.getItem(CHECKPOINT_STORAGE_KEY) ?? "__none__");
    }
  } catch {
    // Storage can fail; the tour still runs.
  }
  clearSavedCheckpoints();
}

/** Puts the user's stashed checkpoints back (the run's saves go). */
export function unstashCheckpoints(): void {
  try {
    const saved = window.sessionStorage.getItem(STASH_KEY);
    if (saved === null) return;
    if (saved === "__none__") window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
    else window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, saved);
    window.sessionStorage.removeItem(STASH_KEY);
  } catch {
    // Ignore.
  }
  changed();
}

/** Saved checkpoints, newest first. Empty on the server or when storage fails. */
export function listSavedCheckpoints(): Checkpoint[] {
  if (typeof window === "undefined") return [];
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getSavedCheckpoint(id: string): Checkpoint | undefined {
  if (typeof window === "undefined") return undefined;
  return readAll().find((c) => c.id === id);
}

export function deleteSavedCheckpoint(id: string): boolean {
  return writeAll(readAll().filter((c) => c.id !== id));
}

/**
 * Saves the current store state (graph, positions, viewport, chat) as a checkpoint.
 * Returns the checkpoint, or `null` when storage fails (the UI should still say "saved"
 * for the demo, but it can check this).
 */
export function saveCurrentExploration(catalog: Catalog, title?: string): Checkpoint | null {
  const state = useDemoStore.getState();
  const graph = state.snapshot();
  const now = new Date();
  const { central, counts } = countGraph(catalog, graph);
  const cp: Checkpoint = {
    id: `cp-${now.getTime().toString(36)}`,
    title: title ?? `Exploration, ${formatCheckpointDate(now.toISOString())}`,
    createdAt: now.toISOString(),
    central,
    counts,
    graph,
    chat: state.chat.map((t) => ({ turnId: t.turnId, question: t.question })),
  };
  const list = readAll();
  list.push(cp);
  return writeAll(list) ? cp : null;
}

/** Restores a checkpoint into the store: exact graph, positions, viewport, and chat. */
export function restoreCheckpoint(cp: Checkpoint, turns: ScriptTurn[]): void {
  const s = useDemoStore.getState();
  s.loadGraph(cp.graph);
  const byId = new Map(turns.map((t) => [t.id, t]));
  s.setChat(
    cp.chat
      .map((c) => {
        const turn = byId.get(c.turnId);
        return turn ? completedTurnState(turn, c.question) : null;
      })
      .filter((t): t is NonNullable<typeof t> => t !== null),
  );
}

/** Restores a saved checkpoint by id. Returns false when it is not found. */
export function restoreSavedCheckpoint(id: string, turns: ScriptTurn[]): boolean {
  const cp = getSavedCheckpoint(id);
  if (!cp) return false;
  restoreCheckpoint(cp, turns);
  return true;
}
