/**
 * Ollama Integration — Stub for Local Agent Completion
 * Provides health check and vision inference via localhost:11434
 * All features fall back to classical algorithms if Ollama is unavailable.
 */

import { generateId } from '@/lib/utils';

const DEFAULT_URL = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5-vl:7b';

export interface OllamaConfig {
  baseUrl: string;
  model: string;
}

export interface HoleClassification {
  shape: 'round' | 'oblong';
  widthMm: number;
  lengthMm: number;
  confidence: number;
}

export interface TextLabel {
  text: string;
  x: number; // normalized 0-1
  y: number;
}

export interface MarkerPosition {
  x: number; // normalized 0-1
  y: number;
}

// ── Health Check ──

export async function checkOllamaHealth(config: OllamaConfig): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(`${config.baseUrl}/api/tags`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}

// ── Vision Inference ──

async function ollamaGenerate(
  config: OllamaConfig,
  prompt: string,
  imageBase64?: string,
  format?: string
): Promise<string | null> {
  try {
    const body: Record<string, unknown> = {
      model: config.model,
      prompt,
      stream: false,
    };

    if (imageBase64) {
      body.images = [imageBase64];
    }

    if (format) {
      body.format = format;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);

    const resp = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error('Ollama HTTP error:', resp.status, errBody);
      return null;
    }

    const data = await resp.json();
    return data.response || null;
  } catch (err) {
    console.error('Ollama generate failed:', err);
    return null;
  }
}

// ── Prompt Templates ──

export function holeClassificationPrompt(): string {
  return `Analyze this image of a hole in a leather holster stencil. Is it: (A) a round/circular hole, or (B) an oblong/slotted hole? Estimate its dimensions in millimeters. Respond in JSON: {"shape": "round" or "oblong", "width_mm": number, "length_mm": number, "confidence": 0-1}`;
}

export function textOCRPrompt(): string {
  return `Read all handwritten text on this leather holster stencil. For each label, provide the text content and its approximate center position as normalized coordinates (0-1). Respond in JSON: {"labels": [{"text": "string", "x": 0-1, "y": 0-1}]}`;
}

export function glueMarkerPrompt(): string {
  return `Find the two small marks or notches on the edge of the main tan-colored stencil shape. These marks indicate where a glue line starts and stops. Return their approximate center positions as normalized coordinates (0-1). Respond in JSON: {"markers": [{"x": 0-1, "y": 0-1}]}`;
}

// ── Public API ──

export async function classifyHole(
  config: OllamaConfig,
  imageBase64: string
): Promise<HoleClassification | null> {
  const response = await ollamaGenerate(
    config,
    holeClassificationPrompt(),
    imageBase64,
    'json'
  );
  if (!response) return null;

  try {
    const parsed = JSON.parse(response);
    return {
      shape: parsed.shape === 'oblong' ? 'oblong' : 'round',
      widthMm: Number(parsed.width_mm) || 0,
      lengthMm: Number(parsed.length_mm) || 0,
      confidence: Number(parsed.confidence) || 0,
    };
  } catch {
    return null;
  }
}

export async function readTextLabels(
  config: OllamaConfig,
  imageBase64: string
): Promise<TextLabel[] | null> {
  const response = await ollamaGenerate(
    config,
    textOCRPrompt(),
    imageBase64,
    'json'
  );
  if (!response) return null;

  try {
    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed.labels)) return null;
    return parsed.labels.map((l: Record<string, unknown>) => ({
      id: generateId(),
      text: String(l.text || ''),
      x: Number(l.x) || 0,
      y: Number(l.y) || 0,
      fontSizeMm: 8,
      rotation: 0,
      layer: 'mark' as const,
    }));
  } catch {
    return null;
  }
}

export async function findGlueMarkers(
  config: OllamaConfig,
  imageBase64: string
): Promise<MarkerPosition[] | null> {
  const response = await ollamaGenerate(
    config,
    glueMarkerPrompt(),
    imageBase64,
    'json'
  );
  if (!response) return null;

  try {
    const parsed = JSON.parse(response);
    if (!Array.isArray(parsed.markers)) return null;
    return parsed.markers.map((m: Record<string, unknown>) => ({
      x: Number(m.x) || 0,
      y: Number(m.y) || 0,
    }));
  } catch {
    return null;
  }
}

export { DEFAULT_URL, DEFAULT_MODEL };
