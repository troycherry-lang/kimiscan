import { useState, useRef, useEffect } from 'react';
import useAppStore from '@/store/useAppStore';
import { exportToSVG, downloadSVG } from '@/lib/export/svgExporter';

interface MenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
}

interface MenuDef {
  label: string;
  items: MenuItem[];
}

export default function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<number | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const image = useAppStore((s) => s.image);
  const paths = useAppStore((s) => s.paths);
  const glueLines = useAppStore((s) => s.glueLines);
  const textLabels = useAppStore((s) => s.textLabels);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.canUndo);
  const canRedo = useAppStore((s) => s.canRedo);
  const runTrace = useAppStore((s) => s.runTrace);
  const importImage = useAppStore((s) => s.importImage);
  const setShowGrid = useAppStore((s) => s.setShowGrid);
  const setShowRulers = useAppStore((s) => s.setShowRulers);
  const showGrid = useAppStore((s) => s.showGrid);
  const showRulers = useAppStore((s) => s.showRulers);
  const showImage = useAppStore((s) => s.showImage);
  const setShowImage = useAppStore((s) => s.setShowImage);
  const setZoom = useAppStore((s) => s.setZoom);

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          importImage({
            width: img.width,
            height: img.height,
            dpi: 300,
            dataUrl: ev.target?.result as string,
            name: file.name,
          });
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleExport = () => {
    if (!image) return;
    const svg = exportToSVG(paths, glueLines, textLabels, image, {
      includeCut: true,
      includeMark: true,
      includeGlueLines: true,
      includeTextLabels: true,
      includeTestCut: false,
      precision: 2,
    });
    const name = image.name.replace(/\.[^.]+$/, '') || 'stencil';
    downloadSVG(svg, `${name}.svg`);
  };

  const menus: MenuDef[] = [
    {
      label: 'File',
      items: [
        { label: 'Import Image...', action: handleImport, shortcut: 'Ctrl+O' },
        { label: 'Export SVG...', action: handleExport, shortcut: 'Ctrl+Shift+E', disabled: !image },
        { separator: true } as MenuItem,
        { label: 'Exit', action: () => {} },
      ],
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', action: undo, shortcut: 'Ctrl+Z', disabled: !canUndo },
        { label: 'Redo', action: redo, shortcut: 'Ctrl+Y', disabled: !canRedo },
      ],
    },
    {
      label: 'View',
      items: [
        { label: 'Zoom to Fit', action: () => setZoom(100), shortcut: 'Ctrl+0' },
        { separator: true } as MenuItem,
        { label: `${showGrid ? 'Hide' : 'Show'} Grid`, action: () => setShowGrid(!showGrid) },
        { label: `${showRulers ? 'Hide' : 'Show'} Rulers`, action: () => setShowRulers(!showRulers) },
        { label: `${showImage ? 'Hide' : 'Show'} Image`, action: () => setShowImage(!showImage) },
      ],
    },
    {
      label: 'Trace',
      items: [
        { label: 'Run Trace', action: runTrace, shortcut: 'Ctrl+T', disabled: !image },
        { label: 'Retrace', action: runTrace, disabled: !image },
      ],
    },
    {
      label: 'Help',
      items: [
        { label: 'About StencilForge', action: () => alert('StencilForge v1.0\nLeather Holster Stencil Vectorizer') },
        { label: 'Keyboard Shortcuts', action: () => {} },
      ],
    },
  ];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      ref={barRef}
      className="flex items-center px-2 select-none"
      style={{
        height: 36,
        background: 'var(--bg-toolbar)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <span
        className="text-xs font-semibold mr-4 px-2"
        style={{ color: 'var(--accent-coral)' }}
      >
        StencilForge
      </span>
      {menus.map((menu, i) => (
        <div key={i} className="relative">
          <button
            className="px-3 py-1 text-xs rounded transition-colors"
            style={{
              color: activeMenu === i ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: activeMenu === i ? 'var(--bg-hover)' : 'transparent',
            }}
            onClick={() => setActiveMenu(activeMenu === i ? null : i)}
            onMouseEnter={() => activeMenu !== null && setActiveMenu(i)}
          >
            {menu.label}
          </button>
          {activeMenu === i && (
            <div
              className="absolute top-full left-0 py-1 rounded z-50 min-w-[180px]"
              style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-default)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              }}
            >
              {menu.items.map((item, j) =>
                item.separator ? (
                  <div
                    key={j}
                    className="my-1 mx-2"
                    style={{ height: 1, background: 'var(--border-default)' }}
                  />
                ) : (
                  <button
                    key={j}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors disabled:opacity-30"
                    style={{
                      color: item.disabled
                        ? 'var(--text-muted)'
                        : 'var(--text-primary)',
                    }}
                    onMouseEnter={(e) => {
                      if (!item.disabled) (e.target as HTMLElement).style.background = 'var(--bg-hover)';
                    }}
                    onMouseLeave={(e) => {
                      (e.target as HTMLElement).style.background = 'transparent';
                    }}
                    disabled={item.disabled}
                    onClick={() => {
                      if (!item.disabled && item.action) {
                        item.action();
                        setActiveMenu(null);
                      }
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span
                        className="ml-4 text-[10px] font-mono"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
