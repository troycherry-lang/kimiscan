# StencilForge — Handoff Checklist for Local Agent

## Overview
This is a Tauri-ready web application for converting scanned manilla folder stencils into laser-cut acrylic vectors for leather holster crafting. The core app is built and functional. Ollama AI integration and some advanced features are stubbed for completion by your local agent.

## How to Wrap in Tauri
1. `cd /mnt/agents/output/app`
2. `npm install` — install dependencies
3. `npm run build` — produces `dist/` folder
4. Initialize Tauri: `npm install -D @tauri-apps/cli`
5. Run `npx tauri init` — point web assets to `../dist`
6. Run `npx tauri dev` to test, `npx tauri build` to produce `.exe`

---

## ✅ Completed
- [x] Desktop app shell (menu bar, toolbar, left/right panels, canvas, status bar)
- [x] Dark industrial theme with full design tokens
- [x] Image import (drag-drop, file picker, paste)
- [x] Image preprocessing (threshold, blur, edge detect, invert)
- [x] Potrace-style tracing engine (contour finding, bezier fitting, node reduction)
- [x] Vector path editor (select, move, add, delete nodes, bezier handles)
- [x] Hole detection with classical circularity analysis
- [x] Hole preset library (CRUD, apply to detected holes)
- [x] Glue line tool (entry/exit points, shortest path, offset, flip)
- [x] Text label placement and editing
- [x] SVG export for LightBurn (black=cut, blue=engrave)
- [x] Project save/load (.stencil format)
- [x] Undo/redo system (50 actions)
- [x] Ollama integration stub (useOllamaVision hook with health check, timeout, fallback)
- [x] Keyboard shortcuts for all tools
- [x] Canvas zoom/pan/grid/rulers
- [x] Real-time threshold preview

---

## 🔲 For Local Agent

### 1. Ollama Model Setup
```bash
ollama pull qwen2.5-vl:7b
```
Test that it's running: `curl http://localhost:11434/api/tags`

### 2. Wire AI Hole Classification
- **File**: `src/lib/ollama/index.ts` (already has `classifyHole()` function)
- **Task**: In `HolePresetsSection.tsx`, replace the basic circularity-based suggestion with actual Ollama call
- **Flow**: When holes are detected, send each hole crop to Ollama, display suggestion with confidence score
- **Fallback**: If Ollama fails, keep current circularity-based suggestion

### 3. Wire AI Text OCR
- **File**: `src/lib/ollama/index.ts` (already has `readTextLabels()` function)
- **Task**: Add "AI Read Labels" button in right panel or toolbar
- **Flow**: Send full scan image to Ollama, get back text labels with positions, display on canvas
- **UI**: Each detected label shows as editable text box on canvas

### 4. Wire AI Glue Marker Detection
- **File**: `src/lib/ollama/index.ts` (already has `findGlueMarkers()` function)
- **Task**: Add "Auto-detect markers" button in Glue Line section
- **Flow**: Send scan image to Ollama, get back 2 marker positions, auto-populate entry/exit points
- **Fallback**: User can always manually click entry/exit points

### 5. Prompt Tuning
- **File**: `src/lib/ollama/prompts.ts`
- **Task**: After testing with real scans, adjust the prompt strings to improve accuracy
- The prompts are designed for Qwen2.5-VL 7B — they may need tweaking for your specific scanner/lighting

### 6. EPSON Scanner Integration (V2)
- **File**: `src-tauri/src/main.rs` (Tauri Rust backend)
- **Task**: Add WIA (Windows Image Acquisition) support for direct scan-to-app
- **Alternative**: File system watcher on a "scans" folder — auto-import new files

### 7. Nesting / Bin Packing
- **File**: `src/lib/geometry/nesting.ts` (needs to be created)
- **Task**: Implement greedy bottom-left bin packing for 500×700mm bed
- **UI**: Add nesting view with drag-drop arrangement on virtual bed

### 8. Additional Export Formats
- **PDF**: Use `jspdf` library for PDF output
- **DXF**: Simple DXF text generation (AutoCAD format)

### 9. Calibration Wizard
- On first import, prompt user to scan a credit card (85.60×53.98mm)
- App measures it in pixels and calculates true DPI
- Store calibration per scanner model

### 10. Polish & Testing
- Test trace quality on your actual manilla scans
- Adjust default trace settings (threshold, blur, corner threshold) for your scanner
- Verify SVG imports correctly into LightBurn
- Test on your laser with the 10mm test cut square

---

## Architecture Notes

### State Management
- All state is in `src/store/useAppStore.ts` (Zustand)
- The store handles undo/redo via a command pattern
- AI responses should update state through store actions

### Ollama Integration Pattern
```typescript
// Check health on app startup
const isReady = await checkOllamaHealth({ baseUrl, model });
setOllamaStatus(isReady ? 'ready' : 'disconnected');

// Use vision model
const result = await classifyHole(config, base64Image);
if (result) { /* show suggestion */ }
else { /* use classical fallback */ }
```

### Canvas Coordinate System
- Internal: pixels at scan DPI
- Display: millimeters (converted via `pxToMm()` / `mmToPx()`)
- Origin: top-left of scanned image

### File Format (.stencil)
- JSON-based, stores image + paths + settings
- See `src/types/index.ts` → `ProjectFile` interface

---

## Questions?
The design document at `/mnt/agents/output/design.md` has full specifications for every feature.
