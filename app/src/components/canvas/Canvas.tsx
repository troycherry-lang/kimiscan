import { useRef, useEffect, useCallback } from 'react';
import useAppStore from '@/store/useAppStore';
import { clamp } from '@/lib/utils';
import { dist } from '@/lib/geometry/distance';
import { extractPathSegment } from '@/lib/geometry/offsetPath';
import type { Point, PathNode } from '@/types';

/**
 * Main Canvas Component
 * Combines HTML5 Canvas (raster image) + SVG overlay (vector paths)
 * Handles zoom, pan, selection, node editing, and glue line interaction.
 */

interface ImageRect {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
}

export default function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const image = useAppStore((s) => s.image);
  const zoom = useAppStore((s) => s.zoom);
  const panOffset = useAppStore((s) => s.panOffset);
  const showGrid = useAppStore((s) => s.showGrid);
  const showRulers = useAppStore((s) => s.showRulers);
  const showImage = useAppStore((s) => s.showImage);
  const paths = useAppStore((s) => s.paths);
  const selectedPathId = useAppStore((s) => s.selectedPathId);
  const selectedNodeIndex = useAppStore((s) => s.selectedNodeIndex);
  const activeTool = useAppStore((s) => s.activeTool);
  const glueLineState = useAppStore((s) => s.glueLineState);
  const textLabels = useAppStore((s) => s.textLabels);
  const setZoom = useAppStore((s) => s.setZoom);
  const setPanOffset = useAppStore((s) => s.setPanOffset);
  const setSelectedPath = useAppStore((s) => s.setSelectedPath);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const moveNode = useAppStore((s) => s.moveNode);
  const addNode = useAppStore((s) => s.addNode);
  const setGlueLineState = useAppStore((s) => s.setGlueLineState);

  // Drag state
  const dragRef = useRef<{
    isDragging: boolean;
    isPanning: boolean;
    startX: number;
    startY: number;
    startPan: Point;
    draggedNode: { pathId: string; nodeIndex: number } | null;
  }>({ isDragging: false, isPanning: false, startX: 0, startY: 0, startPan: { x: 0, y: 0 }, draggedNode: null });

  // Image position on canvas (centered, scaled to fit)
  const getImageRect = useCallback((): ImageRect => {
    if (!image || !containerRef.current) return { x: 0, y: 0, w: 0, h: 0, scale: 1 };
    const container = containerRef.current;
    const z = zoom / 100;
    const padding = 40 * z;
    const availW = container.clientWidth - padding * 2;
    const availH = container.clientHeight - padding * 2;
    const scale = Math.min(availW / image.width, availH / image.height) * z;
    const w = image.width * scale;
    const h = image.height * scale;
    const x = (container.clientWidth - w) / 2 + panOffset.x;
    const y = (container.clientHeight - h) / 2 + panOffset.y;
    return { x, y, w, h, scale };
  }, [image, zoom, panOffset]);

  // Screen to image coordinates
  const screenToImage = useCallback((sx: number, sy: number): Point | null => {
    const rect = getImageRect();
    if (rect.w === 0) return null;
    const ix = (sx - rect.x) / rect.scale;
    const iy = (sy - rect.y) / rect.scale;
    return { x: ix, y: iy };
  }, [getImageRect]);

  // Draw raster image on canvas (always run; clear when hidden)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 800;
    canvas.height = canvas.parentElement?.clientHeight || 600;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!image || !showImage) return;

    const rect = getImageRect();
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
    };
    img.src = image.dataUrl;
  }, [image, showImage, zoom, panOffset, getImageRect]);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = clamp(zoom * delta, 10, 2000);
    setZoom(newZoom);
  }, [zoom, setZoom]);

  // Mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Middle click or space+left = pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      dragRef.current = {
        isDragging: true, isPanning: true,
        startX: mx, startY: my,
        startPan: { ...panOffset },
        draggedNode: null,
      };
      return;
    }

    // Left click
    if (e.button !== 0) return;

    const imgPos = screenToImage(mx, my);
    if (!imgPos) return;

    // Hand tool = pan
    if (activeTool === 'hand') {
      dragRef.current = {
        isDragging: true, isPanning: true,
        startX: mx, startY: my,
        startPan: { ...panOffset },
        draggedNode: null,
      };
      return;
    }

    // Glue line tool
    if (activeTool === 'glue' && glueLineState) {
      const sourcePath = paths.find((p) => p.id === glueLineState.sourcePathId);
      if (!sourcePath) return;

      // Find closest node on the path
      let closestIdx = -1;
      let closestDist = Infinity;
      sourcePath.nodes.forEach((n, i) => {
        const d = dist(n, imgPos);
        if (d < closestDist && d < 20) {
          closestDist = d;
          closestIdx = i;
        }
      });

      if (closestIdx >= 0) {
        if (glueLineState.entryNodeIndex === null) {
          setGlueLineState({ ...glueLineState, entryNodeIndex: closestIdx });
        } else if (glueLineState.exitNodeIndex === null && closestIdx !== glueLineState.entryNodeIndex) {
          setGlueLineState({ ...glueLineState, exitNodeIndex: closestIdx });
        }
      }
      return;
    }

    // Select / Node tool: check for node click first
    if (activeTool === 'select' || activeTool === 'node') {
      const imgRect = getImageRect();
      // Check if clicking a node
      for (const path of paths) {
        if (selectedPathId && path.id !== selectedPathId) continue;
        for (let i = 0; i < path.nodes.length; i++) {
          const n = path.nodes[i];
          const nsx = imgRect.x + n.x * imgRect.scale;
          const nsy = imgRect.y + n.y * imgRect.scale;
          if (dist({ x: mx, y: my }, { x: nsx, y: nsy }) < 8) {
            if (activeTool === 'node') {
              dragRef.current = {
                isDragging: true, isPanning: false,
                startX: mx, startY: my,
                startPan: { x: 0, y: 0 },
                draggedNode: { pathId: path.id, nodeIndex: i },
              };
            }
            setSelectedPath(path.id);
            setSelectedNode(i);
            return;
          }
        }
      }

      // Check if clicking on a path edge
      for (const path of paths) {
        for (let i = 0; i < path.nodes.length; i++) {
          const a = path.nodes[i];
          const b = path.nodes[(i + 1) % path.nodes.length];
          const d = pointToSegmentDist(imgPos, a, b);
          if (d < 5) {
            setSelectedPath(path.id);
            setSelectedNode(null);
            return;
          }
        }
      }
    }

    // Click on empty = deselect
    setSelectedPath(null);
    setSelectedNode(null);
  }, [activeTool, paths, selectedPathId, glueLineState, panOffset, screenToImage, getImageRect, setSelectedPath, setSelectedNode, setGlueLineState, setPanOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (dragRef.current.isDragging) {
      if (dragRef.current.isPanning) {
        const dx = mx - dragRef.current.startX;
        const dy = my - dragRef.current.startY;
        setPanOffset({
          x: dragRef.current.startPan.x + dx,
          y: dragRef.current.startPan.y + dy,
        });
      } else if (dragRef.current.draggedNode) {
        const imgPos = screenToImage(mx, my);
        if (imgPos) {
          const { pathId, nodeIndex } = dragRef.current.draggedNode;
          moveNode(pathId, nodeIndex, imgPos.x, imgPos.y);
        }
      }
    }
  }, [screenToImage, setPanOffset, moveNode]);

  const handleMouseUp = useCallback(() => {
    dragRef.current = {
      isDragging: false, isPanning: false,
      startX: 0, startY: 0,
      startPan: { x: 0, y: 0 },
      draggedNode: null,
    };
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || !selectedPathId) return;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const imgPos = screenToImage(mx, my);
    if (!imgPos) return;

    const path = paths.find((p) => p.id === selectedPathId);
    if (!path) return;

    let bestSeg = -1;
    let bestT = 0;
    let bestDist = Infinity;

    for (let i = 0; i < path.nodes.length; i++) {
      const a = path.nodes[i];
      const b = path.nodes[(i + 1) % path.nodes.length];
      const proj = projectPointToSegment(imgPos, a, b);
      const d = dist(imgPos, proj.point);
      if (d < bestDist && d < 15) {
        bestDist = d;
        bestSeg = i;
        bestT = proj.t;
      }
    }

    if (bestSeg >= 0) {
      addNode(selectedPathId, bestSeg, bestT);
    }
  }, [screenToImage, selectedPathId, paths, addNode]);

  // Render SVG paths
  const imgRect = getImageRect();
  const selectedPath = paths.find((p) => p.id === selectedPathId);

  const nodeToScreen = (p: Point) => ({
    x: imgRect.x + p.x * imgRect.scale,
    y: imgRect.y + p.y * imgRect.scale,
  });

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ background: 'var(--bg-canvas)', cursor: activeTool === 'hand' || dragRef.current.isPanning ? 'grab' : 'default' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onDoubleClick={handleDoubleClick}
    >
      {/* Grid overlay */}
      {showGrid && imgRect.scale > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <pattern id="grid" width={imgRect.scale * 10} height={imgRect.scale * 10} patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.8" fill="#2a2a38" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      )}

      {/* Raster canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
      />

      {/* Vector SVG overlay */}
      <svg
        className="absolute inset-0 w-full h-full"
        style={{ pointerEvents: 'none' }}
      >
        {/* Vector paths */}
        {paths.map((path) => {
          const isSelected = path.id === selectedPathId;
          const d = pathToSVGPath(path, nodeToScreen);
          const color = path.layer === 'cut'
            ? (isSelected ? '#e8624a' : '#5c5c70')
            : '#2563eb';

          return (
            <g key={path.id}>
              <path
                d={d}
                fill={isSelected ? 'rgba(232,98,74,0.05)' : 'none'}
                stroke={color}
                strokeWidth={isSelected ? 2 : 1}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {/* Glue line preview */}
              {glueLineState && glueLineState.sourcePathId === path.id &&
                glueLineState.entryNodeIndex !== null &&
                glueLineState.exitNodeIndex !== null && (
                  <GlueLinePreview
                    path={path}
                    glueState={glueLineState as { entryNodeIndex: number; exitNodeIndex: number; useLongSegment: boolean }}
                    nodeToScreen={nodeToScreen}
                  />
                )}
            </g>
          );
        })}

        {/* Selected path nodes and handles */}
        {selectedPath && activeTool === 'node' && selectedPath.nodes.map((node, i) => {
          const pos = nodeToScreen(node);
          const isSelectedNode = i === selectedNodeIndex;

          return (
            <g key={node.id}>
              {/* Handle lines */}
              {node.handleOut && (
                <>
                  <line
                    x1={pos.x}
                    y1={pos.y}
                    x2={nodeToScreen({ x: node.x + node.handleOut.x, y: node.y + node.handleOut.y }).x}
                    y2={nodeToScreen({ x: node.x + node.handleOut.x, y: node.y + node.handleOut.y }).y}
                    stroke="#3d3d52"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <circle
                    cx={nodeToScreen({ x: node.x + node.handleOut.x, y: node.y + node.handleOut.y }).x}
                    cy={nodeToScreen({ x: node.x + node.handleOut.x, y: node.y + node.handleOut.y }).y}
                    r={4}
                    fill="none"
                    stroke="#8a8a9e"
                    strokeWidth={1}
                  />
                </>
              )}
              {/* Node */}
              <rect
                x={pos.x - 4}
                y={pos.y - 4}
                width={8}
                height={8}
                fill={isSelectedNode ? '#e8624a' : '#fff'}
                stroke={isSelectedNode ? '#fff' : '#e8624a'}
                strokeWidth={1.5}
                rx={1}
              />
            </g>
          );
        })}

        {/* Glue line entry/exit markers */}
        {glueLineState && selectedPath && (
          <>
            {glueLineState.entryNodeIndex !== null && (
              <circle
                cx={nodeToScreen(selectedPath.nodes[glueLineState.entryNodeIndex]).x}
                cy={nodeToScreen(selectedPath.nodes[glueLineState.entryNodeIndex]).y}
                r={6}
                fill="none"
                stroke="#3bbdc7"
                strokeWidth={2}
              />
            )}
            {glueLineState.exitNodeIndex !== null && (
              <circle
                cx={nodeToScreen(selectedPath.nodes[glueLineState.exitNodeIndex]).x}
                cy={nodeToScreen(selectedPath.nodes[glueLineState.exitNodeIndex]).y}
                r={6}
                fill="none"
                stroke="#3bbdc7"
                strokeWidth={2}
              />
            )}
          </>
        )}

        {/* Text labels */}
        {textLabels.map((label) => {
          const pos = nodeToScreen({ x: label.x, y: label.y });
          const fontSizePx = label.fontSizeMm * imgRect.scale * (image?.dpi ?? 300) / 25.4;
          return (
            <g key={label.id} transform={label.rotation !== 0 ? `rotate(${label.rotation}, ${pos.x}, ${pos.y})` : undefined}>
              <text
                x={pos.x}
                y={pos.y}
                fontSize={Math.max(8, fontSizePx)}
                fill="#2563eb"
                fontFamily="Inter, sans-serif"
                dominantBaseline="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {label.text}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Rulers */}
      {showRulers && imgRect.scale > 0 && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-5 pointer-events-none"
            style={{ background: 'var(--bg-toolbar)', borderBottom: '1px solid var(--border-default)' }}
          />
        </>
      )}
    </div>
  );
}

// ── Helpers ──

function pathToSVGPath(path: { nodes: PathNode[]; closed: boolean }, nodeToScreen: (p: Point) => Point): string {
  if (path.nodes.length === 0) return '';
  let d = '';
  const n = path.nodes.length;

  for (let i = 0; i < n; i++) {
    const curr = path.nodes[i];
    const next = path.nodes[(i + 1) % n];
    const pos = nodeToScreen(curr);

    if (i === 0) {
      d += `M ${pos.x} ${pos.y}`;
    }

    // If we have handleOut on current and handleIn on next, use cubic bezier
    if (curr.handleOut && next.handleIn && i < n - 1) {
      const cp1 = nodeToScreen({ x: curr.x + curr.handleOut.x, y: curr.y + curr.handleOut.y });
      const cp2 = nodeToScreen({ x: next.x + next.handleIn.x, y: next.y + next.handleIn.y });
      const end = nodeToScreen(next);
      d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
    } else if (curr.handleOut && i < n - 1) {
      const cp1 = nodeToScreen({ x: curr.x + curr.handleOut.x, y: curr.y + curr.handleOut.y });
      const cp2 = nodeToScreen(next);
      const end = nodeToScreen(next);
      d += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
    } else if (i < n - 1 || path.closed) {
      const end = nodeToScreen(next);
      d += ` L ${end.x} ${end.y}`;
    }
  }

  if (path.closed) d += ' Z';
  return d;
}

function GlueLinePreview({
  path,
  glueState,
  nodeToScreen,
}: {
  path: { nodes: PathNode[] };
  glueState: { entryNodeIndex: number; exitNodeIndex: number; useLongSegment: boolean };
  nodeToScreen: (p: Point) => Point;
}) {
  const nodes = path.nodes.map((n) => ({ x: n.x, y: n.y }));
  const segment = extractPathSegment(
    nodes,
    glueState.entryNodeIndex,
    glueState.exitNodeIndex,
    glueState.useLongSegment
  );

  // Simple preview: just highlight the selected segment
  let d = '';
  for (let i = 0; i < segment.length; i++) {
    const pos = nodeToScreen(segment[i]);
    d += i === 0 ? `M ${pos.x} ${pos.y}` : ` L ${pos.x} ${pos.y}`;
  }

  return (
    <path
      d={d}
      fill="none"
      stroke="#3bbdc7"
      strokeWidth={2.5}
      strokeDasharray="6,4"
      strokeLinecap="round"
    />
  );
}

function pointToSegmentDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2);
}

function projectPointToSegment(p: Point, a: Point, b: Point): { point: Point; t: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { point: { ...a }, t: 0 };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return {
    point: { x: a.x + t * dx, y: a.y + t * dy },
    t,
  };
}
