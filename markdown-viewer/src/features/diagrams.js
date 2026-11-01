// @ts-check
import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { DOCUMENT_MAX_DIAGRAMS, DOCUMENT_MAX_DIAGRAM_CHARS } from '../core/document-limits.js';
import Panzoom from '@panzoom/panzoom';
import DOMPurify from 'dompurify';
import { isIOSNative } from '../core/platform.js';
import { trapFocus, canRestoreNonEditableFocus } from '../core/focus-trap.js';
import { getSvgNaturalDimensions } from '../core/utils.js';
import { iconSvg } from '../core/icons.js';
import { getMermaidConfig, loadMermaid } from '../core/render-config.js';
import { updateMinimap, updateMinimapViewport } from './minimap.js';
import { downloadDiagramSvg, downloadDiagramPng } from './diagram-export.js';
import { shareDiagramLink } from './share-links.js';

/** @typedef {import('@panzoom/panzoom').PanzoomObject} PanzoomObject */
/** @typedef {{ scale: number, x: number, y: number }} HomeState */
/** @typedef {{ homeState: HomeState, interacted: boolean, initialPanPending: boolean, centerAfterInitialPan: boolean }} FullscreenState */
/**
 * The fullscreen overlay carries expando properties set by this module.
 * @typedef {HTMLElement & {
 *   panzoomInstance?: any,
 *   diagramId?: string | null,
 *   fullscreenState?: FullscreenState,
 *   fullscreenCleanup?: (() => void) | null,
 *   fullscreenReturnFocus?: HTMLElement | null,
 *   wheelHandler?: EventListener | null,
 *   dblClickHandler?: EventListener | null,
 * }} FullscreenOverlay
 */

const el = (/** @type {string} */ id) => document.getElementById(id);
const diagramFullscreenOverlay = /** @type {FullscreenOverlay | null} */ (document.getElementById('fullscreen-overlay'));
const getFsOverlay = () => diagramFullscreenOverlay;

/**
 * Null-safe addEventListener.
 * @param {Element | Node | null} target
 * @param {string} type
 * @param {EventListener} handler
 * @param {boolean | AddEventListenerOptions} [opts]
 */
const on = (target, type, handler, opts) => {
  if (target) target.addEventListener(type, handler, opts);
};

/** @param {unknown} error */
const errMessage = (error) => (error instanceof Error ? error.message : String(error));

// ===========================
// Mermaid Diagram Processing
// ===========================
// Render-generation token. renderMarkdown / switchTab / theme changes are all
// async and can overlap (e.g. rapid tab switches A→B→C while Mermaid renders):
// without a guard, a superseded run keeps writing into detached DOM, pushes
// panzoom instances for dead diagrams into shared state, and can interleave
// mermaid.initialize() with another run's in-flight render (mixed-theme
// output). Every entry to a diagram pass bumps the generation; after each
// await, a run that is no longer current stops touching DOM or state.
let diagramRenderGeneration = 0;

export async function processMermaidDiagrams() {
    const generation = ++diagramRenderGeneration;
    const context = captureDocumentContext();
    const root = el('markdown-content');
    if (!root) return;
    // Find all code blocks with mermaid language
    const codeBlocks = root.querySelectorAll('code.language-mermaid');

    if (codeBlocks.length === 0) return;
    if (codeBlocks.length > DOCUMENT_MAX_DIAGRAMS) {
        const limitNotice = document.createElement('p');
        limitNotice.className = 'mermaid-error';
        limitNotice.textContent = 'This document has more than 100 diagrams. Their source is shown instead.';
        root.prepend(limitNotice);
        return; // Complete the rest of the document's TOC/annotation setup.
    }

    // Load the mermaid engine on demand (this is the only place — plus the theme
    // re-render — that needs it, so documents without diagrams never pay for it).
    const mermaid = await loadMermaid();
    if (generation !== diagramRenderGeneration || !isDocumentContextCurrent(context)) return;

    // Process each mermaid diagram
    for (let i = 0; i < codeBlocks.length; i++) {
        const codeBlock = codeBlocks[i];
        const mermaidCode = codeBlock.textContent || '';
        const preElement = codeBlock.parentElement;

        try {
            if (mermaidCode.length > DOCUMENT_MAX_DIAGRAM_CHARS) throw new Error('This diagram is too large (maximum 50,000 characters).');
            // Generate unique ID
            const diagramId = `mermaid-diagram-${i}-${Date.now()}`;

            // Render mermaid diagram
            const { svg } = await mermaid.render(diagramId, mermaidCode);
            if (generation !== diagramRenderGeneration || !isDocumentContextCurrent(context)) return;

            // Create diagram container with mermaid source for re-rendering
            const container = createDiagramContainer(svg, diagramId, mermaidCode);

            // Replace pre/code block with diagram container
            if (preElement) preElement.replaceWith(container);

            // Wire the expand affordance and scaled-state detection
            initializeInlineDiagram(diagramId);

        } catch (error) {
            if (generation !== diagramRenderGeneration || !isDocumentContextCurrent(context)) return;
            console.error('Error rendering mermaid diagram:', error);
            // Keep the original code block on error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'mermaid-error';
            errorDiv.style.cssText = 'color: red; padding: 1rem; border: 1px solid red; border-radius: 4px; margin: 1rem 0;';
            errorDiv.textContent = `Error rendering diagram: ${errMessage(error)}`;
            if (preElement && preElement.parentElement) {
                preElement.parentElement.insertBefore(errorDiv, preElement);
            }
        }
    }
}

/**
 * Render one Mermaid diagram into a host element (web landing showcase).
 * Reuses the same container + expand-to-fullscreen path as document diagrams.
 * @param {HTMLElement} host
 * @param {string} mermaidCode
 * @param {string} [idPrefix]
 */
export async function renderStandaloneMermaid(host, mermaidCode, idPrefix) {
    if (!host || !mermaidCode) return;
    const mermaid = await loadMermaid();
    const diagramId = `${idPrefix || 'standalone-diagram'}-${Date.now()}`;
    try {
        const { svg } = await mermaid.render(diagramId, mermaidCode);
        const container = createDiagramContainer(svg, diagramId, mermaidCode);
        host.replaceChildren(container);
        initializeInlineDiagram(diagramId);
    } catch (error) {
        console.error('Error rendering standalone mermaid diagram:', error);
    }
}

/**
 * @param {string} svg
 * @param {string} diagramId
 * @param {string | null} mermaidSource
 */
function createDiagramContainer(svg, diagramId, mermaidSource) {
    const container = document.createElement('div');
    container.className = 'diagram-container';
    container.setAttribute('data-diagram-id', diagramId);

    // Single affordance: inline diagrams are static document content, and all
    // interactive machinery (zoom/pan, export, share, minimap) lives in the
    // fullscreen overlay this button opens.
    const expandBtn = document.createElement('button');
    expandBtn.className = 'diagram-expand';
    expandBtn.title = 'Expand diagram';
    expandBtn.setAttribute('aria-label', 'Expand diagram (opens interactive view)');
    expandBtn.innerHTML = iconSvg('maximize');

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'diagram-wrapper';
    wrapper.id = `wrapper-${diagramId}`;
    // Preserve Mermaid's label markup: allow <foreignObject> (HTML labels for
    // diagram types that use them) so DOMPurify does not strip the text.
    wrapper.innerHTML = DOMPurify.sanitize(svg, {
        ADD_TAGS: ['foreignObject'],
        ADD_ATTR: ['xmlns'],
    });

    // Store mermaid source on the SVG for theme re-rendering and export
    const svgEl = wrapper.querySelector('svg');
    if (svgEl && mermaidSource) {
        svgEl.setAttribute('data-mermaid-source', mermaidSource);
    }
    prepareInlineDiagramSvg(svgEl);

    container.appendChild(expandBtn);
    container.appendChild(wrapper);

    return container;
}

/**
 * Normalize a freshly rendered mermaid SVG for static inline layout: read the
 * natural size first (viewBox preferred, attrs as fallback), then strip
 * mermaid's inline style (its max-width) and set intrinsic pixel width/height
 * attributes. Small diagrams then render at natural size while the stylesheet
 * caps large ones at the column width / viewport height. The viewBox is left
 * untouched — export, minimap, fullscreen fit, and print all rely on it.
 * @param {SVGElement | null} svgEl
 */
function prepareInlineDiagramSvg(svgEl) {
    if (!svgEl) return;
    const dims = getSvgNaturalDimensions(svgEl);
    svgEl.style.cssText = '';
    if (dims) {
        svgEl.setAttribute('width', String(dims.width));
        svgEl.setAttribute('height', String(dims.height));
    }
}

// ===========================
// Diagram Fit Helpers
// ===========================
/** @param {HTMLElement} wrapper @param {SVGElement | null} svgElement */
function fullscreenDiagramGeometry(wrapper, svgElement) {
    const dims = svgElement && getSvgNaturalDimensions(svgElement);
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    if (!dims || ![width, height, dims.width, dims.height].every((n) => Number.isFinite(n) && n > 0)) return null;
    return { width, height, diagramWidth: dims.width, diagramHeight: dims.height };
}

/** Center the whole SVG using Panzoom's actual (possibly clamped) scale.
 * Manual pan remains available until a control zoom, resize or reset.
 * @param {PanzoomObject} panzoomInstance @param {HTMLElement} wrapper
 * @param {SVGElement | null} svgElement @param {boolean} [animate]
 * @returns {HomeState | null}
 */
function centerFullscreenDiagram(panzoomInstance, wrapper, svgElement, animate = false) {
    const geometry = fullscreenDiagramGeometry(wrapper, svgElement);
    const scale = panzoomInstance.getScale();
    if (!geometry || !Number.isFinite(scale) || scale <= 0) return null;
    // CSS transform is scale(S) translate(x,y), with SVG origin and position 0,0.
    const x = geometry.width / (2 * scale) - geometry.diagramWidth / 2;
    const y = geometry.height / (2 * scale) - geometry.diagramHeight / 2;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    panzoomInstance.pan(x, y, { animate });
    return { scale, ...panzoomInstance.getPan() };
}

/**
 * @param {HTMLElement} wrapper
 * @param {SVGElement} svgElement
 * @param {PanzoomObject} panzoomInstance
 * @param {boolean} [animate]
 * @returns {HomeState}
 */
function fitDiagramToContainer(wrapper, svgElement, panzoomInstance, animate = false) {
    const geometry = fullscreenDiagramGeometry(wrapper, svgElement);
    if (!geometry) {
        return { scale: 1, x: 0, y: 0 };
    }

    // Clear Mermaid sizing without removing Panzoom's touch/selection styles.
    svgElement.style.maxWidth = '';
    svgElement.style.maxHeight = '';
    // Remove mermaid's width/height attributes (often "100%") so they don't conflict
    svgElement.removeAttribute('width');
    svgElement.removeAttribute('height');
    // Set explicit pixel dimensions matching the viewBox content size
    svgElement.style.width = geometry.diagramWidth + 'px';
    svgElement.style.height = geometry.diagramHeight + 'px';
    svgElement.style.position = 'absolute';
    svgElement.style.left = '0px';
    svgElement.style.top = '0px';
    svgElement.style.transformOrigin = '0 0';

    // Calculate scale to fit with 10% padding
    const desired = Math.min(geometry.width / geometry.diagramWidth, geometry.height / geometry.diagramHeight) * 0.9;
    const options = panzoomInstance.getOptions?.();
    const minScale = Number.isFinite(options?.minScale) && Number(options?.minScale) > 0 ? Number(options?.minScale) : 0.05;
    const maxScale = Number.isFinite(options?.maxScale) && Number(options?.maxScale) >= minScale ? Number(options?.maxScale) : Math.max(20, minScale);
    panzoomInstance.zoom(Math.max(minScale, Math.min(maxScale, desired)), { animate });
    return centerFullscreenDiagram(panzoomInstance, wrapper, svgElement, animate) || { scale: 1, x: 0, y: 0 };
}

/**
 * @param {PanzoomObject} panzoomInstance
 * @param {HomeState} homeState
 */
export function resetToFit(panzoomInstance, homeState) {
    panzoomInstance.zoom(homeState.scale, { animate: true });
    panzoomInstance.pan(homeState.x, homeState.y, { animate: true });
}

/**
 * Control zoom returns the whole diagram to the viewport center at the new
 * scale, including when a scale limit prevents any zoom change. Pointer-wheel
 * and pinch gestures retain their native focal-point behavior.
 *
 * @param {PanzoomObject} panzoomInstance
 * @param {HTMLElement} wrapper
 * @param {() => void} applyZoom  applies the scale change (e.g. zoomIn, zoom)
 */
export function zoomKeepingCenter(panzoomInstance, wrapper, applyZoom) {
    applyZoom();
    centerFullscreenDiagram(panzoomInstance, wrapper, wrapper.querySelector('svg'));
}

/**
 * @param {PanzoomObject | null} panzoomInstance
 * @param {Element | null} controlsRoot
 */
export function updateZoomUI(panzoomInstance, controlsRoot) {
    if (!panzoomInstance || !controlsRoot) return;
    const percentEl = controlsRoot.querySelector('.zoom-percent');
    const rangeEl = /** @type {HTMLInputElement | null} */ (controlsRoot.querySelector('.zoom-range'));
    if (!percentEl || !rangeEl) return;
    const zoomPercent = Math.max(25, Math.min(400, Math.round(panzoomInstance.getScale() * 100)));
    percentEl.textContent = `${zoomPercent}%`;
    rangeEl.value = String(zoomPercent);
}

// ===========================
// Inline Diagram Wiring
// ===========================
const hasCoarsePointer = () =>
    typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/**
 * Mark containers whose diagram had to be scaled down by the stylesheet caps
 * (column width / viewport height). Scaled diagrams are not fully readable
 * inline, so they get an always-visible expand button, a zoom-in cursor, and
 * click-anywhere-to-expand. A clientWidth of 0 means layout hasn't happened
 * yet — leave the current state alone rather than guessing.
 * @param {Element} container
 */
function markDiagramScaledState(container) {
    const svgEl = container.querySelector('.diagram-wrapper svg');
    if (!svgEl) return;
    const dims = getSvgNaturalDimensions(/** @type {SVGElement} */ (svgEl));
    if (!dims) return;
    const shownWidth = svgEl.clientWidth;
    const shownHeight = svgEl.clientHeight;
    if (!shownWidth) return;
    const scaledDown = shownWidth + 1 < dims.width || shownHeight + 1 < dims.height;
    container.classList.toggle('diagram-scaled', scaledDown);
}

let diagramResizeListenerInstalled = false;
/** @type {ReturnType<typeof setTimeout> | undefined} */
let diagramResizeRecalcTimer;

// Window resizes move diagrams across the fits/doesn't-fit threshold, so the
// scaled state (and with it the expand affordance) is recomputed, debounced.
function installDiagramResizeListener() {
    if (diagramResizeListenerInstalled) return;
    diagramResizeListenerInstalled = true;
    window.addEventListener('resize', () => {
        clearTimeout(diagramResizeRecalcTimer);
        diagramResizeRecalcTimer = setTimeout(() => {
            document
                .querySelectorAll('#markdown-content .diagram-container')
                .forEach((container) => markDiagramScaledState(container));
        }, 150);
    });
}

/** @param {string} diagramId */
function initializeInlineDiagram(diagramId) {
    const wrapper = document.getElementById(`wrapper-${diagramId}`);
    if (!wrapper) return;
    const container = /** @type {HTMLElement | null} */ (wrapper.closest('.diagram-container'));
    if (!container) return;

    // Theme re-renders replace the wrapper's SVG but keep the container,
    // wrapper, and button elements — bind their listeners only once.
    if (container.dataset.inlineWired !== 'true') {
        container.dataset.inlineWired = 'true';

        on(container.querySelector('.diagram-expand'), 'click', (e) => {
            e.stopPropagation();
            openFullscreen(diagramId);
        });

        // Click-anywhere opens fullscreen only where it matches intent: a
        // scaled-down diagram (unreadable inline), or a touch device (no
        // hover to reveal the button). Small readable diagrams keep normal
        // click behavior, e.g. selecting label text.
        on(wrapper, 'click', () => {
            if (container.classList.contains('diagram-scaled') || hasCoarsePointer()) {
                openFullscreen(diagramId);
            }
        });
    }

    requestAnimationFrame(() => markDiagramScaledState(container));
    installDiagramResizeListener();
}

// ===========================
// Fullscreen Management
// ===========================
/** @param {string} diagramId */
function openFullscreen(diagramId) {
    const wrapper = document.getElementById(`wrapper-${diagramId}`);
    if (!wrapper) {
        console.error('Wrapper not found for diagram:', diagramId);
        return;
    }

    const svgElement = wrapper.querySelector('svg');
    if (!svgElement) {
        console.error('SVG element not found in wrapper');
        return;
    }

    const fsOverlay = getFsOverlay();
    if (!fsOverlay) return;
    const previousFocus = document.activeElement;
    const expandButton = wrapper.closest('.diagram-container')?.querySelector('.diagram-expand');
    const returnFocus = !fsOverlay.contains(previousFocus) && canRestoreNonEditableFocus(previousFocus)
        ? previousFocus : canRestoreNonEditableFocus(expandButton) ? expandButton : el('markdown-content');
    // Replacing a fullscreen instance must not momentarily refocus the page.
    closeFullscreen({ restoreFocus: false });

    // Clone SVG for fullscreen - use original mermaid source SVG attributes
    const svgClone = /** @type {SVGSVGElement} */ (svgElement.cloneNode(true));

    // Setup fullscreen wrapper
    const fullscreenWrapper = /** @type {HTMLElement | null} */ (
        fsOverlay.querySelector('.fullscreen-diagram-wrapper')
    );
    if (!fullscreenWrapper) return;
    fullscreenWrapper.innerHTML = '';
    fullscreenWrapper.appendChild(svgClone);

    // Show fullscreen first so container dimensions are available for fit calculation
    fsOverlay.style.display = 'flex';
    fsOverlay.setAttribute('role', 'dialog');
    fsOverlay.setAttribute('aria-modal', 'true');
    fsOverlay.fullscreenReturnFocus = returnFocus;

    // Initialize panzoom for fullscreen with wide scale range
    const fullscreenPanzoom = Panzoom(svgClone, {
        maxScale: 20,
        minScale: 0.05,
        step: 0.2,
        cursor: 'grab'
    });

    // Use mutable state for deferred fit recalculation.
    const fullscreenState = {
        homeState: fitDiagramToContainer(fullscreenWrapper, svgClone, fullscreenPanzoom),
        interacted: false,
        initialPanPending: true,
        centerAfterInitialPan: false
    };
    const isActive = () => fsOverlay.panzoomInstance === fullscreenPanzoom &&
        svgClone.parentElement === fullscreenWrapper && svgClone.isConnected;
    let fitFrame = 0;
    let resizeFrame = 0;
    /** @type {(() => void) | undefined} */
    let disposeMinimap;
    // Panzoom's constructor defers a forced `pan(startX, startY)` (0,0) via a
    // setTimeout(0) to constrain its initial values — that reset fires *after*
    // this synchronous fit and would clobber the centering back to the
    // top-left corner. Re-apply the fit from a setTimeout scheduled here: it was
    // queued after panzoom's (which ran during construction above), so it fires
    // after the reset and wins. A trailing rAF refits once more against the
    // final post-layout container dimensions.
    const applyFit = () => {
        if (!isActive() || fullscreenState.interacted) return;
        fullscreenState.homeState = fitDiagramToContainer(fullscreenWrapper, svgClone, fullscreenPanzoom);
        updateZoomUI(fullscreenPanzoom, fsOverlay.querySelector('.fullscreen-controls'));
    };
    const fitTimer = setTimeout(() => {
        if (!isActive()) return;
        fullscreenState.initialPanPending = false;
        // A control may zoom before Panzoom's constructor timer forces pan(0,0).
        // Repair that one reset at the user's current scale, then leave later
        // interaction alone; the trailing fit frame still observes interacted.
        if (fullscreenState.centerAfterInitialPan) {
            centerFullscreenDiagram(fullscreenPanzoom, fullscreenWrapper, svgClone);
            updateZoomUI(fullscreenPanzoom, fsOverlay.querySelector('.fullscreen-controls'));
            fullscreenState.centerAfterInitialPan = false;
        } else applyFit();
        fitFrame = requestAnimationFrame(applyFit);
    }, 0);

    // Store for cleanup
    fsOverlay.panzoomInstance = fullscreenPanzoom;
    fsOverlay.diagramId = diagramId;
    fsOverlay.fullscreenState = fullscreenState;

    // A detail column can resize without a window resize (sidebar/fold/safe
    // area). Keep the user's scale and center the SVG in its actual new box.
    let previousWidth = fullscreenWrapper.clientWidth;
    let previousHeight = fullscreenWrapper.clientHeight;
    const recenterOnResize = () => {
        if (!isActive()) return;
        const geometry = fullscreenDiagramGeometry(fullscreenWrapper, svgClone);
        if (!geometry || (geometry.width === previousWidth && geometry.height === previousHeight)) return;
        previousWidth = geometry.width;
        previousHeight = geometry.height;
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
            if (!isActive()) return;
            centerFullscreenDiagram(fullscreenPanzoom, fullscreenWrapper, svgClone);
            updateZoomUI(fullscreenPanzoom, fsOverlay.querySelector('.fullscreen-controls'));
        });
    };
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(recenterOnResize) : null;
    if (resizeObserver) resizeObserver.observe(fullscreenWrapper);
    else window.addEventListener('resize', recenterOnResize);
    const markInteraction = () => { fullscreenState.interacted = true; };
    svgClone.addEventListener('panzoomstart', markInteraction);
    const releaseFocusTrap = trapFocus(fsOverlay);
    // The shared trap wraps the controls; the initial tabindex=-1 dialog
    // itself needs an explicit entry edge in both directions.
    const enterFullscreenControls = (/** @type {KeyboardEvent} */ event) => {
        if (event.key !== 'Tab' || document.activeElement !== fsOverlay) return;
        event.preventDefault();
        const selector = event.shiftKey ? '.close-fullscreen' : '.zoom-in';
        const control = /** @type {HTMLButtonElement | null} */ (fsOverlay.querySelector(selector));
        control?.focus({ preventScroll: true });
    };
    fsOverlay.addEventListener('keydown', enterFullscreenControls);
    fsOverlay.fullscreenCleanup = () => {
        disposeMinimap?.();
        disposeMinimap = undefined;
        clearTimeout(fitTimer);
        cancelAnimationFrame(fitFrame);
        cancelAnimationFrame(resizeFrame);
        resizeObserver?.disconnect();
        window.removeEventListener('resize', recenterOnResize);
        svgClone.removeEventListener('panzoomstart', markInteraction);
        releaseFocusTrap();
        fsOverlay.removeEventListener('keydown', enterFullscreenControls);
    };

    // Setup fullscreen controls with fresh event listeners
    setupFullscreenControls(fullscreenPanzoom, fullscreenWrapper, fullscreenState);

    if (!isIOSNative) {
        // Setup minimap
        requestAnimationFrame(() => {
            if (!isActive()) return;
            disposeMinimap = updateMinimap(svgClone);
            updateMinimapViewport(fullscreenPanzoom, fullscreenWrapper);
        });

        // Update minimap viewport on pan/zoom
        svgClone.addEventListener('panzoomchange', () => {
            if (!isActive()) return;
            updateMinimapViewport(fullscreenPanzoom, fullscreenWrapper);
        });
    }

    // Focus for keyboard events
    fsOverlay.focus({ preventScroll: true });
}

/**
 * @param {PanzoomObject} panzoomInstance
 * @param {HTMLElement} wrapper
 * @param {FullscreenState} fullscreenState
 */
function setupFullscreenControls(panzoomInstance, wrapper, fullscreenState) {
    const fsOverlay = getFsOverlay();
    if (!fsOverlay) return;
    const isActive = () => fsOverlay.panzoomInstance === panzoomInstance;
    const controls = fsOverlay.querySelector('.fullscreen-controls');
    if (!controls) return;
    const zoomInBtn = controls.querySelector('.zoom-in');
    const zoomOutBtn = controls.querySelector('.zoom-out');
    const zoomRange = controls.querySelector('.zoom-range');
    const resetBtn = controls.querySelector('.reset');
    const exportSvgBtn = controls.querySelector('.export-svg');
    const exportPngBtn = controls.querySelector('.export-png');
    const shareBtn = controls.querySelector('.share-diagram');
    const closeBtn = controls.querySelector('.close-fullscreen');
    if (!zoomInBtn || !zoomOutBtn || !resetBtn || !closeBtn) return;

    // Remove old listeners by cloning
    const newZoomIn = zoomInBtn.cloneNode(true);
    const newZoomOut = zoomOutBtn.cloneNode(true);
    const newReset = resetBtn.cloneNode(true);
    const zoomRangeLabel = zoomRange ? zoomRange.closest('.zoom-range-label') : null;
    const newZoomRangeLabel = zoomRangeLabel ? zoomRangeLabel.cloneNode(true) : null;
    const newExportSvg = exportSvgBtn ? exportSvgBtn.cloneNode(true) : null;
    const newExportPng = exportPngBtn ? exportPngBtn.cloneNode(true) : null;
    const newShare = shareBtn ? shareBtn.cloneNode(true) : null;
    const newClose = closeBtn.cloneNode(true);

    zoomInBtn.replaceWith(newZoomIn);
    zoomOutBtn.replaceWith(newZoomOut);
    resetBtn.replaceWith(newReset);
    if (zoomRangeLabel && newZoomRangeLabel) zoomRangeLabel.replaceWith(newZoomRangeLabel);
    if (exportSvgBtn && newExportSvg) exportSvgBtn.replaceWith(newExportSvg);
    if (exportPngBtn && newExportPng) exportPngBtn.replaceWith(newExportPng);
    if (shareBtn && newShare) shareBtn.replaceWith(newShare);
    closeBtn.replaceWith(newClose);

    const markControlZoom = () => {
        fullscreenState.interacted = true;
        if (fullscreenState.initialPanPending) fullscreenState.centerAfterInitialPan = true;
    };

    // Add new listeners
    on(newZoomIn, 'click', (e) => {
        e.stopPropagation();
        if (!isActive()) return;
        markControlZoom();
        zoomKeepingCenter(panzoomInstance, wrapper, () => panzoomInstance.zoomIn({ animate: false }));
        updateZoomUI(panzoomInstance, controls);
    });

    on(newZoomOut, 'click', (e) => {
        e.stopPropagation();
        if (!isActive()) return;
        markControlZoom();
        zoomKeepingCenter(panzoomInstance, wrapper, () => panzoomInstance.zoomOut({ animate: false }));
        updateZoomUI(panzoomInstance, controls);
    });

    on(newReset, 'click', (e) => {
        e.stopPropagation();
        resetCurrentFit();
    });

    const resetCurrentFit = () => {
        if (!isActive()) return;
        markControlZoom();
        const svg = wrapper.querySelector('svg');
        if (svg) fullscreenState.homeState = fitDiagramToContainer(wrapper, svg, panzoomInstance, true);
        updateZoomUI(panzoomInstance, controls);
    };

    const newZoomRange = controls.querySelector('.zoom-range');
    on(newZoomRange, 'input', (e) => {
        e.stopPropagation();
        if (!isActive()) return;
        markControlZoom();
        const target = /** @type {HTMLInputElement} */ (e.target);
        const targetPercent = Number(target.value);
        if (Number.isFinite(targetPercent) && targetPercent > 0) {
            zoomKeepingCenter(panzoomInstance, wrapper, () =>
                panzoomInstance.zoom(targetPercent / 100, { animate: false })
            );
            updateZoomUI(panzoomInstance, controls);
        }
    });

    on(newExportSvg, 'click', (e) => {
        e.stopPropagation();
        if (!isActive()) return;
        downloadDiagramSvg(fsOverlay.diagramId || '');
    });

    on(newExportPng, 'click', (e) => {
        e.stopPropagation();
        if (!isActive()) return;
        downloadDiagramPng(fsOverlay.diagramId || '');
    });

    on(newShare, 'click', (e) => {
        e.stopPropagation();
        if (!isActive()) return;
        shareDiagramLink(fsOverlay.diagramId || '');
    });

    on(newClose, 'click', (e) => {
        e.stopPropagation();
        if (!isActive()) return;
        closeFullscreen();
    });

    // Mouse wheel zoom - use passive: false to allow preventDefault
    /** @type {EventListener} */
    const wheelHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isActive()) return;
        fullscreenState.interacted = true;
        panzoomInstance.zoomWithWheel(/** @type {WheelEvent} */ (e));
        updateZoomUI(panzoomInstance, controls);
    };

    wrapper.addEventListener('wheel', wheelHandler, { passive: false });
    fsOverlay.wheelHandler = wheelHandler;

    // Double click to reset to fit
    /** @type {EventListener} */
    const dblClickHandler = (e) => {
        e.stopPropagation();
        resetCurrentFit();
    };

    wrapper.addEventListener('dblclick', dblClickHandler);
    fsOverlay.dblClickHandler = dblClickHandler;
    updateZoomUI(panzoomInstance, controls);
}

/** @param {{ restoreFocus?: boolean }} [options] */
export function closeFullscreen({ restoreFocus = true } = {}) {
    const fsOverlay = getFsOverlay();
    if (!fsOverlay) return;
    const ownedFocus = fsOverlay.style.display !== 'none' && fsOverlay.contains(document.activeElement);
    const returnFocus = fsOverlay.fullscreenReturnFocus;
    fsOverlay.fullscreenReturnFocus = null;
    fsOverlay.fullscreenCleanup?.();
    fsOverlay.fullscreenCleanup = null;

    // Cleanup panzoom instance
    if (fsOverlay.panzoomInstance) {
        try {
            fsOverlay.panzoomInstance.destroy();
        } catch (error) {
            console.error('Error destroying fullscreen panzoom:', error);
        }
        fsOverlay.panzoomInstance = null;
    }

    // Remove event handlers
    const fullscreenWrapper = fsOverlay.querySelector('.fullscreen-diagram-wrapper');

    if (fullscreenWrapper && fsOverlay.wheelHandler) {
        fullscreenWrapper.removeEventListener('wheel', fsOverlay.wheelHandler);
        fsOverlay.wheelHandler = null;
    }

    if (fullscreenWrapper && fsOverlay.dblClickHandler) {
        fullscreenWrapper.removeEventListener('dblclick', fsOverlay.dblClickHandler);
        fsOverlay.dblClickHandler = null;
    }

    // Hide fullscreen
    fsOverlay.style.display = 'none';
    fsOverlay.removeAttribute('role');
    fsOverlay.removeAttribute('aria-modal');

    // Clear content
    if (fullscreenWrapper) fullscreenWrapper.innerHTML = '';
    fsOverlay.diagramId = null;
    // A newer dialog may own focus during teardown. Leave it alone, and never
    // restore a detached/hidden source control or an old text-entry field.
    if (restoreFocus && ownedFocus) {
        const target = canRestoreNonEditableFocus(returnFocus) ? returnFocus : el('markdown-content');
        if (canRestoreNonEditableFocus(target)) target.focus({ preventScroll: true });
        else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
}

// ===========================
// Re-render Mermaid (for theme change)
// ===========================
export async function reRenderMermaidDiagrams() {
    // Shares the generation counter with processMermaidDiagrams: a new document
    // render invalidates an in-flight theme re-render, and vice versa.
    const generation = ++diagramRenderGeneration;
    const context = captureDocumentContext();
    const roots = [];
    const markdownRoot = el('markdown-content');
    if (markdownRoot) roots.push(markdownRoot);
    const dropZoneEl = el('drop-zone');
    const landingRoot = el('landing-diagram');
    if (landingRoot && dropZoneEl && dropZoneEl.style.display !== 'none') {
        roots.push(landingRoot);
    }
    if (roots.length === 0) return;
    // Get all diagram containers (document + visible web landing)
    const containers = roots.flatMap((root) =>
        Array.from(root.querySelectorAll('.diagram-container'))
    );

    // Nothing to re-theme means no need to pull in the mermaid engine.
    if (containers.length === 0) return;

    // Update mermaid theme (the engine is already loaded if diagrams exist)
    const mermaid = await loadMermaid();
    if (generation !== diagramRenderGeneration || !isDocumentContextCurrent(context)) return;
    mermaid.initialize(getMermaidConfig());

    for (const container of containers) {
        const wrapper = container.querySelector('.diagram-wrapper');
        const diagramId = container.getAttribute('data-diagram-id');

        if (!wrapper || !diagramId) continue;

        // Find original mermaid code (stored in data attribute)
        const svgElement = wrapper.querySelector('svg');
        if (!svgElement) continue;

        // Get mermaid code from SVG or skip if not available
        const mermaidCode = svgElement.getAttribute('data-mermaid-source');
        if (!mermaidCode) continue;

        try {
            // Re-render with new theme
            const { svg } = await mermaid.render(`${diagramId}-rerender`, mermaidCode);
            if (generation !== diagramRenderGeneration || !isDocumentContextCurrent(context)) return;

            // Update wrapper content
            // Preserve Mermaid's label markup: allow <foreignObject> (HTML labels for
            // diagram types that use them) so DOMPurify does not strip the text.
            wrapper.innerHTML = DOMPurify.sanitize(svg, {
                ADD_TAGS: ['foreignObject'],
                ADD_ATTR: ['xmlns'],
            });

            // Store mermaid source on new SVG element
            const newSvgElement = wrapper.querySelector('svg');
            if (newSvgElement) {
                newSvgElement.setAttribute('data-mermaid-source', mermaidCode);
            }
            prepareInlineDiagramSvg(newSvgElement);

            // Refresh scaled-state detection for the re-themed SVG
            initializeInlineDiagram(diagramId);

        } catch (error) {
            if (generation !== diagramRenderGeneration || !isDocumentContextCurrent(context)) return;
            console.error('Error re-rendering mermaid diagram:', error);
        }
    }
}
