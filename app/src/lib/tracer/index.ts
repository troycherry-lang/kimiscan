import type { Point, VectorPath, PathNode } from '@/types';
import { binarize } from './binarize';
import { findContours } from './findContours';
import { simplifyPolygon } from './simplifyPolygon';
import { detectCorners } from './detectCorners';
import { fitBezier } from '@/lib/geometry/bezier';
import { dist, distSq } from '@/lib/geometry/distance';
import { pxToMm } from '@/lib/geometry/transform';
import { offsetPolygon } from '@/lib/geometry/offsetPath';
import { generateId } from '@/lib/utils';

export interface TraceOptions {
  threshold: number;
  blur: number;
  cornerThreshold: number;
  minPathSize: number;
  invert: boolean;
  dpi: number;
}

export interface TraceResult {
  paths: VectorPath[];
  thresholdUsed: number;
}

export function traceImage(imageData: ImageData, options: TraceOptions): TraceResult {
  // Step 1: Binarize
  const { binary, thresholdUsed } = binarize(imageData, {
    threshold: options.threshold,
    blur: options.blur,
    invert: options.invert,
  });

  // Step 2: Find contours
  const contours = findContours(binary, imageData.width, imageData.height);

  // Step 3: Filter and convert to vector paths
  const paths: VectorPath[] = [];

  for (const contour of contours) {
    // Skip tiny paths — minPathSize is in mm²
    const areaMm2 = pxToMm(Math.sqrt(contour.area), options.dpi) ** 2;
    if (areaMm2 < options.minPathSize) continue;
    if (contour.points.length < 10) continue;

    // Step 3a: Simplify polygon
    const epsilon = 1.5; // pixel tolerance for RDP
    const simplified = simplifyPolygon(contour.points, epsilon);
    if (simplified.length < 3) continue;

    // Step 3b: Detect corners
    const cornerIndices = detectCorners(simplified, options.cornerThreshold);

    // Step 3c: Build bezier segments between corners
    const nodes: PathNode[] = [];
    const handleInQueue: Array<{ x: number; y: number; handleIn: Point }> = [];
    const n = simplified.length;

    if (cornerIndices.length === 0) {
      // Single smooth curve — use start and end as corners
      cornerIndices.push(0);
      cornerIndices.push(Math.floor(n / 2));
    }

    // Ensure we have unique, sorted corner indices
    const uniqueCorners = [...new Set(cornerIndices)].sort((a, b) => a - b);

    for (let i = 0; i < uniqueCorners.length; i++) {
      const cIdx = uniqueCorners[i];
      const nextCIdx = uniqueCorners[(i + 1) % uniqueCorners.length];

      // Collect points between this corner and the next
      const segmentPoints: Point[] = [];
      let idx = cIdx;
      while (true) {
        segmentPoints.push(simplified[idx]);
        if (idx === nextCIdx) break;
        idx = (idx + 1) % n;
      }

      if (segmentPoints.length < 2) continue;

      // Fit bezier to this segment
      const startPt = segmentPoints[0];
      const endPt = segmentPoints[segmentPoints.length - 1];

      // Estimate tangents from neighboring segments
      const prevPt = simplified[(cIdx - 1 + n) % n];
      const nextPt = simplified[(nextCIdx + 1) % n];

      const startTangent = { x: startPt.x - prevPt.x, y: startPt.y - prevPt.y };
      const endTangent = { x: nextPt.x - endPt.x, y: nextPt.y - endPt.y };

      const bezier = fitBezier(segmentPoints, startTangent, endTangent);

      if (bezier) {
        const [, cp1, cp2] = bezier;
        const handleOut = {
          x: cp1.x - startPt.x,
          y: cp1.y - startPt.y,
        };

        // First pass: create node with handleOut only
        const existing = nodes.find(nd => distSq(nd, startPt) < 0.1);
        if (!existing) {
          nodes.push({
            id: generateId(),
            x: startPt.x,
            y: startPt.y,
            type: 'smooth',
            handleOut,
          });
        } else {
          existing.handleOut = handleOut;
        }

        // Store handleIn data for second pass (keyed by end point)
        handleInQueue.push({
          x: endPt.x,
          y: endPt.y,
          handleIn: { x: cp2.x - endPt.x, y: cp2.y - endPt.y },
        });
      }
    }

    // Second pass: apply handleIn to each node by matching position
    for (const { x, y, handleIn } of handleInQueue) {
      const node = nodes.find(nd => distSq(nd, { x, y }) < 0.1);
      if (node) node.handleIn = handleIn;
    }

    // Emit all contours (outer and holes)
    if (nodes.length >= 3) {
      // Compute path metadata
      let pathLen = 0;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const b = nodes[(i + 1) % nodes.length];
        pathLen += dist(a, b);
      }

      const isClosed = true;
      const path: VectorPath = {
        id: generateId(),
        name: contour.isOuter ? 'Outer Contour' : `Hole ${paths.length}`,
        nodes,
        closed: isClosed,
        layer: 'cut',
        type: contour.isOuter ? 'outer' : 'hole',
        lengthMm: pxToMm(pathLen, options.dpi),
        areaMm2,
        circularity: computeCircularity(contour.points),
      };
      paths.push(path);
    }
  }

  return { paths, thresholdUsed };
}

function computeCircularity(points: Point[]): number {
  // 4π × area / perimeter² — 1.0 = perfect circle
  const n = points.length;
  let area = 0;
  let perim = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
    perim += dist(points[i], points[j]);
  }
  area = Math.abs(area) / 2;
  if (perim === 0) return 0;
  return (4 * Math.PI * area) / (perim * perim);
}

// Re-export for convenience
export { binarize, findContours, simplifyPolygon, detectCorners, offsetPolygon };