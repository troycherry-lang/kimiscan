/**
 * KimiScan Trace Pipeline — Web Worker bridge
 *
 * All OpenCV WASM runs in tracer.worker.js (public/) off the main thread.
 * This keeps the UI responsive regardless of image size.
 */

import type { VectorPath, DetectedHole } from '@/types';

export interface CvTraceOptions {
  detail: number;
  smoothingPasses: number;
  dpi: number;
}

export interface CvTraceResult {
  paths: VectorPath[];
  detectedHoles: DetectedHole[];
}

export function traceImageCv(
  imageData: ImageData,
  options: CvTraceOptions
): Promise<CvTraceResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker('/tracer.worker.js');

    worker.onmessage = (e: MessageEvent) => {
      const data = e.data as { type: string; msg?: string; result?: CvTraceResult; message?: string };
      if (data.type === 'log') {
        console.log(data.msg);
      } else if (data.type === 'result') {
        worker.terminate();
        console.log('[tracer] result:', JSON.stringify((data.result as any)?._debug));
        resolve(data.result!);
      } else if (data.type === 'error') {
        worker.terminate();
        reject(new Error(data.message));
      }
    };

    worker.onerror = (e: ErrorEvent) => {
      worker.terminate();
      reject(new Error(e.message || 'Worker error'));
    };

    // Copy the pixel buffer (slice avoids detaching imageData in case caller needs it)
    const pixels = imageData.data.buffer.slice(0);
    worker.postMessage(
      { pixels, width: imageData.width, height: imageData.height, options },
      [pixels]
    );
  });
}
