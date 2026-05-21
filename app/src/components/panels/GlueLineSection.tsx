import { useState } from 'react';
import useAppStore from '@/store/useAppStore';
import { ChevronDown, ChevronRight, ArrowLeftRight } from 'lucide-react';
import { extractPathSegment, insetArc, polygonCentroid } from '@/lib/geometry/offsetPath';
import { mmToPx } from '@/lib/geometry/transform';
import { generateId } from '@/lib/utils';
import type { Point, PathNode, VectorPath } from '@/types';

export default function GlueLineSection() {
  const [expanded, setExpanded] = useState(true);
  const activeTool = useAppStore((s) => s.activeTool);
  const selectedPathId = useAppStore((s) => s.selectedPathId);
  const paths = useAppStore((s) => s.paths);
  const image = useAppStore((s) => s.image);
  const glueLineState = useAppStore((s) => s.glueLineState);
  const setGlueLineState = useAppStore((s) => s.setGlueLineState);
  const updatePath = useAppStore((s) => s.updatePath);

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

                const allPts: Point[] = sourcePath.nodes.map((n) => ({ x: n.x, y: n.y }));
                const arc = extractPathSegment(
                  allPts,
                  state.entryNodeIndex!,
                  state.exitNodeIndex!,
                  state.useLongSegment
                );

                const offsetPx = mmToPx(state.insetMm, image.dpi);
                const centroid = polygonCentroid(allPts);
                const insetPts = insetArc(arc, offsetPx, centroid);

                // Build the new closed contour: walk the original ring,
                // skipping the arc segment and substituting the inset arc.
                // Direction of `arc` matches extractPathSegment's traversal:
                // it starts at entry and ends at exit. We need to keep the
                // OPPOSITE arc untouched and replace this one.
                const oppositeArc = extractPathSegment(
                  allPts,
                  state.exitNodeIndex!,
                  state.entryNodeIndex!,
                  !state.useLongSegment
                );
                // oppositeArc goes exit -> entry. New ring: insetPts (entry->exit), then
                // oppositeArc minus its first/last (entry/exit duplicates) for closure.
                const ring: Point[] = [...insetPts];
                for (let i = 1; i < oppositeArc.length - 1; i++) {
                  ring.push(oppositeArc[i]);
                }

                const newNodes: PathNode[] = pointsToNodes(ring);

                const updated: VectorPath = {
                  ...sourcePath,
                  nodes: newNodes,
                };
                updatePath(updated);
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

function pointsToNodes(pts: Point[]): PathNode[] {
  const n = pts.length;
  const t = 1 / 3;
  const out: PathNode[] = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    const handleOut: Point = { x: (next.x - prev.x) * t * 0.5, y: (next.y - prev.y) * t * 0.5 };
    const handleIn: Point = { x: -handleOut.x, y: -handleOut.y };
    out.push({
      id: generateId(),
      x: cur.x,
      y: cur.y,
      type: 'smooth',
      handleIn,
      handleOut,
    });
  }
  return out;
}
