import type { Point } from '@/types';

export function dist(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function distSq(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function pointToLineDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

export function pointToSegmentProjection(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { ...a };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export function angleBetween(a: Point, center: Point, b: Point): number {
  const va = { x: a.x - center.x, y: a.y - center.y };
  const vb = { x: b.x - center.x, y: b.y - center.y };
  const dot = va.x * vb.x + va.y * vb.y;
  const magA = Math.sqrt(va.x * va.x + va.y * va.y);
  const magB = Math.sqrt(vb.x * vb.x + vb.y * vb.y);
  if (magA === 0 || magB === 0) return 0;
  let cos = dot / (magA * magB);
  cos = Math.max(-1, Math.min(1, cos));
  return Math.acos(cos) * (180 / Math.PI);
}
