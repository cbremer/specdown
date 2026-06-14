// @ts-check
// Diagram minimap (shown in the fullscreen overlay): a scaled-down render of
// the diagram plus a viewport indicator reflecting the current pan/zoom.

import { getSvgNaturalDimensions } from '../core/utils.js';

/**
 * Render the diagram SVG into the minimap canvas.
 * @param {SVGElement} svgElement
 */
export function updateMinimap(svgElement) {
  const minimapEl = document.getElementById('fullscreen-minimap');
  const canvas = /** @type {HTMLCanvasElement | null} */ (
    document.getElementById('minimap-canvas')
  );
  if (!minimapEl || !canvas) return;

  const dims = getSvgNaturalDimensions(svgElement);
  if (!dims) {
    minimapEl.style.display = 'none';
    return;
  }

  minimapEl.style.display = '';

  const MAX_MINIMAP = 160;
  const scale = Math.min(MAX_MINIMAP / dims.width, MAX_MINIMAP / dims.height);
  canvas.width = Math.round(dims.width * scale);
  canvas.height = Math.round(dims.height * scale);
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';

  // Render the SVG into the minimap canvas via an image
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgElement);
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

/**
 * Position the minimap viewport rectangle for the current pan/zoom.
 * @param {any} panzoomInstance
 * @param {HTMLElement} wrapper
 */
export function updateMinimapViewport(panzoomInstance, wrapper) {
  const viewportEl = document.getElementById('minimap-viewport');
  const canvas = /** @type {HTMLCanvasElement | null} */ (
    document.getElementById('minimap-canvas')
  );
  if (!viewportEl || !canvas || !panzoomInstance) return;

  const pan = panzoomInstance.getPan();
  const scale = panzoomInstance.getScale();
  const wW = wrapper.clientWidth;
  const wH = wrapper.clientHeight;
  const cW = canvas.width;
  const cH = canvas.height;

  // The SVG has dims.width x dims.height at scale 1.
  // The viewport shows wW/scale x wH/scale of the SVG content.
  // The minimap scale factor: cW / dims.width
  const svgEl = wrapper.querySelector('svg');
  const dims = svgEl ? getSvgNaturalDimensions(svgEl) : null;
  if (!dims) return;

  const minimapScale = cW / dims.width;
  const vpW = Math.min((wW / scale) * minimapScale, cW);
  const vpH = Math.min((wH / scale) * minimapScale, cH);
  const vpX = (-pan.x / scale) * minimapScale;
  const vpY = (-pan.y / scale) * minimapScale;

  viewportEl.style.left = Math.max(0, vpX) + 'px';
  viewportEl.style.top = Math.max(0, vpY) + 'px';
  viewportEl.style.width = vpW + 'px';
  viewportEl.style.height = vpH + 'px';
}
