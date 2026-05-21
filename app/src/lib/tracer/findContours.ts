import type { Point } from '@/types';

export interface Contour {
  points: Point[];
  isOuter: boolean; // true = outer boundary, false = hole
  area: number;
  parent: number; // index of parent contour, -1 if none
}

/**
 * Find contours using a simplified Moore-Neighbor tracing on a binary image.
 * Returns array of contours with points in clockwise order for outer, CCW for holes.
 */
export function findContours(
  binary: Uint8ClampedArray,
  width: number,
  height: number
): Contour[] {
  const visited = new Uint8Array(width * height);
  const contours: Contour[] = [];

  // Helper to get pixel value (0 = bg, 255 = fg)
  const get = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return binary[y * width + x];
  };

  // 8-connected neighbors (clockwise from right)
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (binary[idx] !== 255 || visited[idx]) continue;

      // Start of a new component — trace its boundary
      const contour = traceContour(x, y, true);
      if (contour && contour.points.length > 3) {
        contours.push(contour);
        // Mark ALL pixels of this component (boundary + interior) as visited
        // so the outer loop skips them
        floodFillComponent(x, y);
      } else {
        // Tiny component — just mark the start pixel visited and move on
        visited[idx] = 1;
      }
    }
  }

  function traceContour(startX: number, startY: number, isOuter: boolean): Contour | null {
    const points: Point[] = [];
    let x = startX;
    let y = startY;
    let dir = 0; // initial direction

    // Find first boundary step
    for (let d = 0; d < 8; d++) {
      const nx = x + dx[d];
      const ny = y + dy[d];
      if (get(nx, ny) === 255) {
        dir = d;
        break;
      }
    }

    const firstX = x;
    const firstY = y;
    let steps = 0;
    const maxSteps = width * height; // safety limit

    do {
      points.push({ x, y });

      // Look for next boundary pixel: start from the pixel after the one we came from
      let found = false;
      for (let d = 0; d < 8; d++) {
        const nd = (dir + 6 + d) % 8; // start 2 steps counter-clockwise from incoming
        const nx = x + dx[nd];
        const ny = y + dy[nd];
        if (get(nx, ny) === 255) {
          x = nx;
          y = ny;
          dir = nd;
          found = true;
          break;
        }
      }
      if (!found) break;
      steps++;
    } while ((x !== firstX || y !== firstY) && steps < maxSteps);

    if (points.length < 4) return null;

    const area = polygonArea(points);
    return { points, isOuter, area: Math.abs(area), parent: -1 };
  }

  /**
   * Scanline flood fill — marks all connected 255 pixels as visited.
   * Much more memory-efficient than a pixel-stack for large filled shapes.
   */
  function floodFillComponent(startX: number, startY: number) {
    const stack: [number, number, number][] = []; // [y, xLeft, xRight]
    
    // Find span containing startX on startY
    let xLeft = startX;
    while (xLeft > 0 && !visited[startY * width + (xLeft - 1)] && binary[startY * width + (xLeft - 1)] === 255) {
      xLeft--;
    }
    let xRight = startX;
    while (xRight < width - 1 && !visited[startY * width + (xRight + 1)] && binary[startY * width + (xRight + 1)] === 255) {
      xRight++;
    }
    
    // Mark the span
    for (let x = xLeft; x <= xRight; x++) {
      visited[startY * width + x] = 1;
    }
    stack.push([startY, xLeft, xRight]);

    while (stack.length > 0) {
      const [y, xl, xr] = stack.pop()!;
      
      // Check line above: y - 1
      if (y > 0) {
        scanLine(y - 1, xl, xr);
      }
      // Check line below: y + 1
      if (y < height - 1) {
        scanLine(y + 1, xl, xr);
      }
    }

    function scanLine(scanY: number, xl: number, xr: number) {
      let x = xl;
      while (x <= xr) {
        // Find first unvisited foreground pixel in range
        while (x <= xr && (visited[scanY * width + x] || binary[scanY * width + x] !== 255)) {
          x++;
        }
        if (x > xr) break;
        
        // Found start of a span — extend left/right
        const spanLeft = x;
        while (x <= xr && !visited[scanY * width + x] && binary[scanY * width + x] === 255) {
          visited[scanY * width + x] = 1;
          x++;
        }
        const spanRight = x - 1;
        stack.push([scanY, spanLeft, spanRight]);
      }
    }
  }

  // Distinguish outer contours from holes by checking nesting
  for (let i = 0; i < contours.length; i++) {
    for (let j = 0; j < contours.length; j++) {
      if (i === j) continue;
      if (pointInPolygon(contours[j].points[0], contours[i].points)) {
        contours[j].parent = i;
        contours[j].isOuter = false;
      }
    }
  }

  return contours;
}

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const j = (i + 1) % points.length;
    area += points[i].x * points[j].y - points[j].x * points[i].y;
  }
  return area / 2;
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y)) &&
      (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 1e-10) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}
