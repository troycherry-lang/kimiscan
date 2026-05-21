import type { Point } from '@/types';
import { pointToLineDistance } from '@/lib/geometry/distance';

/**
 * Ramer-Douglas-Peucker polygon simplification
 * Reduces a dense pixel-polygon to a minimal set of vertices
 */
export function simplifyPolygon(points: Point[], epsilon: number): Point[] {
  if (points.length <= 3) return points;

  // Find the point with maximum distance from line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToLineDistance(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  // If max distance is less than epsilon, simplify to just endpoints
  if (maxDist <= epsilon) {
    return [first, last];
  }

  // Otherwise, recursively simplify both segments
  const left = simplifyPolygon(points.slice(0, maxIdx + 1), epsilon);
  const right = simplifyPolygon(points.slice(maxIdx), epsilon);

  // Concatenate, removing duplicate midpoint
  return [...left.slice(0, -1), ...right];
}

/**
 * Iterative RDP — reduces until target vertex count is reached
 */
export function simplifyToVertexCount(points: Point[], targetCount: number): Point[] {
  if (points.length <= targetCount) return points;

  let lo = 0;
  let hi = 10;
  let bestResult = points;

  // First, find an epsilon range that gives us approximately the right count
  while (true) {
    const result = simplifyPolygon(points, hi);
    if (result.length <= targetCount) break;
    lo = hi;
    hi *= 2;
    if (hi > 1000) { bestResult = result; break; }
  }

  // Binary search for the right epsilon
  for (let iter = 0; iter < 20; iter++) {
    const mid = (lo + hi) / 2;
    const result = simplifyPolygon(points, mid);
    if (result.length > targetCount) {
      lo = mid;
    } else {
      hi = mid;
      bestResult = result;
    }
    if (hi - lo < 0.01) break;
  }

  return bestResult.length <= 1 ? points : bestResult;
}
