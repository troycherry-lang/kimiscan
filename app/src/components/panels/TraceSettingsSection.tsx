import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import { ChevronDown, ChevronRight, RotateCcw, ScanText, Loader2 } from 'lucide-react';
import { readTextLabels } from '@/lib/ollama';
import { generateId } from '@/lib/utils';

export default function TraceSettingsSection() {
  const [expanded, setExpanded] = useState(true);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const image = useAppStore((s) => s.image);
  const settings = useAppStore((s) => s.traceSettings);
  const setSettings = useAppStore((s) => s.setTraceSettings);
  const runTrace = useAppStore((s) => s.runTrace);
  const ollamaUrl = useAppStore((s) => s.ollamaUrl);
  const ollamaModel = useAppStore((s) => s.ollamaModel);
  const ollamaStatus = useAppStore((s) => s.ollamaStatus);
  const addTextLabel = useAppStore((s) => s.addTextLabel);

  const runOcr = async () => {
    if (!image) return;
    setOcrRunning(true);
    setOcrMessage(null);
    try {
      const base64 = image.dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
      const labels = await readTextLabels({ baseUrl: ollamaUrl, model: ollamaModel }, base64);
      if (labels && labels.length > 0) {
        labels.forEach((l) => {
          addTextLabel({
            id: generateId(),
            text: l.text,
            x: l.x * image.width,
            y: l.y * image.height,
            fontSizeMm: 3,
            rotation: 0,
            layer: 'mark',
          });
        });
        setOcrMessage(`Found ${labels.length} label${labels.length !== 1 ? 's' : ''}`);
      } else {
        setOcrMessage('No labels found');
      }
    } catch {
      setOcrMessage('OCR failed');
    } finally {
      setOcrRunning(false);
    }
  };

  if (!image) {
    return (
      <div className="px-3 py-4 text-center">
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Import an image to configure trace settings
        </p>
      </div>
    );
  }

  return (
    <div className="border-b" style={{ borderColor: 'var(--border-default)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span>Trace Settings</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Threshold */}
          <ControlRow
            label="Threshold"
            value={settings.threshold < 0 ? 'Auto' : String(settings.threshold)}
          >
            <input
              type="range"
              min={-1}
              max={255}
              value={settings.threshold}
              onChange={(e) => setSettings({ threshold: Number(e.target.value) })}
            />
          </ControlRow>

          {/* Smooth / Blur */}
          <ControlRow label="Smooth" value={`${settings.blur}px`}>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={settings.blur}
              onChange={(e) => setSettings({ blur: Number(e.target.value) })}
            />
          </ControlRow>

          {/* Corner Threshold */}
          <ControlRow label="Corners" value={`${settings.cornerThreshold}°`}>
            <input
              type="range"
              min={60}
              max={150}
              value={settings.cornerThreshold}
              onChange={(e) => setSettings({ cornerThreshold: Number(e.target.value) })}
            />
          </ControlRow>

          {/* Min Path Size */}
          <ControlRow label="Min Size" value={`${settings.minPathSize}mm²`}>
            <input
              type="range"
              min={1}
              max={200}
              step={1}
              value={settings.minPathSize}
              onChange={(e) => setSettings({ minPathSize: Number(e.target.value) })}
            />
          </ControlRow>

          {/* Invert */}
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Invert</span>
            <button
              className="w-8 h-4 rounded-full transition-colors relative"
              style={{
                background: settings.invert ? 'var(--accent-coral)' : 'var(--border-default)',
              }}
              onClick={() => setSettings({ invert: !settings.invert })}
            >
              <div
                className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                style={{ left: settings.invert ? 18 : 2 }}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <button
              className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
              style={{ background: 'var(--accent-coral)', color: '#fff' }}
              onClick={runTrace}
            >
              Trace Image
            </button>
            <button
              className="w-8 h-8 flex items-center justify-center rounded transition-colors"
              style={{ background: 'var(--bg-input)' }}
              onClick={() => setSettings({
                threshold: -1, blur: 1, cornerThreshold: 120, minPathSize: 10, invert: false,
              })}
              title="Reset to defaults"
            >
              <RotateCcw size={12} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>

          {/* AI Read Labels */}
          <button
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-colors"
            style={{
              background: ollamaStatus === 'ready' ? 'rgba(59,189,199,0.15)' : 'var(--bg-input)',
              color: ollamaStatus === 'ready' ? '#3bbdc7' : 'var(--text-muted)',
              border: '1px solid',
              borderColor: ollamaStatus === 'ready' ? '#3bbdc7' : 'var(--border-default)',
            }}
            disabled={ocrRunning || ollamaStatus !== 'ready'}
            onClick={runOcr}
            title={ollamaStatus !== 'ready' ? 'Ollama offline' : 'AI reads handwritten text from scan'}
          >
            {ocrRunning
              ? <Loader2 size={12} className="animate-spin" />
              : <ScanText size={12} />}
            {ocrRunning ? 'Reading labels…' : 'AI Read Labels'}
          </button>
          {ocrMessage && (
            <p className="text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
              {ocrMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function ControlRow({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{value}</span>
      </div>
      {children}
    </div>
  );
}
