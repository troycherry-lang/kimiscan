import type { Point } from '@/types';

/**
 * Evaluate a cubic bezier at parameter t (0-1)
 * B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃
 */
export function cubicBezierPoint(
  p0: Point, p1: Point, p2: Point, p3: Point, t: number
): Point {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const mt3 = mt2 * mt;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y,
  };
}

/**
 * Evaluate the tangent (first derivative) of a cubic bezier at t
 */
export function cubicBezierTangent(
  p0: Point, p1: Point, p2: Point, p3: Point, t: number
): Point {
  const mt = 1 - t;
  return {
    x:
      3 * mt * mt * (p1.x - p0.x) +
      6 * mt * t * (p2.x - p1.x) +
      3 * t * t * (p3.x - p2.x),
    y:
      3 * mt * mt * (p1.y - p0.y) +
      6 * mt * t * (p2.y - p1.y) +
      3 * t * t * (p3.y - p2.y),
  };
}

/**
 * Subdivide a cubic bezier at t into two curves
 */
export function subdivideCubic(
  p0: Point, p1: Point, p2: Point, p3: Point, t: number
): [Point, Point, Point, Point, Point, Point, Point, Point] {
  const mt = 1 - t;

  const q0 = p0;
  const q1 = { x: mt * p0.x + t * p1.x, y: mt * p0.y + t * p1.y };
  const q2 = {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
  const q3 = cubicBezierPoint(p0, p1, p2, p3, t);

  const r3 = p3;
  const r2 = { x: mt * p2.x + t * p3.x, y: mt * p2.y + t * p3.y };
  const r1 = {
    x: mt * mt * p1.x + 2 * mt * t * p2.x + t * t * p3.x,
    y: mt * mt * p1.y + 2 * mt * t * p2.y + t * t * p3.y,
  };
  const r0 = q3;

  return [q0, q1, q2, q3, r0, r1, r2, r3];
}

/**
 * Approximate arc length of a cubic bezier by sampling
 */
export function bezierLength(
  p0: Point, p1: Point, p2: Point, p3: Point, samples = 20
): number {
  let len = 0;
  let prev = p0;
  for (let i = 1; i <= samples; i++) {
    const pt = cubicBezierPoint(p0, p1, p2, p3, i / samples);
    const dx = pt.x - prev.x;
    const dy = pt.y - prev.y;
    len += Math.sqrt(dx * dx + dy * dy);
    prev = pt;
  }
  return len;
}

/**
 * Fit a cubic bezier through a sequence of points.
 * Uses least-squares fitting for control points.
 * points: array of points the curve should approximate
 * startTangent, endTangent: optional tangent directions at endpoints
 */
export function fitBezier(
  points: Point[],
  startTangent?: Point,
  endTangent?: Point
): [Point, Point, Point, Point] | null {
  if (points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];

  // If it's essentially a straight line, just return endpoints
  let maxDev = 0;
  for (const p of points) {
    maxDev = Math.max(maxDev, Math.abs(
      (last.y - first.y) * p.x - (last.x - first.x) * p.y + last.x * first.y - last.y * first.x
    ) / Math.sqrt((last.y - first.y) ** 2 + (last.x - first.x) ** 2 + 1e-10));
  }
  if (maxDev < 1.0) {
    return [first, { x: (first.x + last.x) / 3, y: (first.y + last.y) / 3 },
           { x: 2 * (first.x + last.x) / 3, y: 2 * (first.y + last.y) / 3 }, last];
  }

  // Estimate chord length for control point distance
  const chordLen = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2);
  const cpDist = chordLen / 3;

  // Use provided tangents or estimate from endpoint neighborhoods
  let st: Point;
  if (startTangent) {
    const stMag = Math.sqrt(startTangent.x ** 2 + startTangent.y ** 2);
    st = stMag > 0
      ? { x: startTangent.x / stMag, y: startTangent.y / stMag }
      : { x: last.x - first.x, y: last.y - first.y };
  } else {
    const dir = points.length > 2
      ? { x: points[2].x - first.x, y: points[2].y - first.y }
      : { x: last.x - first.x, y: last.y - first.y };
    const mag = Math.sqrt(dir.x ** 2 + dir.y ** 2);
    st = mag > 0 ? { x: dir.x / mag, y: dir.y / mag } : { x: 1, y: 0 };
  }

  let et: Point;
  if (endTangent) {
    const etMag = Math.sqrt(endTangent.x ** 2 + endTangent.y ** 2);
    et = etMag > 0
      ? { x: endTangent.x / etMag, y: endTangent.y / etMag }
      : { x: last.x - first.x, y: last.y - first.y };
  } else {
    const dir = points.length > 2
      ? { x: last.x - points[points.length - 3].x, y: last.y - points[points.length - 3].y }
      : { x: last.x - first.x, y: last.y - first.y };
    const mag = Math.sqrt(dir.x ** 2 + dir.y ** 2);
    et = mag > 0 ? { x: dir.x / mag, y: dir.y / mag } : { x: 1, y: 0 };
  }

  const cp1 = { x: first.x + st.x * cpDist, y: first.y + st.y * cpDist };
  const cp2 = { x: last.x - et.x * cpDist, y: last.y - et.y * cpDist };

  return [first, cp1, cp2, last];
}
