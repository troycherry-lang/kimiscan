# Cascade Handoff — KimiScan Tracer Fixes

**DO NOT modify any other files.** These are the only changes needed.

---

## FIX 1: Tighter Curves (tracer.worker.js)

**File:** `app/public/tracer.worker.js`

**Find these 2 lines** (around line 207-208):
```javascript
var tolMm=Math.max(0.05, 1.1-(detail/60)*1.0);
var tolPx=tolMm*(dpi/25.4);
```

**Replace with:**
```javascript
// tolPx directly in pixels: detail 60=0.7px (tight), 10=4px (loose)
var tolPx = Math.max(0.5, (70 - detail) / 15);
```

**What this does:** Default detail=45 now gives ~1.7px tolerance instead of 4.1px. The curves hug the scanned edge much closer — within laser kerf (0.1mm = ~1.2px at 300 DPI).

---

## FIX 2: Spike Guard (tracer.worker.js)

**File:** `app/public/tracer.worker.js`

**Find this block** inside `fitCubic()` (around line 125):
```javascript
var errRef=maxErr(pts,pts[0],c1,c2,pts[n-1],u);
if (errRef.err<=tol||depth>=10) return [{p0:pts[0],c1:c1,c2:c2,p3:pts[n-1]}];
var si=Math.max(1,Math.min(n-2,errRef.idx));
```

**Replace with:**
```javascript
var errRef=maxErr(pts,pts[0],c1,c2,pts[n-1],u);
if (errRef.err<=tol||depth>=10) return [{p0:pts[0],c1:c1,c2:c2,p3:pts[n-1]}];

// --- Split guard: don't chase tiny spikes ---
if (depth >= 3 && n > 20) {
  var spikeWin = Math.max(2, Math.floor(n * 0.03));
  var ls = Math.max(0, errRef.idx - spikeWin);
  var le = Math.min(n - 1, errRef.idx + spikeWin);
  var localLen = 0;
  for (var li = ls + 1; li <= le; li++) {
    var ldx = pts[li].x - pts[li-1].x, ldy = pts[li].y - pts[li-1].y;
    localLen += Math.sqrt(ldx*ldx + ldy*ldy);
  }
  var totalLen = 0;
  for (var li = 1; li < n; li++) {
    var ldx = pts[li].x - pts[li-1].x, ldy = pts[li].y - pts[li-1].y;
    totalLen += Math.sqrt(ldx*ldx + ldy*ldy);
  }
  if (totalLen > 0 && localLen / totalLen < 0.03) {
    return [{p0:pts[0],c1:c1,c2:c2,p3:pts[n-1]}];
  }
}

var si=Math.max(1,Math.min(n-2,errRef.idx));
```

**What this does:** Prevents recursive splitting on tiny scanner noise spikes. If the error region is < 3% of segment length, it's noise — accept the bezier.

---

## FIX 3: Simplify Button + UI Relabel (TraceSettingsSection.tsx)

**File:** `app/src/components/panels/TraceSettingsSection.tsx`

If this file doesn't have the Simplify button yet, replace the entire file with the version from the deployed build. The key changes are:

1. Detail slider: 10-60 maps to "coarse" → "very fine" (was "target nodes")
2. Smooth slider: 0-3 passes (was 0-5)
3. Added "Simplify" button next to Retrace (active when path selected, re-fits with 1.5x tolerance)

---

## FIX 4: smoothing vs smoothingPasses field name

**File:** `app/src/store/useAppStore.ts`

**Check line ~187** in the `runTrace` function. The worker expects `smoothing` (not `smoothingPasses`).

**Ensure the call looks like:**
```typescript
const result = await traceImageCv(imageData, {
  detail: state.traceSettings.detail ?? 45,
  smoothing: state.traceSettings.smoothing ?? 0,
  dpi: currentImage.dpi,
});
```

**Also check** that the result uses `detectedHoles` not `holes`:
```typescript
set({
  paths: result.paths,
  detectedHoles: result.detectedHoles,  // NOT result.holes
  // ...
});
```

---

## FIX 5: Delete obsolete files

**Remove these files (no longer used):**
- `app/src/lib/tracer/cvLoader.ts`
- `app/src/lib/tracer/curveFit.ts`

The OpenCV.js loader is now inside `tracer.worker.js`. No need for a separate loader.

---

## cvTracer.ts should match this (Web Worker bridge only)

**File:** `app/src/lib/tracer/cvTracer.ts`

This file should be a thin bridge — ~50 lines. It posts ImageData to the worker and returns the result. The full Schneider bezier fitting lives in `tracer.worker.js` now. The only local function kept is `fitBezierContour()` for the Simplify button.

---

## FILES TO DELETE

```bash
rm app/src/lib/tracer/cvLoader.ts
rm app/src/lib/tracer/curveFit.ts
```

## TEST

1. Load scan
2. Hit Trace
3. Curves should hug the manilla edge tightly (no visible gap)
4. No spike/jag artifacts on smooth sections
5. Toggle image off — vectors alone should look clean
