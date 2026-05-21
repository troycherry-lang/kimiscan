import { create } from 'zustand';
import type {
  AppState, Tool, VectorPath, TraceSettings, ScannedImage,
  DetectedHole, HolePreset, GlueLine, TextLabel, GlueLineEditState,
  NestingConfig, Point,
} from '@/types';
import { traceImage } from '@/lib/tracer';
import { generateId, clamp } from '@/lib/utils';

const DEFAULT_TRACE_SETTINGS: TraceSettings = {
  targetNodes: 24,
  smoothingPasses: 3,
};

const DEFAULT_HOLE_PRESETS: HolePreset[] = [
  { id: '3mm-round', name: '3mm Round', shape: 'circle', widthMm: 3, lengthMm: 3 },
  { id: '4mm-round', name: '4mm Round', shape: 'circle', widthMm: 4, lengthMm: 4 },
  { id: '5mm-round', name: '5mm Round', shape: 'circle', widthMm: 5, lengthMm: 5 },
  { id: '4mm-oblong-12', name: '4mm Oblong (12mm)', shape: 'oblong', widthMm: 4, lengthMm: 12 },
  { id: '6mm-oblong-20', name: '6mm Oblong (20mm)', shape: 'oblong', widthMm: 6, lengthMm: 20 },
];

const DEFAULT_NESTING_CONFIG: NestingConfig = {
  bedWidthMm: 500,
  bedHeightMm: 700,
  spacingMm: 3,
  allowRotation: false,
};

interface AppActions {
  // UI
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setPanOffset: (offset: Point) => void;
  setShowGrid: (show: boolean) => void;
  setShowRulers: (show: boolean) => void;
  setShowImage: (show: boolean) => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;

  // Image
  importImage: (image: ScannedImage) => void;

  // Trace
  setTraceSettings: (settings: Partial<TraceSettings>) => void;
  runTrace: () => Promise<void>;

  // Paths
  setSelectedPath: (id: string | null) => void;
  setSelectedNode: (index: number | null) => void;
  updatePath: (path: VectorPath) => void;
  deletePath: (id: string) => void;
  moveNode: (pathId: string, nodeIndex: number, x: number, y: number) => void;
  addNode: (pathId: string, segmentIndex: number, t: number) => void;
  deleteNode: (pathId: string, nodeIndex: number) => void;

  // Holes
  setDetectedHoles: (holes: DetectedHole[]) => void;
  applyHolePreset: (holeId: string, presetId: string) => void;
  addHolePreset: (preset: HolePreset) => void;
  removeHolePreset: (id: string) => void;

  // Glue Lines
  setGlueLineState: (state: GlueLineEditState | null) => void;
  addGlueLine: (glueLine: GlueLine) => void;
  removeGlueLine: (id: string) => void;

  // Text Labels
  addTextLabel: (label: TextLabel) => void;
  updateTextLabel: (label: TextLabel) => void;
  removeTextLabel: (id: string) => void;

  // Nesting
  setNestingMode: (mode: boolean) => void;
  setNestingConfig: (config: Partial<NestingConfig>) => void;
  setNestingShapes: (shapes: unknown[]) => void;

  // Ollama
  setOllamaStatus: (status: AppState['ollamaStatus']) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  pushAction: (action: UndoAction) => void;
}

interface UndoAction {
  type: string;
  undo: () => void;
  redo: () => void;
}

interface UndoState {
  stack: UndoAction[];
  index: number;
}

const useAppStore = create<AppState & AppActions>((set, get) => ({
  // ── Initial State ──
  activeTool: 'select',
  zoom: 100,
  panOffset: { x: 0, y: 0 },
  showGrid: true,
  showRulers: true,
  showImage: true,
  leftPanelOpen: true,
  rightPanelOpen: true,
  image: null,
  traceSettings: { ...DEFAULT_TRACE_SETTINGS },
  paths: [],
  selectedPathId: null,
  selectedNodeIndex: null,
  detectedHoles: [],
  holePresets: [...DEFAULT_HOLE_PRESETS],
  glueLines: [],
  textLabels: [],
  glueLineState: null,
  nestingConfig: { ...DEFAULT_NESTING_CONFIG },
  nestingMode: false,
  nestingShapes: [],
  tracing: false,
  traceError: null,
  ollamaStatus: 'disconnected',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5-vl:7b',
  canUndo: false,
  canRedo: false,

  // ── Undo/Redo State (not in AppState, stored separately) ──
  _undo: { stack: [], index: -1 } as UndoState,

  // ── UI Actions ──
  setTool: (tool) => set({ activeTool: tool }),
  setZoom: (zoom) => set({ zoom: clamp(zoom, 10, 2000) }),
  setPanOffset: (offset) => set({ panOffset: offset }),
  setShowGrid: (show) => set({ showGrid: show }),
  setShowRulers: (show) => set({ showRulers: show }),
  setShowImage: (show) => set({ showImage: show }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),

  // ── Image ──
  importImage: (image) => {
    const state = get();
    const prevImage = state.image;
    const prevPaths = state.paths;
    state.pushAction({
      type: 'import',
      undo: () => set({ image: prevImage, paths: prevPaths, selectedPathId: null }),
      redo: () => set({ image, paths: [], selectedPathId: null }),
    });
    set({ image, paths: [], selectedPathId: null, detectedHoles: [], glueLines: [], traceError: null });
    // Auto-run trace as soon as the image is imported
    setTimeout(() => { void get().runTrace(); }, 0);
  },

  // ── Trace ──
  setTraceSettings: (settings) =>
    set((s) => ({
      traceSettings: { ...s.traceSettings, ...settings },
    })),

  runTrace: async () => {
    const state = get();
    const currentImage = state.image;
    if (!currentImage || state.tracing) return;

    set({ tracing: true, traceError: null });
    try {
      const imageData = await loadImageData(currentImage.dataUrl);
      const maxDim = 1500;
      let w = imageData.width;
      let h = imageData.height;
      let scaledImageData = imageData;
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
        scaledImageData = resizeImageData(imageData, w, h);
      }
      const scaleBack = imageData.width / w;
      const effectiveDpi = currentImage.dpi / scaleBack;

      const result = await traceImage(scaledImageData, {
        targetNodes: state.traceSettings.targetNodes,
        smoothingPasses: state.traceSettings.smoothingPasses,
        dpi: effectiveDpi,
      });

      // Scale paths back to original image coordinates
      const scaledPaths: VectorPath[] = result.paths.map((p) => ({
        ...p,
        nodes: p.nodes.map((n) => ({
          ...n,
          x: n.x * scaleBack,
          y: n.y * scaleBack,
          handleIn: n.handleIn
            ? { x: n.handleIn.x * scaleBack, y: n.handleIn.y * scaleBack }
            : null,
          handleOut: n.handleOut
            ? { x: n.handleOut.x * scaleBack, y: n.handleOut.y * scaleBack }
            : null,
        })),
      }));
      const holes: DetectedHole[] = result.detectedHoles.map((h) => ({
        ...h,
        x: h.x * scaleBack,
        y: h.y * scaleBack,
      }));

      const prevPaths = state.paths;
      const prevHoles = state.detectedHoles;
      state.pushAction({
        type: 'trace',
        undo: () => set({ paths: prevPaths, detectedHoles: prevHoles }),
        redo: () => set({ paths: scaledPaths, detectedHoles: holes }),
      });

      set({
        paths: scaledPaths,
        detectedHoles: holes,
        selectedPathId: null,
        selectedNodeIndex: null,
        tracing: false,
        traceError: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ tracing: false, traceError: msg });
      console.error('Trace failed:', err);
    }
  },

  // ── Paths ──
  setSelectedPath: (id) => set({ selectedPathId: id, selectedNodeIndex: null }),
  setSelectedNode: (index) => set({ selectedNodeIndex: index }),

  updatePath: (path) =>
    set((s) => ({
      paths: s.paths.map((p) => (p.id === path.id ? path : p)),
    })),

  deletePath: (id) =>
    set((s) => ({
      paths: s.paths.filter((p) => p.id !== id),
      selectedPathId: s.selectedPathId === id ? null : s.selectedPathId,
      glueLines: s.glueLines.filter((g) => g.sourcePathId !== id),
    })),

  moveNode: (pathId, nodeIndex, x, y) =>
    set((s) => ({
      paths: s.paths.map((p) => {
        if (p.id !== pathId) return p;
        const newNodes = [...p.nodes];
        newNodes[nodeIndex] = { ...newNodes[nodeIndex], x, y };
        return { ...p, nodes: newNodes };
      }),
    })),

  addNode: (pathId, segmentIndex, t) =>
    set((s) => {
      const path = s.paths.find((p) => p.id === pathId);
      if (!path) return s;
      const i = segmentIndex % path.nodes.length;
      const j = (segmentIndex + 1) % path.nodes.length;
      const a = path.nodes[i];
      const b = path.nodes[j];
      const newNode: VectorPath['nodes'][0] = {
        id: generateId(),
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        type: 'smooth',
        handleIn: null,
        handleOut: null,
      };
      const newNodes = [...path.nodes];
      newNodes.splice(i + 1, 0, newNode);
      return {
        paths: s.paths.map((p) => (p.id === pathId ? { ...p, nodes: newNodes } : p)),
      };
    }),

  deleteNode: (pathId, nodeIndex) =>
    set((s) => ({
      paths: s.paths.map((p) => {
        if (p.id !== pathId || p.nodes.length <= 3) return p;
        const newNodes = p.nodes.filter((_, i) => i !== nodeIndex);
        return { ...p, nodes: newNodes };
      }),
      selectedNodeIndex: null,
    })),

  // ── Holes ──
  setDetectedHoles: (holes) => set({ detectedHoles: holes }),

  applyHolePreset: (holeId, presetId) =>
    set((s) => ({
      detectedHoles: s.detectedHoles.map((h) =>
        h.id === holeId ? { ...h, appliedPresetId: presetId } : h
      ),
    })),

  addHolePreset: (preset) =>
    set((s) => ({ holePresets: [...s.holePresets, preset] })),

  removeHolePreset: (id) =>
    set((s) => ({ holePresets: s.holePresets.filter((p) => p.id !== id) })),

  // ── Glue Lines ──
  setGlueLineState: (state) => set({ glueLineState: state }),

  addGlueLine: (glueLine) =>
    set((s) => ({ glueLines: [...s.glueLines, glueLine] })),

  removeGlueLine: (id) =>
    set((s) => ({ glueLines: s.glueLines.filter((g) => g.id !== id) })),

  // ── Text Labels ──
  addTextLabel: (label) =>
    set((s) => ({ textLabels: [...s.textLabels, label] })),
  updateTextLabel: (label) =>
    set((s) => ({
      textLabels: s.textLabels.map((l) => (l.id === label.id ? label : l)),
    })),
  removeTextLabel: (id) =>
    set((s) => ({ textLabels: s.textLabels.filter((l) => l.id !== id) })),

  // ── Nesting ──
  setNestingMode: (mode) => set({ nestingMode: mode }),
  setNestingConfig: (config) =>
    set((s) => ({ nestingConfig: { ...s.nestingConfig, ...config } })),
  setNestingShapes: () => {},

  // ── Ollama ──
  setOllamaStatus: (status) => set({ ollamaStatus: status }),

  // ── Undo/Redo ──
  undo: () => {
    const s = get();
    const undoState = (s as unknown as Record<string, unknown>)._undo as UndoState;
    if (undoState.index >= 0) {
      undoState.stack[undoState.index].undo();
      undoState.index--;
      set({ canUndo: undoState.index >= 0, canRedo: true } as Partial<AppState & AppActions>);
    }
  },

  redo: () => {
    const s = get();
    const undoState = (s as unknown as Record<string, unknown>)._undo as UndoState;
    if (undoState.index < undoState.stack.length - 1) {
      undoState.index++;
      undoState.stack[undoState.index].redo();
      set({ canUndo: true, canRedo: undoState.index < undoState.stack.length - 1 } as Partial<AppState & AppActions>);
    }
  },

  pushAction: (action) => {
    const s = get();
    const undoState = (s as unknown as Record<string, unknown>)._undo as UndoState;
    // Remove any redo actions
    undoState.stack = undoState.stack.slice(0, undoState.index + 1);
    // Push new action
    undoState.stack.push(action);
    undoState.index = undoState.stack.length - 1;
    // Limit stack size
    if (undoState.stack.length > 50) {
      undoState.stack = undoState.stack.slice(-50);
      undoState.index = undoState.stack.length - 1;
    }
    set({ canUndo: true, canRedo: false } as Partial<AppState & AppActions>);
  },
}));

function loadImageData(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Could not get 2D context'));
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

function resizeImageData(src: ImageData, w: number, h: number): ImageData {
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = src.width;
  srcCanvas.height = src.height;
  srcCanvas.getContext('2d')!.putImageData(src, 0, 0);
  const dstCanvas = document.createElement('canvas');
  dstCanvas.width = w;
  dstCanvas.height = h;
  const dctx = dstCanvas.getContext('2d')!;
  dctx.imageSmoothingEnabled = true;
  dctx.imageSmoothingQuality = 'high';
  dctx.drawImage(srcCanvas, 0, 0, w, h);
  return dctx.getImageData(0, 0, w, h);
}

export default useAppStore;
