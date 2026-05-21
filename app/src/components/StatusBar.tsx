import useAppStore from '@/store/useAppStore';

export default function StatusBar() {
  const image = useAppStore((s) => s.image);
  const zoom = useAppStore((s) => s.zoom);
  const paths = useAppStore((s) => s.paths);
  const glueLines = useAppStore((s) => s.glueLines);
  const ollamaStatus = useAppStore((s) => s.ollamaStatus);

  return (
    <div
      className="flex items-center px-3 text-[11px] select-none"
      style={{
        height: 26,
        background: 'var(--bg-toolbar)',
        borderTop: '1px solid var(--border-default)',
        color: 'var(--text-muted)',
      }}
    >
      {/* Coordinates */}
      <span className="font-mono mr-4">x: ---  y: ---</span>

      {/* Zoom */}
      <span className="mr-4">Zoom: {Math.round(zoom)}%</span>

      {/* Image info */}
      {image && (
        <span className="mr-4">
          {image.width}×{image.height}px @ {image.dpi} DPI
        </span>
      )}

      {/* Path count */}
      <span className="mr-4">
        {paths.length} paths
        {glueLines.length > 0 && ` · ${glueLines.length} glue lines`}
      </span>

      <div className="flex-1" />

      {/* Ollama status */}
      <div className="flex items-center gap-1.5">
        <div
          className="w-2 h-2 rounded-full"
          style={{
            background: ollamaStatus === 'ready'
              ? '#22c55e'
              : ollamaStatus === 'error'
              ? '#ef4444'
              : ollamaStatus === 'connecting'
              ? '#f59e0b'
              : '#6b7280',
          }}
        />
        <span>
          {ollamaStatus === 'ready'
            ? 'AI Ready'
            : ollamaStatus === 'error'
            ? 'AI Error'
            : ollamaStatus === 'connecting'
            ? 'AI Connecting…'
            : 'AI Offline'}
        </span>
      </div>
    </div>
  );
}
