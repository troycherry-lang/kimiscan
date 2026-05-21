import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import {
  Hand, MousePointer2, PenTool, Minus, ChevronDown, ChevronRight,
  Eye, EyeOff, Layers, Circle, Square,
} from 'lucide-react';

export default function LeftPanel() {
  const open = useAppStore((s) => s.leftPanelOpen);

  if (!open) {
    return (
      <button
        className="w-8 flex items-center justify-center border-r"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-default)' }}
        onClick={() => useAppStore.getState().toggleLeftPanel()}
      >
        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
      </button>
    );
  }

  return (
    <div
      className="flex flex-col border-r overflow-y-auto"
      style={{
        width: 260,
        minWidth: 260,
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b cursor-pointer"
        style={{ borderColor: 'var(--border-default)' }}
        onClick={() => useAppStore.getState().toggleLeftPanel()}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Panels
        </span>
        <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
      </div>

      <ToolsSection />
      <LayersSection />
    </div>
  );
}

function ToolsSection() {
  const [expanded, setExpanded] = useState(true);
  const activeTool = useAppStore((s) => s.activeTool);
  const setTool = useAppStore((s) => s.setTool);

  const toolList = [
    { id: 'select' as const, icon: MousePointer2, label: 'Select', key: 'V' },
    { id: 'hand' as const, icon: Hand, label: 'Hand / Pan', key: 'H' },
    { id: 'node' as const, icon: PenTool, label: 'Node Edit', key: 'A' },
    { id: 'glue' as const, icon: Minus, label: 'Glue Line', key: 'G' },
  ];

  return (
    <div className="border-b" style={{ borderColor: 'var(--border-default)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span>Tools</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-0.5">
          {toolList.map((t) => (
            <button
              key={t.id}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors"
              style={{
                background: activeTool === t.id ? 'var(--accent-coral)' : 'transparent',
                color: activeTool === t.id ? '#fff' : 'var(--text-primary)',
              }}
              onClick={() => setTool(t.id)}
              onMouseEnter={(e) => activeTool !== t.id && (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={(e) => activeTool !== t.id && (e.currentTarget.style.background = 'transparent')}
            >
              <span className="flex items-center gap-2">
                <t.icon size={14} />
                {t.label}
              </span>
              <span style={{ color: activeTool === t.id ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>
                {t.key}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LayersSection() {
  const [expanded, setExpanded] = useState(true);
  const paths = useAppStore((s) => s.paths);
  const glueLines = useAppStore((s) => s.glueLines);
  const textLabels = useAppStore((s) => s.textLabels);
  const showImage = useAppStore((s) => s.showImage);
  const setShowImage = useAppStore((s) => s.setShowImage);
  const selectedPathId = useAppStore((s) => s.selectedPathId);
  const setSelectedPath = useAppStore((s) => s.setSelectedPath);

  const cutPaths = paths.filter((p) => p.layer === 'cut');

  return (
    <div className="border-b" style={{ borderColor: 'var(--border-default)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span className="flex items-center gap-1.5">
          <Layers size={12} />
          Layers
        </span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-0.5">
          {/* Image Layer */}
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded text-xs">
            <span className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <Eye size={13} />
              Raster Image
            </span>
            <button onClick={() => setShowImage(!showImage)}>
              {showImage ? <Eye size={13} /> : <EyeOff size={13} style={{ color: 'var(--text-muted)' }} />}
            </button>
          </div>

          {/* Cut Layer */}
          <div className="px-2.5 py-1">
            <span className="text-[10px] uppercase font-medium" style={{ color: 'var(--text-muted)' }}>
              Cut ({cutPaths.length} paths)
            </span>
            {cutPaths.map((p) => (
              <button
                key={p.id}
                className="w-full flex items-center gap-2 px-2 py-1 mt-0.5 rounded text-xs transition-colors"
                style={{
                  background: selectedPathId === p.id ? 'var(--bg-selected)' : 'transparent',
                  color: 'var(--text-primary)',
                }}
                onClick={() => setSelectedPath(p.id)}
              >
                {p.type === 'hole' ? <Circle size={10} /> : <Square size={10} />}
                <span className="truncate flex-1 text-left">{p.name}</span>
                <span className="font-mono text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  {p.nodes.length}n
                </span>
              </button>
            ))}
          </div>

          {/* Glue Lines Layer */}
          {glueLines.length > 0 && (
            <div className="px-2.5 py-1">
              <span className="text-[10px] uppercase font-medium" style={{ color: 'var(--accent-cyan)' }}>
                Glue Lines ({glueLines.length})
              </span>
            </div>
          )}

          {/* Text Labels Layer */}
          {textLabels.length > 0 && (
            <div className="px-2.5 py-1">
              <span className="text-[10px] uppercase font-medium" style={{ color: 'var(--color-mark)' }}>
                Labels ({textLabels.length})
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
