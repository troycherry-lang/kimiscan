import { useEffect } from 'react';
import useAppStore from '@/store/useAppStore';

export function useKeyboardShortcuts() {
  const setTool = useAppStore((s) => s.setTool);
  const setZoom = useAppStore((s) => s.setZoom);
  const zoom = useAppStore((s) => s.zoom);
  const runTrace = useAppStore((s) => s.runTrace);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const setShowGrid = useAppStore((s) => s.setShowGrid);
  const showGrid = useAppStore((s) => s.showGrid);
  const setShowRulers = useAppStore((s) => s.setShowRulers);
  const showRulers = useAppStore((s) => s.showRulers);
  const setShowImage = useAppStore((s) => s.setShowImage);
  const showImage = useAppStore((s) => s.showImage);
  const selectedPathId = useAppStore((s) => s.selectedPathId);
  const setSelectedPath = useAppStore((s) => s.setSelectedPath);
  const setSelectedNode = useAppStore((s) => s.setSelectedNode);
  const deletePath = useAppStore((s) => s.deletePath);
  const glueLineState = useAppStore((s) => s.glueLineState);
  const setGlueLineState = useAppStore((s) => s.setGlueLineState);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      const key = e.key.toLowerCase();

      // Tool selection
      if (key === 'v') { e.preventDefault(); setTool('select'); }
      else if (key === 'h') { e.preventDefault(); setTool('hand'); }
      else if (key === 'a') { e.preventDefault(); setTool('node'); }
      else if (key === 'g') { e.preventDefault(); setTool('glue'); }

      // Zoom
      else if (key === '0' && e.ctrlKey) { e.preventDefault(); setZoom(100); }
      else if (key === '=' && e.ctrlKey) { e.preventDefault(); setZoom(zoom * 1.25); }
      else if (key === '-' && e.ctrlKey) { e.preventDefault(); setZoom(zoom / 1.25); }

      // Trace
      else if (key === 't' && e.ctrlKey) { e.preventDefault(); runTrace(); }

      // Undo/Redo
      else if (key === 'z' && e.ctrlKey) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      else if (key === 'y' && e.ctrlKey) { e.preventDefault(); redo(); }

      // Toggles
      else if (key === 'tab') { e.preventDefault(); setShowImage(!showImage); }
      else if (key === 'r') { e.preventDefault(); setShowRulers(!showRulers); }

      // Delete
      else if (key === 'delete' || key === 'backspace') {
        if (selectedPathId) {
          deletePath(selectedPathId);
          setSelectedPath(null);
          setSelectedNode(null);
        }
      }

      // Escape
      else if (key === 'escape') {
        if (glueLineState) {
          setGlueLineState(null);
        } else {
          setSelectedPath(null);
          setSelectedNode(null);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTool, setZoom, zoom, runTrace, undo, redo, showGrid, showRulers, showImage, selectedPathId, deletePath, setSelectedPath, setSelectedNode, glueLineState, setGlueLineState, setShowGrid, setShowRulers, setShowImage]);
}
