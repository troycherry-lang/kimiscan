import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import { ChevronDown, ChevronRight, Check, X, Plus, Trash2 } from 'lucide-react';
import type { HolePreset, HoleShape } from '@/types';
import { generateId } from '@/lib/utils';

export default function HolePresetsSection() {
  const [expanded, setExpanded] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const detectedHoles = useAppStore((s) => s.detectedHoles);
  const holePresets = useAppStore((s) => s.holePresets);
  const paths = useAppStore((s) => s.paths);
  const applyHolePreset = useAppStore((s) => s.applyHolePreset);
  const addHolePreset = useAppStore((s) => s.addHolePreset);
  const removeHolePreset = useAppStore((s) => s.removeHolePreset);

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
                        {preset && (
                          <p className="text-[10px]" style={{ color: 'var(--accent-cyan)' }}>
                            Using: {preset.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-1">
                        {!h.appliedPresetId && (
                          <>
                            <button
                              className="w-5 h-5 flex items-center justify-center rounded"
                              style={{ background: 'rgba(34,197,94,0.15)' }}
                              onClick={() => {
                                // Auto-suggest based on circularity
                                const suggested = holePresets.find((p) =>
                                  h.circularity > 0.9
                                    ? p.shape === 'circle' && Math.abs(p.widthMm - h.widthMm) < 1
                                    : p.shape === 'oblong' && Math.abs(p.widthMm - h.widthMm) < 1
                                );
                                if (suggested) applyHolePreset(h.id, suggested.id);
                              }}
                              title="Accept suggestion"
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
