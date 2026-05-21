import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { exportToSVG, downloadSVG } from '@/lib/export/svgExporter';

export default function ExportSection() {
  const [expanded, setExpanded] = useState(true);
  const image = useAppStore((s) => s.image);
  const paths = useAppStore((s) => s.paths);
  const glueLines = useAppStore((s) => s.glueLines);
  const textLabels = useAppStore((s) => s.textLabels);
  const [opts, setOpts] = useState({
    includeCut: true,
    includeMark: true,
    includeGlueLines: true,
    includeTextLabels: true,
    includeTestCut: false,
    precision: 2,
  });

  const handleExport = () => {
    if (!image) return;
    const svg = exportToSVG(paths, glueLines, textLabels, image, opts);
    const name = image.name.replace(/\.[^.]+$/, '') || 'stencil';
    downloadSVG(svg, `${name}.svg`);
  };

  return (
    <div className="border-b" style={{ borderColor: 'var(--border-default)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span>Export</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Layer Colors Info */}
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: '#1a1a1a', border: '1px solid #333' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Black = Cut</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ background: '#2563eb' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Blue = Mark/Engrave</span>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-1.5">
            <Checkbox label="Cut paths" checked={opts.includeCut} onChange={(v) => setOpts({ ...opts, includeCut: v })} />
            <Checkbox label="Glue lines" checked={opts.includeGlueLines} onChange={(v) => setOpts({ ...opts, includeGlueLines: v })} />
            <Checkbox label="Text labels" checked={opts.includeTextLabels} onChange={(v) => setOpts({ ...opts, includeTextLabels: v })} />
            <Checkbox label="Test cut square (10mm)" checked={opts.includeTestCut} onChange={(v) => setOpts({ ...opts, includeTestCut: v })} />
          </div>

          {/* Precision */}
          <div>
            <label className="text-[10px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>
              Precision
            </label>
            <select
              value={opts.precision}
              onChange={(e) => setOpts({ ...opts, precision: Number(e.target.value) })}
              className="w-full mt-0.5 px-2 py-1 rounded text-xs"
              style={{ background: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
            >
              <option value={1}>1 decimal</option>
              <option value={2}>2 decimals</option>
              <option value={3}>3 decimals</option>
            </select>
          </div>

          {/* Export Button */}
          <button
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded text-xs font-medium transition-colors"
            style={{
              background: image ? 'var(--accent-coral)' : '#3d2d28',
              color: image ? '#fff' : 'var(--text-muted)',
            }}
            disabled={!image}
            onClick={handleExport}
          >
            <Download size={14} />
            Export SVG
          </button>

          {paths.length > 0 && (
            <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
              {paths.filter((p) => p.layer === 'cut').length} cut paths
              {glueLines.length > 0 && ` · ${glueLines.length} glue lines`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        className="w-3.5 h-3.5 rounded-sm flex items-center justify-center transition-colors"
        style={{
          background: checked ? 'var(--accent-coral)' : 'var(--bg-input)',
          border: `1px solid ${checked ? 'var(--accent-coral)' : 'var(--border-default)'}`,
        }}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </label>
  );
}
