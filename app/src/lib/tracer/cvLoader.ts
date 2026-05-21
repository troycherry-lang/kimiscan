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

    // The only reliable proof that WASM is fully loaded is being able to
    // actually instantiate a Mat. cv.Mat exists as a JS stub before WASM
    // loads, but the constructor throws until WASM is ready.
    const isWasmReady = (): boolean => {
      try {
        const m = new cvAny.Mat(1, 1, 0);
        m.delete();
        return true;
      } catch {
        return false;
      }
    };

    // Already ready (race-condition: WASM finished before this call)
    if (isWasmReady()) {
      console.log(`[OpenCV] WASM already ready at import time`);
      resolve(cv);
      return;
    }

    // Hook up the runtime-init callback (chain with any existing one)
    const prev = cvAny.onRuntimeInitialized;
    cvAny.onRuntimeInitialized = () => {
      if (typeof prev === 'function') { try { prev(); } catch { /* ignore */ } }
      console.log(`[OpenCV] onRuntimeInitialized fired in ${Date.now() - start}ms`);
      resolve(cv);
    };

    // Safety timeout
    setTimeout(() => {
      reject(new Error('OpenCV.js failed to initialize within 30 s — check the browser console for WASM errors'));
    }, 30000);
  });

  return readyPromise;
}

export type { CvModule };
