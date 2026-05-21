/**
 * Singleton async loader for OpenCV.js (WASM).
 * The first call returns a promise that resolves once the runtime is ready.
 * Subsequent calls return the cached promise.
 */
import cv from '@techstark/opencv-js';

type CvModule = typeof cv;

let readyPromise: Promise<CvModule> | null = null;

export function loadCv(): Promise<CvModule> {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise<CvModule>((resolve, reject) => {
    const start = Date.now();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cvAny = cv as any;

    // Hook up the runtime-init callback (chain with any existing one)
    const prev = cvAny.onRuntimeInitialized;
    cvAny.onRuntimeInitialized = () => {
      if (typeof prev === 'function') { try { prev(); } catch { /* ignore */ } }
      console.log(`[OpenCV] runtime initialized in ${Date.now() - start}ms`);
      resolve(cv);
    };

    // Polling fallback to handle the race where init completed between
    // import time and us attaching the callback. Some builds also resolve
    // via a promise on cv.ready.
    const tick = () => {
      if (cvAny.Mat) {
        console.log(`[OpenCV] runtime ready (poll) in ${Date.now() - start}ms`);
        resolve(cv);
        return;
      }
      if (Date.now() - start > 30000) {
        reject(new Error('OpenCV.js failed to initialize within 30 s'));
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });

  return readyPromise;
}

export type { CvModule };
