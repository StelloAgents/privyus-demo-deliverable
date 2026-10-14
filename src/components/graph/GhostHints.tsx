"use client";

import { memo, useMemo, type CSSProperties } from "react";

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Ghost hints (2.10): unloaded neighbors as 6px dots at 15% opacity in a band
 * along the canvas edge. They drift slowly. Positions come from the ids, so
 * they stay in place between renders and in screenshots.
 */
function GhostHintsView({
  ids,
  reduced,
  insets,
}: {
  ids: string[];
  reduced: boolean;
  /** Overlay areas (header, controls): the dots stay out of them. */
  insets?: { top?: number; right?: number; bottom?: number; left?: number };
}) {
  const dots = useMemo(
    () =>
      ids.map((id) => {
        const h = hash(id);
        const side = h % 4; // 0 top, 1 right, 2 bottom, 3 left
        const along = ((h >>> 2) % 1000) / 1000; // 0..1 along the side
        const inset = 18 + ((h >>> 12) % 52); // px from the edge
        const pos: CSSProperties =
          side === 0
            ? { top: inset, left: `${6 + along * 88}%` }
            : side === 1
              ? { right: inset, top: `${8 + along * 84}%` }
              : side === 2
                ? { bottom: inset, left: `${6 + along * 88}%` }
                : { left: inset, top: `${8 + along * 84}%` };
        const dur = 9 + ((h >>> 18) % 8);
        const dx = ((h >>> 5) % 13) - 6;
        const dy = ((h >>> 9) % 13) - 6;
        return { id, pos, dur, dx, dy, delay: -((h >>> 22) % 9) };
      }),
    [ids],
  );

  return (
    <div
      className="pointer-events-none absolute z-[1] overflow-hidden"
      style={{
        top: insets?.top ?? 0,
        right: insets?.right ?? 0,
        bottom: insets?.bottom ?? 0,
        left: insets?.left ?? 0,
      }}
      aria-hidden="true"
    >
      {dots.map((d) => (
        <span
          key={d.id}
          className="absolute block rounded-full"
          style={
            {
              ...d.pos,
              width: 6,
              height: 6,
              background: "var(--teal-bright)",
              opacity: 0.15,
              "--drift-x": `${d.dx}px`,
              "--drift-y": `${d.dy}px`,
              animation: reduced ? undefined : `privy-drift ${d.dur}s ease-in-out ${d.delay}s infinite`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export const GhostHints = memo(GhostHintsView);
