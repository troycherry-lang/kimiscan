/**
 * Coordinate transforms between pixels (at scan DPI) and millimeters
 */

export function pxToMm(px: number, dpi: number): number {
  return (px / dpi) * 25.4;
}

export function mmToPx(mm: number, dpi: number): number {
  return (mm / 25.4) * dpi;
}

export function formatMm(mm: number, decimals = 2): string {
  return mm.toFixed(decimals);
}
