/**
 * OpenCV.js port of the leather-scanner pipeline.
 *
 * Pipeline (mirrors core/paper_detector.py + core/contour_extractor.py):
 *   1. Grayscale + GaussianBlur(5x5)
 *   2. Otsu threshold (THRESH_BINARY_INV) → templates white, background black
 *   3. Morphological CLOSE 25x25 → fills text/marks INSIDE pieces
 *   4. Morphological OPEN  9x9  → kills speckles
 *   5. Flood-fill from all 4 corners → erases scanner background blobs
 *   6. connectedComponentsWithStats → one mask per piece (area >= 1% of image)
 *   7. For each piece mask:
 *        a. findContours RETR_EXTERNAL CHAIN_APPROX_NONE → outer boundary
 *        b. Gaussian smooth on the polygon (kernel=21, 3 passes)
 *        c. Binary-search approxPolyDP epsilon → ~target node count
 *        d. Convert points → PathNode[] with tangent-derived bezier handles
 *   8. Detect inner holes per piece by intersecting Otsu mask with piece mask
 *      and finding small high-circularity contours.
 */

import type { Point, VectorPath, PathNode, DetectedHole } from '@/types';
import { generateId } from '@/lib/utils';
import { pxToMm } from '@/lib/geometry/transform';
import { dist } from '@/lib/geometry/distance';
import { loadCv, type CvModule } from './cvLoader';

export interface CvTraceOptions {
  targetNodes: number;   // desired node count per outer contour (10..60, default 20)
  smoothingPasses: number; // Gaussian smoothing passes on the polygon (0..6, default 3)
  dpi: number;
}

export interface CvTraceResult {
  paths: VectorPath[];
  detectedHoles: DetectedHole[];
}

export async function traceImageCv(
  imageData: ImageData,
  options: CvTraceOptions
): Promise<CvTraceResult> {
  console.log(`[trace] start: ${imageData.width}x${imageData.height}, target=${options.targetNodes} nodes, smoothing=${options.smoothingPasses}`);
  const t0 = performance.now();
  const cv = await loadCv();
  console.log(`[trace] cv loaded (+${(performance.now() - t0).toFixed(0)}ms)`);

  const paths: VectorPath[] = [];
  const detectedHoles: DetectedHole[] = [];

  // Wrap allocations so we can delete on exit
  const trash: { delete(): void }[] = [];
  const own = <T extends { delete(): void }>(m: T): T => {
    trash.push(m);
    return m;
  };

  // Yield to the event loop so the browser stays responsive
  const yieldToUi = () => new Promise<void>((r) => setTimeout(r, 0));

  try {
    // ── 1. Load image ──
    const src = own(cv.matFromImageData(imageData)); // RGBA
    const gray = own(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // ── 2. Blur + Otsu ──
    const blurred = own(new cv.Mat());
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    const otsu = own(new cv.Mat());
    cv.threshold(blurred, otsu, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
    console.log(`[trace] otsu done (+${(performance.now() - t0).toFixed(0)}ms)`);
    await yieldToUi();

    // ── 3. Close to fill text & marks INSIDE pieces ──
    const filled = own(new cv.Mat());
    const k25 = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(25, 25)));
    cv.morphologyEx(otsu, filled, cv.MORPH_CLOSE, k25);
    await yieldToUi();

    // ── 4. Open to kill speckles ──
    const k9 = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9)));
    cv.morphologyEx(filled, filled, cv.MORPH_OPEN, k9);
    console.log(`[trace] morphology done (+${(performance.now() - t0).toFixed(0)}ms)`);
    await yieldToUi();

    // ── 5. Flood-fill from each corner to erase scanner-background blobs ──
    const W = filled.cols;
    const H = filled.rows;
    const ffMask = own(new cv.Mat(H + 2, W + 2, cv.CV_8UC1, new cv.Scalar(0)));
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]] as const) {
      // only flood if that pixel is actually white (i.e. wrongly classified background)
      if (filled.ucharPtr(y, x)[0] === 255) {
        cv.floodFill(filled, ffMask, new cv.Point(x, y), new cv.Scalar(0));
      }
    }

    // ── 6. Connected components → per-piece masks ──
    const labels = own(new cv.Mat());
    const stats = own(new cv.Mat());
    const centroids = own(new cv.Mat());
    const numLabels = cv.connectedComponentsWithStats(filled, labels, stats, centroids, 8, cv.CV_32S);
    const totalArea = W * H;
    const minArea = totalArea * 0.01;

    interface Piece { mask: any; area: number; label: number }
    const pieces: Piece[] = [];
    for (let i = 1; i < numLabels; i++) {
      const area = stats.intAt(i, cv.CC_STAT_AREA);
      if (area < minArea) continue;

      // Build a binary mask for just this component
      const mask = own(new cv.Mat());
      const scalarMat = own(new cv.Mat(labels.rows, labels.cols, cv.CV_32S, new cv.Scalar(i)));
      cv.compare(labels, scalarMat, mask, cv.CMP_EQ);
      // cv.compare returns 0/255 in 8U single channel — perfect
      pieces.push({ mask, area, label: i });
    }
    pieces.sort((a, b) => b.area - a.area);
    console.log(`[trace] found ${pieces.length} pieces (+${(performance.now() - t0).toFixed(0)}ms)`);

    // ── 7. For each piece: outer contour + simplified path + hole detection ──
    for (let pIdx = 0; pIdx < pieces.length; pIdx++) {
      await yieldToUi();
      const piece = pieces[pIdx];

      // 7a. Find outer contour
      const contours = own(new cv.MatVector());
      const hierarchy = own(new cv.Mat());
      cv.findContours(piece.mask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);
      if (contours.size() === 0) continue;

      // pick the largest contour
      let bestContour: any = null;
      let bestArea = 0;
      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const a = cv.contourArea(c);
        if (a > bestArea) {
          bestArea = a;
          bestContour = c;
        }
      }
      if (!bestContour) continue;

      // 7b. Smooth + simplify
      const rawPts = matToPoints(bestContour);
      const smoothed = smoothPolygon(rawPts, 21, options.smoothingPasses);
      const simplified = binarySearchSimplify(cv, smoothed, options.targetNodes);

      // 7c. Build VectorPath with tangent-based bezier handles
      const nodes = pointsToNodesWithHandles(simplified, true);
      if (nodes.length < 3) continue;

      let pathLen = 0;
      for (let i = 0; i < nodes.length; i++) {
        pathLen += dist(nodes[i], nodes[(i + 1) % nodes.length]);
      }
      const pieceAreaPx = bestArea;
      const pieceAreaMm2 = pxToMm(Math.sqrt(pieceAreaPx), options.dpi) ** 2;

      const outerPath: VectorPath = {
        id: generateId(),
        name: `Piece ${pIdx + 1}`,
        nodes,
        closed: true,
        layer: 'cut',
        type: 'outer',
        lengthMm: pxToMm(pathLen, options.dpi),
        areaMm2: pieceAreaMm2,
        circularity: computeCircularity(simplified),
      };
      paths.push(outerPath);

      // 7d. Detect inner holes — intersect Otsu mask with piece mask, find small contours
      // Note: original Otsu was templates=white (THRESH_BINARY_INV). The drawn hole circles
      // appear inside the filled piece as small dark wells in the original image; in the
      // unfilled Otsu they may appear as either small dark bumps or as separate small components.
      // We detect them by looking at the difference between the FILLED piece mask and the
      // RAW Otsu within that piece — this gives us the dark inner regions that got filled in.
      const insidePiece = own(new cv.Mat());
      cv.bitwise_and(otsu, otsu, insidePiece, piece.mask); // otsu values restricted to piece
      const innerWells = own(new cv.Mat());
      cv.subtract(piece.mask, insidePiece, innerWells); // pixels filled by morphology = candidate holes/text
      // Open small to kill text strokes (thin)
      const kHole = own(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)));
      cv.morphologyEx(innerWells, innerWells, cv.MORPH_OPEN, kHole);

      const holeContours = own(new cv.MatVector());
      const holeHierarchy = own(new cv.Mat());
      cv.findContours(innerWells, holeContours, holeHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_NONE);

      for (let i = 0; i < holeContours.size(); i++) {
        const c = holeContours.get(i);
        const area = cv.contourArea(c);
        // Hole size sanity in mm² — typical 3/16" = ~18 mm², 1/4" = ~32 mm². Allow 4–200 mm².
        const areaMm2 = pxToMm(Math.sqrt(area), options.dpi) ** 2;
        if (areaMm2 < 4 || areaMm2 > 200) continue;

        const perim = cv.arcLength(c, true);
        if (perim < 1) continue;
        const circularity = (4 * Math.PI * area) / (perim * perim);
        if (circularity < 0.5) continue; // not round-ish, probably text fragment

        const m = cv.moments(c, false);
        if (m.m00 === 0) continue;
        const cx = m.m10 / m.m00;
        const cy = m.m01 / m.m00;

        const rect = cv.boundingRect(c);
        const widthMm = pxToMm(rect.width, options.dpi);
        const heightMm = pxToMm(rect.height, options.dpi);

        // Build a simple closed polygon path for the hole
        const holePts = matToPoints(c);
        const holeSmoothed = smoothPolygon(holePts, 9, 2);
        const holeSimplified = binarySearchSimplify(cv, holeSmoothed, 12);
        const holeNodes = pointsToNodesWithHandles(holeSimplified, true);
        if (holeNodes.length < 3) continue;

        let holeLen = 0;
        for (let j = 0; j < holeNodes.length; j++) {
          holeLen += dist(holeNodes[j], holeNodes[(j + 1) % holeNodes.length]);
        }

        const holePath: VectorPath = {
          id: generateId(),
          name: `Hole`,
          nodes: holeNodes,
          closed: true,
          layer: 'cut',
          type: 'hole',
          lengthMm: pxToMm(holeLen, options.dpi),
          areaMm2,
          circularity,
        };
        paths.push(holePath);

        const aspectRatio = Math.max(widthMm, heightMm) / Math.max(0.001, Math.min(widthMm, heightMm));
        detectedHoles.push({
          id: generateId(),
          pathId: holePath.id,
          x: cx,
          y: cy,
          widthMm: Math.min(widthMm, heightMm),
          heightMm: Math.max(widthMm, heightMm),
          circularity,
          aspectRatio,
        });
      }
    }
  } finally {
    // Free all WASM-side allocations
    for (const m of trash) {
      try { m.delete(); } catch { /* ignore */ }
    }
  }

  console.log(`[trace] DONE: ${paths.length} paths, ${detectedHoles.length} holes (+${(performance.now() - t0).toFixed(0)}ms)`);
  return { paths, detectedHoles };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function matToPoints(contour: any): Point[] {
  const data = contour.data32S as Int32Array;
  const pts: Point[] = [];
  for (let i = 0; i < data.length; i += 2) {
    pts.push({ x: data[i], y: data[i + 1] });
  }
  return pts;
}

function smoothPolygon(pts: Point[], kernelSize: number, passes: number): Point[] {
  if (passes <= 0 || pts.length < kernelSize) return pts;
  const half = Math.floor(kernelSize / 2);
  const sigma = kernelSize / 6.0;
  const kernel: number[] = [];
  let kSum = 0;
  for (let i = 0; i < kernelSize; i++) {
    const x = i - half;
    const v = Math.exp(-(x * x) / (2 * sigma * sigma));
    kernel.push(v);
    kSum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= kSum;

  let cur = pts.slice();
  for (let p = 0; p < passes; p++) {
    const out: Point[] = new Array(cur.length);
    const n = cur.length;
    for (let i = 0; i < n; i++) {
      let sx = 0, sy = 0;
      for (let k = 0; k < kernelSize; k++) {
        const idx = (i + k - half + n) % n;
        sx += cur[idx].x * kernel[k];
        sy += cur[idx].y * kernel[k];
      }
      out[i] = { x: sx, y: sy };
    }
    cur = out;
  }
  return cur;
}

function pointsToMat(cv: CvModule, pts: Point[]): any {
  const data = new Int32Array(pts.length * 2);
  for (let i = 0; i < pts.length; i++) {
    data[i * 2] = Math.round(pts[i].x);
    data[i * 2 + 1] = Math.round(pts[i].y);
  }
  return cv.matFromArray(pts.length, 1, cv.CV_32SC2, Array.from(data));
}

function binarySearchSimplify(cv: CvModule, pts: Point[], targetNodes: number): Point[] {
  if (pts.length <= targetNodes) return pts;

  const matIn = pointsToMat(cv, pts);
  let lo = 0.5;
  let hi = 50.0;
  let best: Point[] = pts;

  for (let iter = 0; iter < 22; iter++) {
    const eps = (lo + hi) / 2;
    const matOut = new cv.Mat();
    cv.approxPolyDP(matIn, matOut, eps, true);
    const result = matToPoints(matOut);
    matOut.delete();

    if (result.length === targetNodes) {
      best = result;
      break;
    } else if (result.length < targetNodes) {
      hi = eps;
      best = result;
    } else {
      lo = eps;
      best = result;
    }
    if (Math.abs(hi - lo) < 0.1) break;
  }
  matIn.delete();
  return best;
}

/**
 * Convert a polyline of anchor points into PathNode[] with bezier handles
 * derived from the local tangent (Catmull-Rom style: handle = 1/3 of the
 * vector to the next/previous neighbor). Guarantees bounded handles —
 * no spike artifacts ever.
 */
function pointsToNodesWithHandles(pts: Point[], closed: boolean): PathNode[] {
  const n = pts.length;
  if (n < 2) return [];
  const nodes: PathNode[] = [];
  const t = 1 / 3; // Catmull-Rom tension factor

  for (let i = 0; i < n; i++) {
    const prev = closed ? pts[(i - 1 + n) % n] : pts[Math.max(0, i - 1)];
    const cur = pts[i];
    const next = closed ? pts[(i + 1) % n] : pts[Math.min(n - 1, i + 1)];

    const handleOut: Point = { x: (next.x - prev.x) * t * 0.5, y: (next.y - prev.y) * t * 0.5 };
    const handleIn: Point = { x: -handleOut.x, y: -handleOut.y };

    nodes.push({
      id: generateId(),
      x: cur.x,
      y: cur.y,
      type: 'smooth',
      handleIn,
      handleOut,
    });
  }
  return nodes;
}

function computeCircularity(pts: Point[]): number {
  const n = pts.length;
  if (n < 3) return 0;
  let area = 0;
  let perim = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    perim += dist(pts[i], pts[j]);
  }
  area = Math.abs(area) / 2;
  if (perim === 0) return 0;
  return (4 * Math.PI * area) / (perim * perim);
}
