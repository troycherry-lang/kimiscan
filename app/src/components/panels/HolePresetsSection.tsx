import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import { ChevronDown, ChevronRight, Check, X, Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import type { HolePreset, HoleShape, DetectedHole } from '@/types';
import { generateId } from '@/lib/utils';
import { classifyHole } from '@/lib/ollama';

export default function HolePresetsSection() {
  const [expanded, setExpanded] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const detectedHoles = useAppStore((s) => s.detectedHoles);
  const holePresets = useAppStore((s) => s.holePresets);
  const paths = useAppStore((s) => s.paths);
  const image = useAppStore((s) => s.image);
  const ollamaStatus = useAppStore((s) => s.ollamaStatus);
  const ollamaUrl = useAppStore((s) => s.ollamaUrl);
  const ollamaModel = useAppStore((s) => s.ollamaModel);
  const applyHolePreset = useAppStore((s) => s.applyHolePreset);
  const setDetectedHoles = useAppStore((s) => s.setDetectedHoles);
  const addHolePreset = useAppStore((s) => s.addHolePreset);
  const removeHolePreset = useAppStore((s) => s.removeHolePreset);

  const runAiClassify = async (hole: DetectedHole) => {
    if (!image) return;
    setClassifyingId(hole.id);
    try {
      const croppedBase64 = await cropHoleImage(image.dataUrl, hole.x, hole.y, hole.widthMm, hole.heightMm, image.dpi);
      const result = await classifyHole({ baseUrl: ollamaUrl, model: ollamaModel }, croppedBase64);
      if (result) {
        const matched = holePresets.find((p) =>
          (result.shape === 'round' ? p.shape === 'circle' : p.shape === 'oblong') &&
          Math.abs(p.widthMm - result.widthMm) < 1.5
        );
        const updatedHoles = detectedHoles.map((h) =>
          h.id === hole.id
            ? { ...h, aiSuggestion: { presetId: matched?.id ?? '', confidence: result.confidence } }
            : h
        );
        setDetectedHoles(updatedHoles);
      }
    } finally {
      setClassifyingId(null);
    }
  };

  const classifySuggestion = (hole: DetectedHole) => {
    if (hole.aiSuggestion?.presetId) return holePresets.find((p) => p.id === hole.aiSuggestion!.presetId) ?? null;
    return holePresets.find((p) =>
      hole.circularity > 0.9
        ? p.shape === 'circle' && Math.abs(p.widthMm - hole.widthMm) < 1
        : p.shape === 'oblong' && Math.abs(p.widthMm - hole.widthMm) < 1
    ) ?? null;
  };

  return (
    <div className="border-b" style={{ borderColor: 'var(--border-default)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span>Holes & Presets</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {/* Detected Holes */}
          {detectedHoles.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] uppercase font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Detected ({detectedHoles.length})
              </p>
              <div className="space-y-1">
                {detectedHoles.map((h) => {
                  const path = paths.find((p) => p.id === h.pathId);
                  const preset = h.appliedPresetId
                    ? holePresets.find((p) => p.id === h.appliedPresetId)
                    : null;
                  return (
                    <div
                      key={h.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded text-xs"
                      style={{ background: 'var(--bg-input)' }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate" style={{ color: 'var(--text-primary)' }}>
                          {path?.name || 'Unknown'}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          {formatDim(h.widthMm)} × {formatDim(h.heightMm)}mm
                          {h.circularity > 0 && ` · circ ${h.circularity.toFixed(2)}`}
                        </p>
                        {h.aiSuggestion && !h.appliedPresetId && (
                          <p className="text-[10px]" style={{ color: '#3bbdc7' }}>
                            AI: {Math.round(h.aiSuggestion.confidence * 100)}% confident
                          </p>
                        )}
                        {preset && (
                          <p className="text-[10px]" style={{ color: 'var(--accent-cyan)' }}>
                            Using: {preset.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-1">
                        {!h.appliedPresetId && (
                          <>
                            {/* AI classify button */}
                            <button
                              className="w-5 h-5 flex items-center justify-center rounded"
                              style={{ background: 'rgba(59,189,199,0.15)' }}
                              onClick={() => runAiClassify(h)}
                              disabled={classifyingId === h.id}
                              title={ollamaStatus === 'ready' ? 'AI classify' : 'AI offline — using circularity'}
                            >
                              {classifyingId === h.id
                                ? <Loader2 size={10} style={{ color: '#3bbdc7' }} className="animate-spin" />
                                : <Sparkles size={10} style={{ color: ollamaStatus === 'ready' ? '#3bbdc7' : '#6b7280' }} />}
                            </button>
                            {/* Accept suggestion */}
                            <button
                              className="w-5 h-5 flex items-center justify-center rounded"
                              style={{ background: 'rgba(34,197,94,0.15)' }}
                              onClick={() => {
                                const suggested = classifySuggestion(h);
                                if (suggested) applyHolePreset(h.id, suggested.id);
                              }}
                              title={`Accept: ${classifySuggestion(h)?.name ?? 'no match'}`}
                            >
                              <Check size={10} style={{ color: '#22c55e' }} />
                            </button>
                            <button
                              className="w-5 h-5 flex items-center justify-center rounded"
                              style={{ background: 'rgba(239,68,68,0.15)' }}
                              onClick={() => applyHolePreset(h.id, 'reject')}
                              title="Keep traced shape"
                            >
                              <X size={10} style={{ color: '#ef4444' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Preset Library */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[10px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>
                Presets ({holePresets.length})
              </p>
              <button
                className="w-5 h-5 flex items-center justify-center rounded"
                style={{ background: 'var(--bg-hover)' }}
                onClick={() => setShowAdd(!showAdd)}
              >
                <Plus size={10} style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {showAdd && <AddPresetForm onAdd={(p) => { addHolePreset(p); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />}

            <div className="space-y-1">
              {holePresets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between px-2 py-1.5 rounded text-xs group"
                  style={{ background: 'var(--bg-input)' }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>
                    {preset.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                      {preset.shape === 'circle' ? '◯' : '▭'}
                      {preset.widthMm}×{preset.lengthMm}
                    </span>
                    <button
                      className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center rounded transition-opacity"
                      style={{ background: 'rgba(239,68,68,0.1)' }}
                      onClick={() => removeHolePreset(preset.id)}
                    >
                      <Trash2 size={10} style={{ color: '#ef4444' }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddPresetForm({
  onAdd,
  onCancel,
}: {
  onAdd: (preset: HolePreset) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [shape, setShape] = useState<HoleShape>('circle');
  const [width, setWidth] = useState(4);
  const [length, setLength] = useState(4);

  return (
    <div className="mb-2 p-2 rounded space-y-2" style={{ background: 'var(--bg-hover)' }}>
      <input
        type="text"
        placeholder="Preset name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-2 py-1 rounded text-xs"
        style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
      />
      <div className="flex items-center gap-2">
        <select
          value={shape}
          onChange={(e) => setShape(e.target.value as HoleShape)}
          className="px-2 py-1 rounded text-xs"
          style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
        >
          <option value="circle">Circle</option>
          <option value="oblong">Oblong</option>
        </select>
        <input
          type="number"
          step={0.5}
          value={width}
          onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
          placeholder="W"
          className="w-16 px-2 py-1 rounded text-xs font-mono"
          style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
        />
        {shape === 'oblong' && (
          <input
            type="number"
            step={0.5}
            value={length}
            onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
            placeholder="L"
            className="w-16 px-2 py-1 rounded text-xs font-mono"
            style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
          />
        )}
      </div>
      <div className="flex gap-1">
        <button
          className="flex-1 py-1 rounded text-xs"
          style={{ background: 'var(--accent-coral)', color: '#fff' }}
          onClick={() => onAdd({ id: generateId(), name: name || 'New Preset', shape, widthMm: width, lengthMm: shape === 'circle' ? width : length })}
        >
          Add
        </button>
        <button
          className="flex-1 py-1 rounded text-xs"
          style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function formatDim(v: number): string {
  return v.toFixed(1);
}

function cropHoleImage(
  dataUrl: string,
  cx: number,
  cy: number,
  widthMm: number,
  heightMm: number,
  dpi: number
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const pxPerMm = dpi / 25.4;
      const padMm = 3;
      const cropW = Math.max(1, Math.round((widthMm + padMm * 2) * pxPerMm));
      const cropH = Math.max(1, Math.round((heightMm + padMm * 2) * pxPerMm));
      const x = Math.max(0, Math.round(cx - cropW / 2));
      const y = Math.max(0, Math.round(cy - cropH / 2));
      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, x, y, cropW, cropH, 0, 0, cropW, cropH);
      const base64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      resolve(base64);
    };
    img.src = dataUrl;
  });
}
