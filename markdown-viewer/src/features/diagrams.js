// @ts-check
import Panzoom from '@panzoom/panzoom';
import DOMPurify from 'dompurify';
import { isIOSNative } from '../core/platform.js';
import { getSvgNaturalDimensions } from '../core/utils.js';
import { iconSvg } from '../core/icons.js';
import { getMermaidConfig, loadMermaid } from '../core/render-config.js';
import { updateMinimap, updateMinimapViewport } from './minimap.js';
import { downloadDiagramSvg, downloadDiagramPng } from './diagram-export.js';
import { shareDiagramLink } from './share-links.js';

/** @typedef {import('@panzoom/panzoom').PanzoomObject} PanzoomObject */
/** @typedef {{ scale: number, x: number, y: number }} HomeState */
/**
 * The fullscreen overlay carries expando properties set by this module.
 * @typedef {HTMLElement & {
 *   panzoomInstance?: any,
 *   diagramId?: string | null,
 *   fullscreenState?: { homeState: HomeState },
 *   wheelHandler?: EventListener | null,
 *   dblClickHandler?: EventListener | null,
 * }} FullscreenOverlay
 */

const el = (/** @type {string} */ id) => document.getElementById(id);
const getFsOverlay = () => /** @type {FullscreenOverlay | null} */ (el('fullscreen-overlay'));

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
    const root = el('markdown-content');
    if (!root) return;
    // Find all code blocks with mermaid language
    const codeBlocks = root.querySelectorAll('code.language-mermaid');

    if (codeBlocks.length === 0) return;

    // Load the mermaid engine on demand (this is the only place — plus the theme
    // re-render — that needs it, so documents without diagrams never pay for it).
    const mermaid = await loadMermaid();
    if (generation !== diagramRenderGeneration) return;

    // Process each mermaid diagram
    for (let i = 0; i < codeBlocks.length; i++) {
        const codeBlock = codeBlocks[i];
        const mermaidCode = codeBlock.textContent || '';
        const preElement = codeBlock.parentElement;

        try {
            // Generate unique ID
            const diagramId = `mermaid-diagram-${i}-${Date.now()}`;

            // Render mermaid diagram
            const { svg } = await mermaid.render(diagramId, mermaidCode);
            if (generation !== diagramRenderGeneration) return; // superseded mid-render

            // Create diagram container with mermaid source for re-rendering
            const container = createDiagramContainer(svg, diagramId, mermaidCode);

            // Replace pre/code block with diagram container
            if (preElement) preElement.replaceWith(container);

            // Wire the expand affordance and scaled-state detection
            initializeInlineDiagram(diagramId);

        } catch (error) {
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
/**
 * @param {HTMLElement} wrapper
 * @param {SVGElement} svgElement
 * @param {PanzoomObject} panzoomInstance
 * @returns {HomeState}
 */
function fitDiagramToContainer(wrapper, svgElement, panzoomInstance) {
    const dims = getSvgNaturalDimensions(svgElement);
    const containerWidth = wrapper.clientWidth;
    const containerHeight = wrapper.clientHeight;

    if (!dims || !containerWidth || !containerHeight) {
        return { scale: 1, x: 0, y: 0 };
    }

    // Clear all mermaid-set inline styles (e.g. max-width) that interfere with panzoom
    svgElement.style.cssText = '';
    // Remove mermaid's width/height attributes (often "100%") so they don't conflict
    svgElement.removeAttribute('width');
    svgElement.removeAttribute('height');
    // Set explicit pixel dimensions matching the viewBox content size
    svgElement.style.width = dims.width + 'px';
    svgElement.style.height = dims.height + 'px';
    svgElement.style.position = 'absolute';
    svgElement.style.transformOrigin = '0 0';

    // Calculate scale to fit with 10% padding
    const scaleX = containerWidth / dims.width;
    const scaleY = containerHeight / dims.height;
    const fitScale = Math.min(scaleX, scaleY) * 0.9;

    // Center the diagram. Panzoom's transform is `scale(S) translate(x, y)`, so
    // the translate is applied in the *pre-scale* coordinate space — a pan of x
    // moves the element S*x pixels on screen. To land the scaled diagram's
    // top-left at the centering offset, divide the pixel gap by the scale.
    const x = (containerWidth / fitScale - dims.width) / 2;
    const y = (containerHeight / fitScale - dims.height) / 2;

    panzoomInstance.zoom(fitScale, { animate: false });
    panzoomInstance.pan(x, y, { animate: false });

    return { scale: fitScale, x: x, y: y };
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

    // Initialize panzoom for fullscreen with wide scale range
    const fullscreenPanzoom = Panzoom(svgClone, {
        maxScale: 20,
        minScale: 0.05,
        step: 0.2,
        cursor: 'grab'
    });

    // Use mutable state for deferred fit recalculation.
    const fullscreenState = {
        homeState: fitDiagramToContainer(fullscreenWrapper, svgClone, fullscreenPanzoom)
    };
    // Panzoom's constructor defers a forced `pan(startX, startY)` (0,0) via a
    // setTimeout(0) to constrain its initial values — that reset fires *after*
    // this synchronous fit and would clobber the centering back to the
    // top-left corner. Re-apply the fit from a setTimeout scheduled here: it was
    // queued after panzoom's (which ran during construction above), so it fires
    // after the reset and wins. A trailing rAF refits once more against the
    // final post-layout container dimensions.
    const applyFit = () => {
        fullscreenState.homeState = fitDiagramToContainer(fullscreenWrapper, svgClone, fullscreenPanzoom);
    };
    setTimeout(() => {
        applyFit();
        requestAnimationFrame(applyFit);
    }, 0);

    // Store for cleanup
    fsOverlay.panzoomInstance = fullscreenPanzoom;
    fsOverlay.diagramId = diagramId;
    fsOverlay.fullscreenState = fullscreenState;

    // Setup fullscreen controls with fresh event listeners
    setupFullscreenControls(fullscreenPanzoom, fullscreenWrapper, fullscreenState);

    if (!isIOSNative) {
        // Setup minimap
        requestAnimationFrame(() => {
            updateMinimap(svgClone);
            updateMinimapViewport(fullscreenPanzoom, fullscreenWrapper);
        });

        // Update minimap viewport on pan/zoom
        svgClone.addEventListener('panzoomchange', () => {
            updateMinimapViewport(fullscreenPanzoom, fullscreenWrapper);
        });
    }

    // Focus for keyboard events
    fsOverlay.focus();
}

/**
 * @param {PanzoomObject} panzoomInstance
 * @param {HTMLElement} wrapper
 * @param {{ homeState: HomeState }} fullscreenState
 */
function setupFullscreenControls(panzoomInstance, wrapper, fullscreenState) {
    const fsOverlay = getFsOverlay();
    if (!fsOverlay) return;
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

    // Add new listeners
    on(newZoomIn, 'click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomIn();
        updateZoomUI(panzoomInstance, controls);
    });

    on(newZoomOut, 'click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomOut();
        updateZoomUI(panzoomInstance, controls);
    });

    on(newReset, 'click', (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, fullscreenState.homeState);
        updateZoomUI(panzoomInstance, controls);
    });

    const newZoomRange = controls.querySelector('.zoom-range');
    on(newZoomRange, 'input', (e) => {
        e.stopPropagation();
        const target = /** @type {HTMLInputElement} */ (e.target);
        const targetPercent = Number(target.value);
        if (!isNaN(targetPercent)) {
            panzoomInstance.zoom(targetPercent / 100);
            updateZoomUI(panzoomInstance, controls);
        }
    });

    on(newExportSvg, 'click', (e) => {
        e.stopPropagation();
        downloadDiagramSvg(fsOverlay.diagramId || '');
    });

    on(newExportPng, 'click', (e) => {
        e.stopPropagation();
        downloadDiagramPng(fsOverlay.diagramId || '');
    });

    on(newShare, 'click', (e) => {
        e.stopPropagation();
        shareDiagramLink(fsOverlay.diagramId || '');
    });

    on(newClose, 'click', (e) => {
        e.stopPropagation();
        closeFullscreen();
    });

    // Mouse wheel zoom - use passive: false to allow preventDefault
    /** @type {EventListener} */
    const wheelHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        panzoomInstance.zoomWithWheel(/** @type {WheelEvent} */ (e));
        updateZoomUI(panzoomInstance, controls);
    };

    wrapper.addEventListener('wheel', wheelHandler, { passive: false });
    fsOverlay.wheelHandler = wheelHandler;

    // Double click to reset to fit
    /** @type {EventListener} */
    const dblClickHandler = (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, fullscreenState.homeState);
        updateZoomUI(panzoomInstance, controls);
    };

    wrapper.addEventListener('dblclick', dblClickHandler);
    fsOverlay.dblClickHandler = dblClickHandler;
    updateZoomUI(panzoomInstance, controls);
}

export function closeFullscreen() {
    const fsOverlay = getFsOverlay();
    if (!fsOverlay) return;

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

    // Clear content
    if (fullscreenWrapper) fullscreenWrapper.innerHTML = '';
    fsOverlay.diagramId = null;
}

// ===========================
// Re-render Mermaid (for theme change)
// ===========================
export async function reRenderMermaidDiagrams() {
    // Shares the generation counter with processMermaidDiagrams: a new document
    // render invalidates an in-flight theme re-render, and vice versa.
    const generation = ++diagramRenderGeneration;
    const root = el('markdown-content');
    if (!root) return;
    // Get all diagram containers
    const containers = root.querySelectorAll('.diagram-container');

    // Nothing to re-theme means no need to pull in the mermaid engine.
    if (containers.length === 0) return;

    // Update mermaid theme (the engine is already loaded if diagrams exist)
    const mermaid = await loadMermaid();
    if (generation !== diagramRenderGeneration) return;
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
            if (generation !== diagramRenderGeneration) return; // superseded mid-render

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
            console.error('Error re-rendering mermaid diagram:', error);
        }
    }
}
