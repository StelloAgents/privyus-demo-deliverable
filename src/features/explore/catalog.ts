import { buildCatalog } from "@/lib/catalog";
import { graphMode } from "@/lib/graph-mode";
import { configureGraphLayout } from "@/lib/store";
import type { Entity, ScriptTurn, SourceDoc } from "@/lib/types";
import { edges, entities } from "@/data/entities";
import { script } from "@/data/script";
import { sources } from "@/data/sources";

export const catalog = buildCatalog({ entities, edges, sources });
export const storyTurns: ScriptTurn[] = script;
export const ROOT_ID = "ukraine";
// Graph positions are part of the store state (deterministic per graph content).
// The orbit graph is the default; `?graph=2d` keeps the 2D React Flow graph (lib/graph-mode.ts).
configureGraphLayout(catalog, ROOT_ID, graphMode() === "2d" ? "force" : "orbit");

export const scriptById = new Map(storyTurns.map((t) => [t.id, t]));

/** Undirected adjacency over every catalog edge. */
export const adjacency: Map<string, { node: string; edge: string }[]> = (() => {
  const adj = new Map<string, { node: string; edge: string }[]>();
  const add = (a: string, b: string, e: string) => {
    if (!adj.has(a)) adj.set(a, []);
    adj.get(a)!.push({ node: b, edge: e });
  };
  for (const e of Object.values(catalog.edges)) {
    add(e.source, e.target, e.id);
    add(e.target, e.source, e.id);
  }
  return adj;
})();

export function entity(id: string): Entity | undefined {
  return catalog.entities[id];
}

/** "S. 456", "Sen. Ellen Hartley", "Meetings", "Private meeting". */
export function shortLabel(id: string): string {
  const e = catalog.entities[id];
  if (!e) return id;
  if (e.type === "bill") return e.label.split(/\s+·\s+/)[0];
  return e.label;
}

/** "Mar 4, 2025" */
export function formatDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * The chip label: the source title. Long titles drop whole " · " segments from the
 * end (never a cut word or an ellipsis); the source drawer shows the full title.
 */
export function sourceChipLabel(src: SourceDoc, max = 40): string {
  const parts = src.title.split(" · ");
  while (parts.length > 1 && parts.join(" · ").length > max) parts.pop();
  return parts.join(" · ");
}

/** "A", "A and B", "A, B, and C" */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

const NUMBER_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
/** "Three" for 3, "12" for 12. Sentence start form. */
export function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}
