import type { Point } from '@/types';

/**
 * Compute a parallel offset path at distance `offset` inside a closed polygon
 * Uses a simple miter-join approach. Returns null if the offset would self-intersect.
 */
export function offsetPolygon(points: Point[], offset: number): Point[] | null {
  if (points.length < 3 || offset <= 0) return null;

  const result: Point[] = [];
  const maxMiter = offset * 3; // max miter length before beveling

  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length];
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    // Edge vectors
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const e1Len = Math.sqrt(e1x * e1x + e1y * e1y);
    if (e1Len === 0) continue;

    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;
    const e2Len = Math.sqrt(e2x * e2x + e2y * e2y);
    if (e2Len === 0) continue;

    // Inward normals for each edge
    const n1x = e1y / e1Len;
    const n1y = -e1x / e1Len;
    const n2x = e2y / e2Len;
    const n2y = -e2x / e2Len;

    // Offset points for each edge
    const o1x = prev.x + n1x * offset;
    const o1y = prev.y + n1y * offset;
    const o1bx = curr.x + n1x * offset;
    const o1by = curr.y + n1y * offset;

    const o2ax = curr.x + n2x * offset;
    const o2ay = curr.y + n2y * offset;
    const o2bx = next.x + n2x * offset;
    const o2by = next.y + n2y * offset;

    // Find intersection of offset edges (miter join)
    const dx1 = o1bx - o1x;
    const dy1 = o1by - o1y;
    const dx2 = o2bx - o2ax;
    const dy2 = o2by - o2ay;

    const denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-6) {
      // Parallel edges — use average of the two offset points at vertex
      result.push({
        x: (o1bx + o2ax) / 2,
        y: (o1by + o2ay) / 2,
      });
    } else {
      const t = ((o2ax - o1x) * dy2 - (o2ay - o1y) * dx2) / denom;
      const miterX = o1x + t * dx1;
      const miterY = o1y + t * dy1;

      // Check miter length
      const miterLen = Math.sqrt((miterX - curr.x) ** 2 + (miterY - curr.y) ** 2);

      if (miterLen > maxMiter) {
        // Bevel — use average
        result.push({
          x: (o1bx + o2ax) / 2,
          y: (o1by + o2ay) / 2,
        });
      } else {
        result.push({ x: miterX, y: miterY });
      }
    }
  }

  // Check for self-intersection (simple check: any segment crossing)
  for (let i = 0; i < result.length; i++) {
    const a1 = result[i];
    const a2 = result[(i + 1) % result.length];
    for (let j = i + 2; j < result.length; j++) {
      if (j === i || j === (i - 1 + result.length) % result.length) continue;
      const b1 = result[j];
      const b2 = result[(j + 1) % result.length];
      if (segmentsIntersect(a1, a2, b1, b2)) {
        // Self-intersection detected
        return null;
      }
    }
  }

  return result;
}

function segmentsIntersect(
  a1: Point, a2: Point, b1: Point, b2: Point
): boolean {
  function cross(ax: number, ay: number, bx: number, by: number) {
    return ax * by - ay * bx;
  }
  const d1 = cross(a2.x - a1.x, a2.y - a1.y, b1.x - a1.x, b1.y - a1.y);
  const d2 = cross(a2.x - a1.x, a2.y - a1.y, b2.x - a1.x, b2.y - a1.y);
  const d3 = cross(b2.x - b1.x, b2.y - b1.y, a1.x - b1.x, a1.y - b1.y);
  const d4 = cross(b2.x - b1.x, b2.y - b1.y, a2.x - b1.x, a2.y - b1.y);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  return false;
}

/**
 * Offset an open arc (polyline) perpendicularly toward `inwardRef`.
 * Endpoints (first and last) stay fixed as anchors; interior points are moved
 * by `inset` pixels along the inward normal of the local tangent.
 */
export function insetArc(arc: Point[], inset: number, inwardRef: Point): Point[] {
  if (arc.length < 2 || inset === 0) return arc.slice();
  const out: Point[] = new Array(arc.length);
  out[0] = { ...arc[0] };
  out[arc.length - 1] = { ...arc[arc.length - 1] };
  for (let i = 1; i < arc.length - 1; i++) {
    const prev = arc[i - 1];
    const cur = arc[i];
    const next = arc[i + 1];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const len = Math.hypot(tx, ty);
    if (len === 0) { out[i] = { ...cur }; continue; }
    // Two candidate normals
    const nx = -ty / len;
    const ny = tx / len;
    // Pick the one that points toward inwardRef
    const dot = (inwardRef.x - cur.x) * nx + (inwardRef.y - cur.y) * ny;
    const sign = dot >= 0 ? 1 : -1;
    out[i] = { x: cur.x + sign * nx * inset, y: cur.y + sign * ny * inset };
  }
  return out;
}

export function polygonCentroid(points: Point[]): Point {
  let cx = 0, cy = 0, a = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const q = points[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
    a += cross;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    // fallback: average
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / n, y: sy / n };
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

/**
 * Extract a sub-path from a closed polygon between two point indices.
 * Goes the shorter way by default, or the longer way if `longWay` is true.
 */
export function extractPathSegment(
  points: Point[],
  startIdx: number,
  endIdx: number,
  longWay: boolean = false
): Point[] {
  if (startIdx === endIdx) return [points[startIdx]];

  const n = points.length;
  // Forward distance
  let fwdDist = (endIdx - startIdx + n) % n;
  // Backward distance
  let bwdDist = (startIdx - endIdx + n) % n;

  const useForward = longWay ? fwdDist >= bwdDist : fwdDist <= bwdDist;

  const result: Point[] = [];
  if (useForward) {
    for (let i = 0; i <= fwdDist; i++) {
      result.push(points[(startIdx + i) % n]);
    }
  } else {
    for (let i = 0; i <= bwdDist; i++) {
      result.push(points[(startIdx - i + n) % n]);
    }
  }
  return result;
}
