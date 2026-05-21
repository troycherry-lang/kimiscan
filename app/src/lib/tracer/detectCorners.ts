import type { Point } from '@/types';
import { angleBetween } from '@/lib/geometry/distance';

/**
 * Detect corners in a simplified polygon.
 * A corner is a vertex where the angle change exceeds the threshold.
 * Returns indices of corner vertices.
 */
export function detectCorners(
  points: Point[],
  thresholdDeg: number = 120
): number[] {
  if (points.length < 3) return [];

  const corners: number[] = [];
  const n = points.length;

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const angle = angleBetween(prev, curr, next);
    // Angle between 180° (straight line) and threshold — smaller angle = sharper corner
    // We want corners where the path deviates significantly from straight
    if (angle < thresholdDeg) {
      corners.push(i);
    }
  }

  // If no corners found (very smooth shape), keep extrema
  if (corners.length === 0) {
    // Find points with max curvature by local angle
    let bestAngle = 180;
    let bestIdx = 0;
    for (let i = 0; i < n; i++) {
      const prev = points[(i - 1 + n) % n];
      const curr = points[i];
      const next = points[(i + 1) % n];
      const angle = angleBetween(prev, curr, next);
      if (angle < bestAngle) {
        bestAngle = angle;
        bestIdx = i;
      }
    }
    corners.push(bestIdx);
  }

  return corners;
}
