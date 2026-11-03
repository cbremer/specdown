// @ts-check
// Diagram export: download a rendered Mermaid diagram as SVG or PNG.

import { getSvgNaturalDimensions } from '../core/utils.js';
import { isIOSNative } from '../core/platform.js';
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import {
  getIOSDocumentView,
  isIOSDocumentViewCurrent,
  requestIOSDiagramExport,
} from '../platform/ios-documents.js';
import { showToast } from './toast.js';
import { documentByteLength } from '../core/document-limits.js';
let diagramExportSequence = 0;

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
  return fullscreenOverlay &&
    /** @type {HTMLElement & { diagramId?: string } | null} */ (
      fullscreenOverlay
    )?.diagramId === diagramId
    ? /** @type {SVGElement | null} */ (
        fullscreenOverlay.querySelector('.fullscreen-diagram-wrapper svg')
      )
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

/**
 * Download the diagram as an SVG file.
 * @param {string} diagramId
 */
export function downloadDiagramSvg(diagramId) {
  const svgEl = getSvgElementForDiagram(diagramId);
  if (!svgEl) return;

  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgEl);
  if (documentByteLength(svgStr) > 2 * 1024 * 1024) {
    showToast('The SVG is too large to export (maximum 2 MiB).', {
      type: 'error',
    });
    return;
  }
  if (isIOSNative) {
    const view = getIOSDocumentView();
    if (view && isIOSDocumentViewCurrent(view))
      requestIOSDiagramExport({
        format: 'svg',
        payload: svgStr,
        token: view.token,
        requestID: `${Date.now()}-${++diagramExportSequence}`,
      });
    return;
  }
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, (diagramId || 'diagram') + '.svg');
}

/**
 * Download the diagram as a 2x (retina) PNG file.
 * @param {string} diagramId
 */
/** @type {{ cancel: () => void } | null} */
let activeDiagramRaster = null;

export function cancelDiagramRasterExport() {
  activeDiagramRaster?.cancel();
}

/** @param {string} diagramId */
export function downloadDiagramPng(diagramId) {
  const svgEl = getSvgElementForDiagram(diagramId);
  if (!svgEl) return;
  if (activeDiagramRaster) {
    showToast(
      'A PNG is being prepared. Wait a moment before exporting another.',
      { type: 'warning' }
    );
    return;
  }
  const exportContext = captureDocumentContext();
  const nativeView = getIOSDocumentView();
  const dimensions = getSvgNaturalDimensions(svgEl);
  const width = (dimensions?.width || 800) * 2;
  const height = (dimensions?.height || 600) * 2;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 16_000_000
  ) {
    showToast('This diagram is too large for PNG. Export SVG instead.', {
      type: 'warning',
    });
    return;
  }
  const svgStr = new XMLSerializer().serializeToString(svgEl);
  if (documentByteLength(svgStr) > 2 * 1024 * 1024) {
    showToast('The SVG is too large to prepare a PNG (maximum 2 MiB).', {
      type: 'error',
    });
    return;
  }
  const url = URL.createObjectURL(
    new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
  );
  const img = new Image();
  /** @type {HTMLCanvasElement | null} */
  let canvas = null;
  /** @type {FileReader | null} */
  let reader = null;
  let cancelled = false;
  const rasterJob = {
    cancel: () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
      img.src = '';
      reader?.abort();
      finish();
    },
  };
  const finish = () => {
    clearTimeout(deadline);
    URL.revokeObjectURL(url);
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    if (activeDiagramRaster === rasterJob) activeDiagramRaster = null;
  };
  const current = () =>
    !cancelled &&
    isDocumentContextCurrent(exportContext) &&
    (!isIOSNative || isIOSDocumentViewCurrent(nativeView));
  const fail = () => {
    finish();
    showToast('The PNG could not be prepared. Try SVG instead.', {
      type: 'error',
    });
  };
  const deadline = setTimeout(() => {
    rasterJob.cancel();
    fail();
  }, 30000);
  activeDiagramRaster = rasterJob;
  img.onload = () => {
    if (!current()) {
      finish();
      return;
    }
    try {
      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        fail();
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (!pngBlob || !current()) {
          finish();
          return;
        }
        if (pngBlob.size > 8 * 1024 * 1024) {
          finish();
          showToast('The PNG is too large to export (maximum 8 MiB).', {
            type: 'error',
          });
          return;
        }
        if (isIOSNative) {
          reader = new FileReader();
          reader.onload = () => {
            if (current() && nativeView && typeof reader?.result === 'string')
              requestIOSDiagramExport({
                format: 'png',
                payload: reader.result.split(',')[1],
                token: nativeView.token,
                requestID: `${Date.now()}-${++diagramExportSequence}`,
              });
            finish();
          };
          reader.onerror = fail;
          reader.readAsDataURL(pngBlob);
        } else {
          triggerDownload(pngBlob, (diagramId || 'diagram') + '.png');
          finish();
        }
      }, 'image/png');
    } catch {
      fail();
    }
  };
  img.onerror = fail;
  img.src = url;
}
