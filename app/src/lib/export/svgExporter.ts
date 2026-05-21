import type { VectorPath, GlueLine, TextLabel, ScannedImage, ExportOptions } from '@/types';
import { pxToMm } from '@/lib/geometry/transform';

/**
 * Export traced paths to a LightBurn-compatible SVG file.
 * Black (#000000) strokes = Cut layer
 * Blue (#0000FF) strokes = Mark/Engrave layer
 */

export function exportToSVG(
  paths: VectorPath[],
  glueLines: GlueLine[],
  textLabels: TextLabel[],
  image: ScannedImage | null,
  options: ExportOptions
): string {
  if (!image) return '';

  const widthMm = pxToMm(image.width, image.dpi);
  const heightMm = pxToMm(image.height, image.dpi);
  const p = options.precision;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(widthMm, p)} ${f(heightMm, p)}" width="${f(widthMm, p)}mm" height="${f(heightMm, p)}mm">\n`;

  // Cut layer: Black strokes
  if (options.includeCut) {
    svg += `  <!-- Cut Layer (Black) -->\n`;
    svg += `  <g id="cut" stroke="#000000" stroke-width="0.1mm" fill="none">\n`;
    for (const path of paths) {
      if (path.layer !== 'cut') continue;
      svg += `    ${pathToSVGPath(path, image.dpi, p)}\n`;
    }
    svg += `  </g>\n`;
  }

  // Mark layer: Blue strokes (glue lines)
  if (options.includeMark && options.includeGlueLines) {
    svg += `  <!-- Mark Layer (Blue) - Glue Lines -->\n`;
    svg += `  <g id="glue-lines" stroke="#0000FF" stroke-width="0.1mm" fill="none">\n`;
    for (const glue of glueLines) {
      svg += `    ${pathToSVGPath(glue.path, image.dpi, p)}\n`;
    }
    svg += `  </g>\n`;
  }

  // Mark layer: Blue text labels
  if (options.includeMark && options.includeTextLabels) {
    svg += `  <!-- Mark Layer (Blue) - Text Labels -->\n`;
    svg += `  <g id="text-labels" fill="#0000FF" stroke="none" font-family="Inter, sans-serif">\n`;
    for (const label of textLabels) {
      const xMm = pxToMm(label.x, image.dpi);
      const yMm = pxToMm(label.y, image.dpi);
      svg += `    <text x="${f(xMm, p)}" y="${f(yMm, p)}" font-size="${f(label.fontSizeMm, p)}mm"`;
      if (label.rotation !== 0) {
        svg += ` transform="rotate(${f(label.rotation, 1)}, ${f(xMm, p)}, ${f(yMm, p)})"`;
      }
      svg += `>${escapeXML(label.text)}</text>\n`;
    }
    svg += `  </g>\n`;
  }

  // Test cut square
  if (options.includeTestCut) {
    svg += `  <!-- Test Cut Calibration Square -->\n`;
    svg += `  <g id="test-cut" stroke="#000000" stroke-width="0.1mm" fill="none">\n`;
    svg += `    <rect x="0" y="0" width="10" height="10" />\n`;
    svg += `  </g>\n`;
  }

  svg += `</svg>`;
  return svg;
}

function pathToSVGPath(path: VectorPath, dpi: number, precision: number): string {
  if (path.nodes.length === 0) return '';

  let d = '';
  const n = path.nodes.length;

  for (let i = 0; i < n; i++) {
    const curr = path.nodes[i];
    const next = path.nodes[(i + 1) % n];
    const xMm = pxToMm(curr.x, dpi);
    const yMm = pxToMm(curr.y, dpi);

    if (i === 0) {
      d += `M ${f(xMm, precision)} ${f(yMm, precision)}`;
    }

    if (curr.handleOut && next.handleIn) {
      const cp1x = pxToMm(curr.x + curr.handleOut.x, dpi);
      const cp1y = pxToMm(curr.y + curr.handleOut.y, dpi);
      const cp2x = pxToMm(next.x + (next.handleIn?.x || 0), dpi);
      const cp2y = pxToMm(next.y + (next.handleIn?.y || 0), dpi);
      const nx = pxToMm(next.x, dpi);
      const ny = pxToMm(next.y, dpi);
      d += ` C ${f(cp1x, precision)} ${f(cp1y, precision)}, ${f(cp2x, precision)} ${f(cp2y, precision)}, ${f(nx, precision)} ${f(ny, precision)}`;
    } else if (curr.handleOut) {
      const cp1x = pxToMm(curr.x + curr.handleOut.x, dpi);
      const cp1y = pxToMm(curr.y + curr.handleOut.y, dpi);
      const cp2x = pxToMm(next.x, dpi);
      const cp2y = pxToMm(next.y, dpi);
      const nx = pxToMm(next.x, dpi);
      const ny = pxToMm(next.y, dpi);
      d += ` C ${f(cp1x, precision)} ${f(cp1y, precision)}, ${f(cp2x, precision)} ${f(cp2y, precision)}, ${f(nx, precision)} ${f(ny, precision)}`;
    } else {
      const nx = pxToMm(next.x, dpi);
      const ny = pxToMm(next.y, dpi);
      d += ` L ${f(nx, precision)} ${f(ny, precision)}`;
    }
  }

  if (path.closed) {
    d += ' Z';
  }

  return `<path d="${d}" />`;
}

function f(n: number, precision: number): string {
  return n.toFixed(precision);
}

function escapeXML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Trigger a file download of the SVG
 */
export function downloadSVG(svgContent: string, filename: string) {
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.svg') ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
