/**
 * Singleton async loader for OpenCV.js (WASM).
 *
 * Uses polling rather than onRuntimeInitialized callbacks because OpenCV.js
 * reassigns window.cv inside its own IIFE — any callback set on a pre-created
 * {} object is on the abandoned object and never fires.
 *
 * Polling every 100 ms handles: fresh load, HMR reload, script already in DOM.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvModule = any;

declare global {
  // eslint-disable-next-line no-var
  var cv: CvModule;
}

let readyPromise: Promise<CvModule> | null = null;

function isWasmReady(): boolean {
  try {
    if (typeof window.cv === 'undefined') return false;
    const m = new window.cv.Mat(1, 1, 0);
    m.delete();
    return true;
  } catch {
    return false;
  }
}

export function loadCv(): Promise<CvModule> {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise<CvModule>((resolve, reject) => {
    const start = Date.now();
    const TIMEOUT_MS = 30_000;
    const POLL_MS = 100;

    // Already ready (e.g. HMR reload with cv still in window)
    if (isWasmReady()) {
      console.log('[OpenCV] already ready at call time');
      resolve(window.cv);
      return;
    }

    // Inject the script tag if not already present
    if (!document.querySelector('script[src="/opencv.js"]')) {
      const script = document.createElement('script');
      script.src = '/opencv.js';
      script.async = true;
      script.onerror = () => {
        reject(new Error('Failed to load /opencv.js — confirm opencv.js is in /public/'));
      };
      document.head.appendChild(script);
      console.log('[OpenCV] injecting script tag…');
    } else {
      console.log('[OpenCV] script already in DOM, polling for WASM…');
    }

    // Poll until the WASM heap is live (Mat instantiation succeeds)
    const poll = setInterval(() => {
      if (isWasmReady()) {
        clearInterval(poll);
        console.log(`[OpenCV] WASM ready in ${Date.now() - start} ms`);
        resolve(window.cv);
      } else if (Date.now() - start > TIMEOUT_MS) {
        clearInterval(poll);
        reject(new Error(
          'OpenCV.js did not initialize within 30 s — check browser console for WASM errors'
        ));
      }
    }, POLL_MS);
  });

  return readyPromise;
}

export type { CvModule };
