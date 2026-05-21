import MenuBar from '@/components/MenuBar';
import Toolbar from '@/components/Toolbar';
import LeftPanel from '@/components/LeftPanel';
import RightPanel from '@/components/RightPanel';
import Canvas from '@/components/canvas/Canvas';
import StatusBar from '@/components/StatusBar';
import useAppStore from '@/store/useAppStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

function App() {
  const image = useAppStore((s) => s.image);
  useKeyboardShortcuts();

  return (
    <div
      className="flex flex-col w-full h-full"
      style={{ background: 'var(--bg-app)' }}
    >
      <MenuBar />
      <Toolbar />
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel />
        <div className="flex-1 relative overflow-hidden">
          {!image && <EmptyState />}
          <Canvas />
        </div>
        <RightPanel />
      </div>
      <StatusBar />
    </div>
  );
}

function EmptyState() {
  const importImage = useAppStore((s) => s.importImage);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        importImage({
          width: img.width,
          height: img.height,
          dpi: 300,
          dataUrl: e.target?.result as string,
          name: file.name,
        });
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) handleFile(file);
  };

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-10"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <div className="text-center p-12 border-2 border-dashed rounded-lg"
        style={{
          borderColor: 'var(--border-default)',
          background: 'var(--bg-canvas)',
        }}
      >
        <svg
          width="64"
          height="64"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.5"
          className="mx-auto mb-4"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <p style={{ color: 'var(--text-primary)', fontSize: 15, fontWeight: 500 }}>
          Drop a scanned image here
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>
          or{' '}
          <label
            className="cursor-pointer underline hover:no-underline"
            style={{ color: 'var(--accent-coral)' }}
          >
            click to browse
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        </p>
        <p style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 16 }}>
          Supports PNG, JPG, BMP, TIFF
        </p>
      </div>
    </div>
  );
}

export default App;
