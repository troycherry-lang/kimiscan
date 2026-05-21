/**
 * Tracer entry point — thin wrapper over the OpenCV.js pipeline.
 * The legacy hand-rolled tracer (binarize / findContours / simplifyPolygon /
 * detectCorners / fitBezier) was replaced because it could not produce clean
 * single-piece outlines for scanned stencils. See cvTracer.ts for the new
 * pipeline.
 */

import type { VectorPath, DetectedHole } from '@/types';
import { traceImageCv, type CvTraceOptions } from './cvTracer';

export interface TraceOptions {
  detail: number;
  smoothing: number;
  dpi: number;
}

export interface TraceResult {
  paths: VectorPath[];
  detectedHoles: DetectedHole[];
}

export async function traceImage(
  imageData: ImageData,
  options: TraceOptions
): Promise<TraceResult> {
  const cvOptions: CvTraceOptions = {
    detail: options.detail,
    smoothingPasses: options.smoothing,
    dpi: options.dpi,
  };
  return traceImageCv(imageData, cvOptions);
}
