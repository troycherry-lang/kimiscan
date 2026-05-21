import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import { ChevronDown, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { offsetPolygon, extractPathSegment } from '@/lib/geometry/offsetPath';
import { pxToMm, mmToPx } from '@/lib/geometry/transform';
import { generateId } from '@/lib/utils';
import type { VectorPath } from '@/types';

export default function GlueLineSection() {
  const [expanded, setExpanded] = useState(true);
  const activeTool = useAppStore((s) => s.activeTool);
  const selectedPathId = useAppStore((s) => s.selectedPathId);
  const paths = useAppStore((s) => s.paths);
  const image = useAppStore((s) => s.image);
  const glueLineState = useAppStore((s) => s.glueLineState);
  const setGlueLineState = useAppStore((s) => s.setGlueLineState);
  const addGlueLine = useAppStore((s) => s.addGlueLine);

  const selectedPath = paths.find((p) => p.id === selectedPathId);
  const isGlueMode = activeTool === 'glue';

  // If glue line state exists, show the editing UI
  if (glueLineState) {
    const state = glueLineState;
    const sourcePath = paths.find((p) => p.id === state.sourcePathId);
    if (!sourcePath || !image) return null;

    const canApply = state.entryNodeIndex !== null && state.exitNodeIndex !== null;

    return (
      <div className="border-b" style={{ borderColor: 'var(--border-default)' }}>
        <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--accent-cyan)' }}>
          Glue Line
        </div>
        <div className="px-3 pb-3 space-y-2">
          {/* Status */}
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {state.entryNodeIndex === null
              ? 'Click entry point on contour'
              : state.exitNodeIndex === null
              ? 'Click exit point on contour'
              : 'Adjust and apply'}
          </p>

          {/* Entry/Exit info */}
          {state.entryNodeIndex !== null && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              Entry: Node #{state.entryNodeIndex + 1}
            </div>
          )}
          {state.exitNodeIndex !== null && (
            <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
              Exit: Node #{state.exitNodeIndex + 1}
            </div>
          )}

          {/* Flip */}
          {canApply && (
            <button
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded text-xs transition-colors"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-secondary)' }}
              onClick={() => setGlueLineState({ ...state, useLongSegment: !state.useLongSegment })}
            >
              <ArrowLeftRight size={12} />
              Flip Segment
            </button>
          )}

          {/* Inset */}
          {canApply && (
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Inset</span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>
                  {state.insetMm.toFixed(1)}mm
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={15}
                step={0.5}
                value={state.insetMm}
                onChange={(e) => {
                  const insetMm = parseFloat(e.target.value);
                  setGlueLineState({ ...state, insetMm });
                }}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-1 pt-1">
            <button
              className="flex-1 py-1.5 rounded text-xs font-medium transition-colors"
              style={{
                background: canApply ? 'var(--accent-coral)' : '#3d2d28',
                color: canApply ? '#fff' : 'var(--text-muted)',
              }}
              disabled={!canApply}
              onClick={() => {
                if (!canApply || !sourcePath || !image) return;

                const nodes = sourcePath.nodes.map((n) => ({ x: n.x, y: n.y }));
                const segment = extractPathSegment(
                  nodes,
                  state.entryNodeIndex!,
                  state.exitNodeIndex!,
                  state.useLongSegment
                );

                const offsetPx = mmToPx(state.insetMm, image.dpi);
                const offsetPoints = offsetPolygon(segment, offsetPx);

                if (!offsetPoints) {
                  alert('Offset would self-intersect. Try a smaller inset or bevel corners.');
                  return;
                }

                const gluePath: VectorPath = {
                  id: generateId(),
                  name: `Glue Line ${useAppStore.getState().glueLines.length + 1}`,
                  nodes: offsetPoints.map((p) => ({
                    id: generateId(),
                    x: p.x,
                    y: p.y,
                    type: 'corner' as const,
                  })),
                  closed: false,
                  layer: 'mark',
                  type: 'glue',
                  lengthMm: pxToMm(
                    offsetPoints.reduce((len, p, i) => {
                      if (i === 0) return 0;
                      const dx = p.x - offsetPoints[i - 1].x;
                      const dy = p.y - offsetPoints[i - 1].y;
                      return len + Math.sqrt(dx * dx + dy * dy);
                    }, 0),
                    image.dpi
                  ),
                };

                addGlueLine({
                  id: generateId(),
                  sourcePathId: sourcePath.id,
                  entryNodeIndex: state.entryNodeIndex!,
                  exitNodeIndex: state.exitNodeIndex!,
                  useLongSegment: state.useLongSegment,
                  insetMm: state.insetMm,
                  path: gluePath,
                });

                setGlueLineState(null);
              }}
            >
              Apply
            </button>
            <button
              className="flex-1 py-1.5 rounded text-xs"
              style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}
              onClick={() => setGlueLineState(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Default state — show activation UI
  return (
    <div className="border-b" style={{ borderColor: 'var(--border-default)' }}>
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
        onClick={() => setExpanded(!expanded)}
      >
        <span>Glue Line</span>
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          {!selectedPath ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Select a contour path first
            </p>
          ) : !isGlueMode ? (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Selected: {selectedPath.name}
              </p>
              <button
                className="w-full py-1.5 rounded text-xs font-medium transition-colors"
                style={{ background: 'var(--accent-coral)', color: '#fff' }}
                onClick={() => {
                  useAppStore.getState().setTool('glue');
                  setGlueLineState({
                    sourcePathId: selectedPath.id,
                    entryNodeIndex: null,
                    exitNodeIndex: null,
                    useLongSegment: false,
                    insetMm: 5,
                    previewPath: null,
                  });
                }}
              >
                Start Glue Line (G)
              </button>
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--accent-cyan)' }}>
              Click entry point on the selected contour
            </p>
          )}
        </div>
      )}
    </div>
  );
}
