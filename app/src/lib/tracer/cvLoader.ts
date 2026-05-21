/**
 * Singleton async loader for OpenCV.js (WASM).
 * Loads /opencv.js as a <script> tag so the Emscripten runtime initialises
 * correctly — bundling it via Vite/Rollup breaks onRuntimeInitialized.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CvModule = any;

declare global {
  // eslint-disable-next-line no-var
  var cv: CvModule;
}

let readyPromise: Promise<CvModule> | null = null;

export function loadCv(): Promise<CvModule> {
  if (readyPromise) return readyPromise;

  readyPromise = new Promise<CvModule>((resolve, reject) => {
    const start = Date.now();

    // If a previous script tag already loaded OpenCV, cv global should exist
    if (typeof window.cv !== 'undefined' && window.cv.Mat) {
      try {
        const m = new window.cv.Mat(1, 1, 0);
        m.delete();
        console.log('[OpenCV] already ready');
        resolve(window.cv);
        return;
      } catch {
        // cv.Mat exists but WASM not ready yet — fall through to wait
      }
    }

    // Inject <script src="/opencv.js"> which puts `cv` on window and calls
    // window.cv.onRuntimeInitialized when the WASM heap is ready.
    const inject = () => {
      // Set the callback BEFORE the script loads to avoid race
      window.cv = window.cv || {};
      const prev = window.cv.onRuntimeInitialized;
      window.cv.onRuntimeInitialized = () => {
        if (typeof prev === 'function') { try { prev(); } catch { /* ignore */ } }
        console.log(`[OpenCV] ready in ${Date.now() - start}ms`);
        resolve(window.cv);
      };

      const script = document.createElement('script');
      script.src = '/opencv.js';
      script.async = true;
      script.onerror = () => reject(new Error('Failed to load /opencv.js'));
      document.head.appendChild(script);
    };

    // If the script is already in the DOM (e.g. HMR reload) just wait for ready
    const existing = document.querySelector('script[src="/opencv.js"]');
    if (existing) {
      const prev = (window.cv || {}).onRuntimeInitialized;
      window.cv = window.cv || {};
      window.cv.onRuntimeInitialized = () => {
        if (typeof prev === 'function') { try { prev(); } catch { /* ignore */ } }
        console.log(`[OpenCV] ready (existing script) in ${Date.now() - start}ms`);
        resolve(window.cv);
      };
    } else {
      inject();
    }

    setTimeout(() => {
      reject(new Error('OpenCV.js did not initialize within 30 s'));
    }, 30000);
  });

  return readyPromise;
}

export type { CvModule };
