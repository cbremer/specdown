// @ts-check
import Panzoom from '@panzoom/panzoom';
import DOMPurify from 'dompurify';
import { state } from '../core/state.js';
import { isIOSNative } from '../core/platform.js';
import { getSvgNaturalDimensions } from '../core/utils.js';
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
export async function processMermaidDiagrams() {
    const root = el('markdown-content');
    if (!root) return;
    // Find all code blocks with mermaid language
    const codeBlocks = root.querySelectorAll('code.language-mermaid');

    if (codeBlocks.length === 0) return;

    // Load the mermaid engine on demand (this is the only place — plus the theme
    // re-render — that needs it, so documents without diagrams never pay for it).
    const mermaid = await loadMermaid();

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

            // Create diagram container with mermaid source for re-rendering
            const container = createDiagramContainer(svg, diagramId, mermaidCode);

            // Replace pre/code block with diagram container
            if (preElement) preElement.replaceWith(container);

            // Initialize panzoom for this diagram
            initializePanzoom(diagramId);

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

    // Create controls
    const controls = document.createElement('div');
    controls.className = 'diagram-controls';
    controls.innerHTML = `
        <button class="zoom-in" title="Zoom in">+</button>
        <button class="zoom-out" title="Zoom out">-</button>
        <label class="zoom-range-label" title="Zoom level">
            <span class="zoom-percent">100%</span>
            <input class="zoom-range" type="range" min="25" max="400" value="100" step="5" aria-label="Diagram zoom level">
        </label>
        <button class="reset" title="Reset view">⟲</button>
        <button class="export-svg" title="Download as SVG">SVG</button>
        <button class="export-png" title="Download as PNG">PNG</button>
        <button class="share-diagram" title="Copy shareable link">🔗</button>
        <button class="fullscreen" title="Fullscreen">⛶</button>
    `;

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

    container.appendChild(controls);
    container.appendChild(wrapper);

    return container;
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

    // Center the diagram
    const scaledWidth = dims.width * fitScale;
    const scaledHeight = dims.height * fitScale;
    const x = (containerWidth - scaledWidth) / 2;
    const y = (containerHeight - scaledHeight) / 2;

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
// Panzoom Initialization
// ===========================
/** @param {string} diagramId */
function initializePanzoom(diagramId) {
    const wrapper = document.getElementById(`wrapper-${diagramId}`);
    if (!wrapper) return;

    const svgElement = wrapper.querySelector('svg');
    if (!svgElement) return;

    // Initialize panzoom with wide scale range for free navigation
    const panzoomInstance = Panzoom(svgElement, {
        maxScale: 10,
        minScale: 0.1,
        step: 0.2,
        cursor: 'grab'
    });

    // Use a mutable state object so reset always uses the latest fit values.
    // Initial fit runs immediately; a deferred fit via requestAnimationFrame
    // recalculates after the browser has laid out the container (in case
    // clientWidth/Height weren't available synchronously).
    const instanceState = {
        homeState: fitDiagramToContainer(wrapper, svgElement, panzoomInstance)
    };
    requestAnimationFrame(() => {
        instanceState.homeState = fitDiagramToContainer(wrapper, svgElement, panzoomInstance);
    });

    // Store instance for cleanup
    state.currentPanzoomInstances.push({
        id: diagramId,
        instance: panzoomInstance,
        element: svgElement,
        state: instanceState
    });

    // Get controls
    const container = wrapper.closest('.diagram-container');
    if (!container) return;
    const controls = container.querySelector('.diagram-controls');
    if (!controls) return;
    const zoomInBtn = controls.querySelector('.zoom-in');
    const zoomOutBtn = controls.querySelector('.zoom-out');
    const zoomRange = controls.querySelector('.zoom-range');
    const resetBtn = controls.querySelector('.reset');
    const exportSvgBtn = controls.querySelector('.export-svg');
    const exportPngBtn = controls.querySelector('.export-png');
    const shareBtn = controls.querySelector('.share-diagram');
    const fullscreenBtn = controls.querySelector('.fullscreen');

    // Bind control events
    on(zoomInBtn, 'click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomIn();
        updateZoomUI(panzoomInstance, controls);
    });

    on(zoomOutBtn, 'click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomOut();
        updateZoomUI(panzoomInstance, controls);
    });

    on(zoomRange, 'input', (e) => {
        e.stopPropagation();
        const target = /** @type {HTMLInputElement} */ (e.target);
        const targetPercent = Number(target.value);
        if (!isNaN(targetPercent)) {
            panzoomInstance.zoom(targetPercent / 100);
            updateZoomUI(panzoomInstance, controls);
        }
    });

    on(resetBtn, 'click', (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, instanceState.homeState);
        updateZoomUI(panzoomInstance, controls);
    });

    on(exportSvgBtn, 'click', (e) => {
        e.stopPropagation();
        downloadDiagramSvg(diagramId);
    });

    on(exportPngBtn, 'click', (e) => {
        e.stopPropagation();
        downloadDiagramPng(diagramId);
    });

    on(shareBtn, 'click', (e) => {
        e.stopPropagation();
        shareDiagramLink(diagramId);
    });

    on(fullscreenBtn, 'click', (e) => {
        e.stopPropagation();
        openFullscreen(diagramId);
    });

    // Mouse wheel zoom
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        panzoomInstance.zoomWithWheel(e);
        updateZoomUI(panzoomInstance, controls);
    }, { passive: false });

    // Double click to reset to fit
    wrapper.addEventListener('dblclick', () => {
        resetToFit(panzoomInstance, instanceState.homeState);
        updateZoomUI(panzoomInstance, controls);
    });
    updateZoomUI(panzoomInstance, controls);
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

    // Use mutable state for deferred fit recalculation
    const fullscreenState = {
        homeState: fitDiagramToContainer(fullscreenWrapper, svgClone, fullscreenPanzoom)
    };
    requestAnimationFrame(() => {
        fullscreenState.homeState = fitDiagramToContainer(fullscreenWrapper, svgClone, fullscreenPanzoom);
    });

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
    const newClose = closeBtn.cloneNode(true);

    zoomInBtn.replaceWith(newZoomIn);
    zoomOutBtn.replaceWith(newZoomOut);
    resetBtn.replaceWith(newReset);
    if (zoomRangeLabel && newZoomRangeLabel) zoomRangeLabel.replaceWith(newZoomRangeLabel);
    if (exportSvgBtn && newExportSvg) exportSvgBtn.replaceWith(newExportSvg);
    if (exportPngBtn && newExportPng) exportPngBtn.replaceWith(newExportPng);
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
// Cleanup
// ===========================
export function cleanupPanzoomInstances() {
    state.currentPanzoomInstances.forEach(({ instance }) => {
        try {
            instance.destroy();
        } catch (error) {
            console.error('Error destroying panzoom instance:', error);
        }
    });
    state.currentPanzoomInstances = [];
}

// ===========================
// Re-render Mermaid (for theme change)
// ===========================
export async function reRenderMermaidDiagrams() {
    const root = el('markdown-content');
    if (!root) return;
    // Get all diagram containers
    const containers = root.querySelectorAll('.diagram-container');

    // Nothing to re-theme means no need to pull in the mermaid engine.
    if (containers.length === 0) return;

    // Update mermaid theme (the engine is already loaded if diagrams exist)
    const mermaid = await loadMermaid();
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

            // Clean up old panzoom
            const oldInstance = state.currentPanzoomInstances.find((p) => p.id === diagramId);
            if (oldInstance) {
                oldInstance.instance.destroy();
                state.currentPanzoomInstances = state.currentPanzoomInstances.filter((p) => p.id !== diagramId);
            }

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

            // Re-initialize panzoom
            initializePanzoom(diagramId);

        } catch (error) {
            console.error('Error re-rendering mermaid diagram:', error);
        }
    }
}
