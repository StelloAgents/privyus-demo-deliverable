import type { EntityType } from "@/lib/types";

/** Circle diameter per node type (DESIGN.md section 5). */
export const NODE_SIZE: Record<EntityType, number> = {
  topic: 88,
  bill: 64,
  person: 56,
  org: 56,
  category: 40,
  detail: 32,
};

/** Distance from a parent to a child of this type. */
export const LINK_DISTANCE: Record<EntityType, number> = {
  topic: 260,
  bill: 250,
  person: 190,
  org: 200,
  category: 120,
  detail: 104,
};

export const PLUS_SIZE = 18;

/** Max label width under each node type (the label wraps to two lines). */
export const LABEL_WIDTH: Record<EntityType, number> = {
  topic: 200,
  bill: 180,
  person: 170,
  org: 170,
  category: 120,
  detail: 128,
};

const CHAR_PX: Record<EntityType, number> = {
  topic: 9.2,
  bill: 7.4,
  person: 7.2,
  org: 7.2,
  category: 6.6,
  detail: 6.6,
};

/**
 * Estimated box of a node plus its label (label under the circle).
 * Returns the width, the height, and how far the box center sits below the node center.
 */
export function nodeBox(type: EntityType, label: string, sublabel?: string): { w: number; h: number; dy: number } {
  const size = NODE_SIZE[type];
  const maxW = LABEL_WIDTH[type];
  const raw = label.length * CHAR_PX[type] + 12;
  const lines = Math.min(2, Math.ceil(raw / maxW));
  const subLines = sublabel ? Math.min(2, Math.ceil((sublabel.length * 6.4 + 12) / maxW)) : 0;
  const labelW = Math.min(maxW, Math.max(raw / lines, sublabel ? Math.min(maxW, sublabel.length * 6.4 + 12) : 0));
  const labelH = 6 + lines * 18 + subLines * 16 + 4;
  const w = Math.max(size, labelW);
  const h = size + labelH;
  return { w, h, dy: h / 2 - size / 2 };
}
