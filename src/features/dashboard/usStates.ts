import outlines from "./us-states.json";

/** State outlines (lng, lat rings), simplified from public US Census boundaries (us-atlas). */
export const STATE_RINGS = outlines as unknown as Record<string, [number, number][][]>;

/** Border paths for the globe: each ring as a list of [lat, lng]. */
export const STATE_PATHS: { code: string; points: [number, number][] }[] = Object.entries(STATE_RINGS).flatMap(([code, rings]) =>
  rings.map((ring) => ({ code, points: ring.map(([lng, lat]) => [lat, lng] as [number, number]) })),
);

function inRing(lng: number, lat: number, ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The state at a point, or null. */
export function stateAt(lat: number, lng: number): string | null {
  for (const [code, rings] of Object.entries(STATE_RINGS)) {
    if (rings.some((r) => inRing(lng, lat, r))) return code;
  }
  return null;
}
