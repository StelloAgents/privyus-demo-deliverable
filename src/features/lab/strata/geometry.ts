import * as THREE from "three";
import { EDGES, NODE_BY_ID, type StrataEdge } from "./graph";

const SAMPLES = 32;

/**
 * Edge shape. Between planes the curve leaves each node vertically, so the
 * edges read as threads that drop from one stratum to the next.
 * On one plane the curve lifts a little, so it never lies flat on the grid.
 */
function curveFor(ed: StrataEdge): THREE.CubicBezierCurve3 {
  const a = new THREE.Vector3(...NODE_BY_ID.get(ed.source)!.position);
  const b = new THREE.Vector3(...NODE_BY_ID.get(ed.target)!.position);
  const dy = b.y - a.y;
  if (Math.abs(dy) < 0.01) {
    const lift = Math.min(1.4, a.distanceTo(b) * 0.18);
    const c1 = a.clone().lerp(b, 0.25).setY(a.y + lift);
    const c2 = a.clone().lerp(b, 0.75).setY(a.y + lift);
    return new THREE.CubicBezierCurve3(a, c1, c2, b);
  }
  const c1 = a.clone().setY(a.y + dy * 0.55);
  const c2 = b.clone().setY(b.y - dy * 0.55);
  return new THREE.CubicBezierCurve3(a, c1, c2, b);
}

export interface EdgeGeom {
  points: THREE.Vector3[];
  length: number;
  mid: THREE.Vector3;
}

export const EDGE_GEOM = new Map<string, EdgeGeom>(
  EDGES.map((ed) => {
    const curve = curveFor(ed);
    const points = curve.getPoints(SAMPLES);
    let length = 0;
    for (let i = 1; i < points.length; i++) length += points[i].distanceTo(points[i - 1]);
    return [ed.id, { points, length, mid: curve.getPoint(0.5) }];
  }),
);

/** A point on the edge, measured as a share of the way from `from`. */
export function pointFrom(ed: StrataEdge, from: string, t: number): THREE.Vector3 {
  const g = EDGE_GEOM.get(ed.id)!;
  const pts = ed.source === from ? g.points : [...g.points].reverse();
  const f = t * (pts.length - 1);
  const i = Math.floor(f);
  return pts[i].clone().lerp(pts[Math.min(i + 1, pts.length - 1)], f - i);
}
