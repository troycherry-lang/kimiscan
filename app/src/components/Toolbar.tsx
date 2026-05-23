import useAppStore from '@/store/useAppStore';
import {
  FolderOpen, Save, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2,
  Hand, MousePointer2, PenTool, Minus, Play, Image, Grid3x3, Ruler, Eraser,
} from 'lucide-react';

const tools = [
  { id: 'hand' as const, icon: Hand, label: 'Pan', key: 'H' },
  { id: 'select' as const, icon: MousePointer2, label: 'Select', key: 'V' },
  { id: 'node' as const, icon: PenTool, label: 'Node', key: 'A' },
  { id: 'glue' as const, icon: Minus, label: 'Glue', key: 'G' },
  { id: 'eraser' as const, icon: Eraser, label: 'Eraser', key: 'E' },
];

export default function Toolbar() {
  const activeTool = useAppStore((s) => s.activeTool);
  const setTool = useAppStore((s) => s.setTool);
  const zoom = useAppStore((s) => s.zoom);
  const setZoom = useAppStore((s) => s.setZoom);
  const runTrace = useAppStore((s) => s.runTrace);
  const image = useAppStore((s) => s.image);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.canUndo);
  const canRedo = useAppStore((s) => s.canRedo);
  const store = useAppStore;

  return (
    <div
      className="flex items-center px-2 gap-1 select-none"
      style={{
        height: 40,
        background: 'var(--bg-toolbar)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <IconBtn icon={FolderOpen} title="Import" onClick={() => document.querySelector<HTMLInputElement>('input[type=file]')?.click()} />
      <IconBtn icon={Save} title="Save" disabled />
      <div className="w-px h-5 mx-1" style={{ background: 'var(--border-default)' }} />
      <IconBtn icon={Undo2} title="Undo" onClick={undo} disabled={!canUndo} />
      <IconBtn icon={Redo2} title="Redo" onClick={redo} disabled={!canRedo} />
      <div className="w-px h-5 mx-1" style={{ background: 'var(--border-default)' }} />
      <IconBtn icon={ZoomIn} title="Zoom In" onClick={() => setZoom(zoom * 1.25)} />
      <IconBtn icon={ZoomOut} title="Zoom Out" onClick={() => setZoom(zoom / 1.25)} />
      <IconBtn icon={Maximize2} title="Fit" onClick={() => setZoom(100)} />
      <div className="w-px h-5 mx-1" style={{ background: 'var(--border-default)' }} />

      {tools.map((t) => (
        <button
          key={t.id}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all"
          style={{
            background: activeTool === t.id ? 'var(--accent-coral)' : 'transparent',
            color: activeTool === t.id ? '#fff' : 'var(--text-secondary)',
          }}
          onClick={() => setTool(t.id)}
          title={`${t.label} (${t.key})`}
        >
          <t.icon size={15} />
          <span>{t.label}</span>
        </button>
      ))}

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <IconBtn icon={Image} title="Toggle Image" onClick={() => store.getState().setShowImage(!store.getState().showImage)} />
        <IconBtn icon={Grid3x3} title="Toggle Grid" onClick={() => store.getState().setShowGrid(!store.getState().showGrid)} />
        <IconBtn icon={Ruler} title="Toggle Rulers" onClick={() => store.getState().setShowRulers(!store.getState().showRulers)} />
      </div>

      <div className="w-px h-5 mx-2" style={{ background: 'var(--border-default)' }} />

      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
        style={{
          background: image ? 'var(--accent-coral)' : '#3d2d28',
          color: image ? '#fff' : 'var(--text-muted)',
          opacity: image ? 1 : 0.5,
          cursor: image ? 'pointer' : 'not-allowed',
        }}
        onClick={() => image && runTrace()}
        disabled={!image}
      >
        <Play size={14} />
        <span>Trace</span>
      </button>

      <span
        className="ml-3 text-xs font-mono"
        style={{ color: 'var(--text-muted)', minWidth: 42, textAlign: 'right' }}
      >
        {Math.round(zoom)}%
      </span>
    </div>
  );
}

function IconBtn({
  icon: Icon,
  onClick,
  disabled,
  title,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      className="w-8 h-8 flex items-center justify-center rounded transition-colors"
      style={{
        background: 'transparent',
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={(e) => !disabled && ((e.currentTarget.style.background = 'var(--bg-hover)'))}
      onMouseLeave={(e) => ((e.currentTarget.style.background = 'transparent'))}
    >
      <Icon size={16} style={{ color: 'var(--text-secondary)' }} />
    </button>
  );
}
