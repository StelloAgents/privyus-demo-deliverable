import type { Catalog, Edge, Entity, SourceDoc } from "./types";

type Many<T> = T[] | Record<string, T>;

function toRecord<T extends { id: string }>(items: Many<T> | undefined): Record<string, T> {
  if (!items) return {};
  if (Array.isArray(items)) {
    const out: Record<string, T> = {};
    for (const item of items) out[item.id] = item;
    return out;
  }
  return items;
}

/** Builds the lookup tables that the graph engine and the script engine read. */
export function buildCatalog(input: {
  entities: Many<Entity>;
  edges: Many<Edge>;
  sources?: Many<SourceDoc>;
}): Catalog {
  return {
    entities: toRecord(input.entities),
    edges: toRecord(input.edges),
    sources: toRecord(input.sources),
  };
}

/** Splits "S. 456 · Defense Support Act" into a number and a title. */
export function splitBillLabel(entity: Entity): { number: string; title?: string } {
  const parts = entity.label.split(/\s+[·•|-]\s+/);
  if (parts.length > 1) return { number: parts[0], title: parts.slice(1).join(" · ") };
  return { number: entity.label, title: entity.sublabel };
}

/** Two-letter initials from a name, ignoring titles such as "Sen." and "Rep.". */
export function initialsOf(entity: Entity): string {
  if (entity.initials) return entity.initials;
  const words = entity.label
    .replace(/^(Sen|Rep|Gov|Dr|Mr|Ms|Mrs)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
