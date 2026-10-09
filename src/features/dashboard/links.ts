import { script } from "@/data/script";

/**
 * Links from the dashboard into Exploration Mode (BUILD-SPEC.md sections 5 and 7).
 * Every link opens a script turn by its deep link, so the state is exact.
 */

/** The opening turn: the Ukraine overview. Its deep link starts with a chat of one turn. */
const OPENING_TURN = "ukraine-stance";

/** Entities on the opening graph open there with the focus on them (a clean chat). */
const ON_OPENING_GRAPH = new Set(["ukraine", "s456", "hr123"]);

/** Fixture checkpoints have no snapshot. They open the turn for their central entity. */
const TURN_FOR_CHECKPOINT: Record<string, string> = {
  "checkpoint-ukraine-2025": "ukraine-stance",
  "checkpoint-hartley-2026": "hartley-profile",
  "checkpoint-s456-2026": "defense-support-members",
};

function turnHref(turnId: string): string {
  const known = script.some((t) => t.id === turnId);
  return `/explore?turn=${encodeURIComponent(known ? turnId : script[0].id)}`;
}

/**
 * Opens one entity in Explore. Topic and bills open the opening turn focused on them.
 * Other entities use Explore's own `?entity=` entry, which builds the graph they need.
 */
export function exploreEntityHref(entityId?: string): string {
  if (!entityId || entityId === "ukraine") return turnHref(OPENING_TURN);
  if (ON_OPENING_GRAPH.has(entityId)) return `${turnHref(OPENING_TURN)}&focus=${encodeURIComponent(entityId)}`;
  return `/explore?entity=${encodeURIComponent(entityId)}`;
}

export function fixtureCheckpointHref(checkpointId: string, entityId: string): string {
  const turn = TURN_FOR_CHECKPOINT[checkpointId];
  return turn ? turnHref(turn) : exploreEntityHref(entityId);
}

export function savedCheckpointHref(checkpointId: string): string {
  return `/explore?checkpoint=${encodeURIComponent(checkpointId)}`;
}

export function askHref(question: string): string {
  return `/explore?q=${encodeURIComponent(question)}`;
}

/** "View full network map": the Ukraine overview with a clean chat. */
export const NETWORK_MAP_HREF = turnHref(OPENING_TURN);
