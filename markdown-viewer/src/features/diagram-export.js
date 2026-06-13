// Diagram export: download a rendered Mermaid diagram as SVG or PNG.

import { getSvgNaturalDimensions } from '../core/utils.js';

/**
 * Find the SVG element for a diagram, preferring the in-document wrapper and
 * falling back to the fullscreen overlay's copy.
 * @param {string} diagramId
 * @returns {SVGElement | null}
 */
function getSvgElementForDiagram(diagramId) {
  const wrapper = document.getElementById('wrapper-' + diagramId);
  const fullscreenOverlay = document.getElementById('fullscreen-overlay');
  if (wrapper) {
    const inWrapper = wrapper.querySelector('svg');
    if (inWrapper) return inWrapper;
  }
  return fullscreenOverlay
    ? fullscreenOverlay.querySelector('.fullscreen-diagram-wrapper svg')
    : null;
}

/**
 * Trigger a browser download of a blob under the given filename.
 * @param {Blob} blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download the diagram as an SVG file. */
export function downloadDiagramSvg(diagramId) {
  const svgEl = getSvgElementForDiagram(diagramId);
  if (!svgEl) return;

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, (diagramId || 'diagram') + '.svg');
}

/** Download the diagram as a 2x (retina) PNG file. */
export function downloadDiagramPng(diagramId) {
  const svgEl = getSvgElementForDiagram(diagramId);
  if (!svgEl) return;

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    // Use natural SVG viewBox size for crisp export
    const dims = getSvgNaturalDimensions(svgEl);
    const scale = 2; // 2x for retina quality
    canvas.width = (dims ? dims.width : img.naturalWidth || 800) * scale;
    canvas.height = (dims ? dims.height : img.naturalHeight || 600) * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    canvas.toBlob((pngBlob) => {
      triggerDownload(pngBlob, (diagramId || 'diagram') + '.png');
    }, 'image/png');
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}
