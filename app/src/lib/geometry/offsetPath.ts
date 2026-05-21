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
