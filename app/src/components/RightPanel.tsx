import useAppStore from '@/store/useAppStore';
import TraceSettingsSection from './panels/TraceSettingsSection';
import PathInfoSection from './panels/PathInfoSection';
import HolePresetsSection from './panels/HolePresetsSection';
import GlueLineSection from './panels/GlueLineSection';
import ExportSection from './panels/ExportSection';
import { ChevronRight } from 'lucide-react';

export default function RightPanel() {
  const open = useAppStore((s) => s.rightPanelOpen);

  if (!open) {
    return (
      <button
        className="w-8 flex items-center justify-center border-l"
        style={{ background: 'var(--bg-panel)', borderColor: 'var(--border-default)' }}
        onClick={() => useAppStore.getState().toggleRightPanel()}
      >
        <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
      </button>
    );
  }

  return (
    <div
      className="flex flex-col border-l overflow-y-auto"
      style={{
        width: 280,
        minWidth: 280,
        background: 'var(--bg-panel)',
        borderColor: 'var(--border-default)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b cursor-pointer"
        style={{ borderColor: 'var(--border-default)' }}
        onClick={() => useAppStore.getState().toggleRightPanel()}
      >
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-muted)' }}
        >
          Properties
        </span>
      </div>

      <TraceSettingsSection />
      <PathInfoSection />
      <HolePresetsSection />
      <GlueLineSection />
      <ExportSection />
    </div>
  );
}
