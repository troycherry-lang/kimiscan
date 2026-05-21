import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import { pxToMm, formatMm } from '@/lib/geometry/transform';

export default function PathInfoSection() {
  const [expanded, setExpanded] = useState(true);
  const selectedPathId = useAppStore((s) => s.selectedPathId);
  const paths = useAppStore((s) => s.paths);
  const image = useAppStore((s) => s.image);
  const updatePath = useAppStore((s) => s.updatePath);
  const deletePath = useAppStore((s) => s.deletePath);
  const moveNode = useAppStore((s) => s.moveNode);
  const selectedNodeIndex = useAppStore((s) => s.selectedNodeIndex);

  const path = paths.find((p) => p.id === selectedPathId);

  if (!path) {
    return (
      <div className="px-3 py-3 text-center border-b" style={{ borderColor: 'var(--border-default)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Select a path to view details
        </p>
      </div>
    );
  }

  const selectedNode = selectedNodeIndex !== null ? path.nodes[selectedNodeIndex] : null;

  return (
    <div className="border-b" style={{ borderColor: 'var(--border-default)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span>Path Info</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Path Name */}
          <div>
            <label className="text-[10px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>
              Name
            </label>
            <input
              type="text"
              value={path.name}
              onChange={(e) => updatePath({ ...path, name: e.target.value })}
              className="w-full mt-0.5 px-2 py-1 rounded text-xs"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Nodes" value={String(path.nodes.length)} />
            <Stat label="Length" value={`${formatMm(path.lengthMm)}mm`} />
            {path.circularity !== undefined && (
              <Stat label="Circularity" value={path.circularity.toFixed(3)} />
            )}
            <Stat label="Type" value={path.closed ? 'Closed' : 'Open'} />
          </div>

          {/* Layer */}
          <div>
            <label className="text-[10px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>
              Layer
            </label>
            <select
              value={path.layer}
              onChange={(e) => updatePath({ ...path, layer: e.target.value as 'cut' | 'mark' })}
              className="w-full mt-0.5 px-2 py-1 rounded text-xs"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            >
              <option value="cut">Cut (Black)</option>
              <option value="mark">Mark (Blue)</option>
            </select>
          </div>

          {/* Selected Node */}
          {selectedNode && image && (
            <div className="pt-1 border-t" style={{ borderColor: 'var(--border-default)' }}>
              <p className="text-[10px] uppercase font-medium mb-1" style={{ color: 'var(--accent-coral)' }}>
                Node #{selectedNodeIndex! + 1}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>X (mm)</label>
                  <input
                    type="number"
                    step={0.01}
                    value={formatMm(pxToMm(selectedNode.x, image.dpi))}
                    onChange={(e) => {
                      const mm = parseFloat(e.target.value) || 0;
                      const px = (mm / 25.4) * image.dpi;
                      moveNode(path.id, selectedNodeIndex!, px, selectedNode.y);
                    }}
                    className="w-full px-2 py-1 rounded text-xs font-mono"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                  />
                </div>
                <div>
                  <label className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Y (mm)</label>
                  <input
                    type="number"
                    step={0.01}
                    value={formatMm(pxToMm(selectedNode.y, image.dpi))}
                    onChange={(e) => {
                      const mm = parseFloat(e.target.value) || 0;
                      const px = (mm / 25.4) * image.dpi;
                      moveNode(path.id, selectedNodeIndex!, selectedNode.x, px);
                    }}
                    className="w-full px-2 py-1 rounded text-xs font-mono"
                    style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Delete */}
          <button
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
            onClick={() => {
              if (confirm('Delete this path?')) deletePath(path.id);
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
          >
            <Trash2 size={12} />
            Delete Path
          </button>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
