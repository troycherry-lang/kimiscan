/**
 * StencilForge — Type Definitions
 * All core types for the leather holster stencil vectorizer
 */

// ── Geometry Primitives ──

export interface Point {
  x: number;
  y: number;
}

export interface PointMM {
  xMm: number;
  yMm: number;
}

// ── Vector Paths ──

export type NodeType = 'corner' | 'smooth' | 'auto-smooth';

export interface PathNode extends Point {
  id: string;
  type: NodeType;
  handleIn?: Point | null; // relative to node position
  handleOut?: Point | null;
}

export type PathLayer = 'cut' | 'mark';

export interface VectorPath {
  id: string;
  name: string;
  nodes: PathNode[];
  closed: boolean;
  layer: PathLayer;
  // Metadata
  type: 'outer' | 'hole' | 'glue' | 'text';
  lengthMm: number;
  areaMm2?: number;
  circularity?: number;
}

// ── Holes ──

export type HoleShape = 'circle' | 'oblong';

export interface HolePreset {
  id: string;
  name: string;
  shape: HoleShape;
  widthMm: number;
  lengthMm: number; // same as width for circles
}

export interface DetectedHole {
  id: string;
  pathId: string; // reference to the traced hole path
  x: number;
  y: number; // center position (px)
  widthMm: number;
  heightMm: number;
  circularity: number;
  aspectRatio: number;
  aiSuggestion?: {
    presetId: string;
    confidence: number;
  };
  appliedPresetId?: string;
}

// ── Glue Lines ──

export interface GlueLine {
  id: string;
  sourcePathId: string; // the outer contour this glue line is derived from
  entryNodeIndex: number;
  exitNodeIndex: number;
  useLongSegment: boolean; // if true, use the longer path between entry/exit
  insetMm: number;
  path: VectorPath; // the actual offset path
}

// ── Text Labels ──

export interface TextLabel {
  id: string;
  text: string;
  x: number;
  y: number; // position (px)
  fontSizeMm: number;
  rotation: number;
  layer: PathLayer;
}

// ── Nesting ──

export interface NestingConfig {
  bedWidthMm: number;
  bedHeightMm: number;
  spacingMm: number;
  allowRotation: boolean;
}

// ── Image / Scan ──

export interface ScannedImage {
  width: number;
  height: number;
  dpi: number;
  dataUrl: string; // base64
  name: string;
}

// ── Trace Settings ──

export interface TraceSettings {
  detail: number;   // 10-60 — bezier tolerance (60=tightest, 10=loosest)
  smoothing: number; // 0-3 — extra Gaussian smoothing passes
}

// ── App State ──

export type Tool = 'select' | 'hand' | 'node' | 'glue';

export interface ExportOptions {
  includeCut: boolean;
  includeMark: boolean;
  includeGlueLines: boolean;
  includeTextLabels: boolean;
  includeTestCut: boolean;
  precision: number; // decimal places
}

export interface GlueLineEditState {
  sourcePathId: string;
  entryNodeIndex: number | null;
  exitNodeIndex: number | null;
  useLongSegment: boolean;
  insetMm: number;
  previewPath: VectorPath | null;
}

export interface AppState {
  // UI State
  activeTool: Tool;
  zoom: number; // percentage 10-2000
  panOffset: Point;
  showGrid: boolean;
  showRulers: boolean;
  showImage: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;

  // Data
  image: ScannedImage | null;
  traceSettings: TraceSettings;
  paths: VectorPath[];
  selectedPathId: string | null;
  selectedNodeIndex: number | null;
  detectedHoles: DetectedHole[];
  holePresets: HolePreset[];
  glueLines: GlueLine[];
  textLabels: TextLabel[];
  glueLineState: GlueLineEditState | null;

  // Nesting
  nestingConfig: NestingConfig;
  nestingMode: boolean;

  // Trace runtime status
  tracing: boolean;
  traceError: string | null;

  // Ollama
  ollamaStatus: 'disconnected' | 'connecting' | 'ready' | 'error';
  ollamaUrl: string;
  ollamaModel: string;

  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
}

// ── Project File ──

export interface ProjectFile {
  version: string;
  project: {
    name: string;
    created: string;
    modified: string;
  };
  image: {
    width: number;
    height: number;
    dpi: number;
    data: string; // base64
  } | null;
  traceSettings: TraceSettings;
  paths: VectorPath[];
  detectedHoles: DetectedHole[];
  holePresets: HolePreset[];
  glueLines: GlueLine[];
  textLabels: TextLabel[];
  exportOptions: ExportOptions;
}
