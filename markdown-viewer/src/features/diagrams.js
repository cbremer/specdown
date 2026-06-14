import Panzoom from '@panzoom/panzoom';
import mermaid from 'mermaid';
import DOMPurify from 'dompurify';
import { state } from '../core/state.js';
import { isIOSNative } from '../core/platform.js';
import { getSvgNaturalDimensions } from '../core/utils.js';
import { getMermaidConfig } from '../core/render-config.js';
import { updateMinimap, updateMinimapViewport } from './minimap.js';
import { downloadDiagramSvg, downloadDiagramPng } from './diagram-export.js';
import { shareDiagramLink } from './share-links.js';

const el = (id) => document.getElementById(id);

// ===========================
// Mermaid Diagram Processing
// ===========================
export async function processMermaidDiagrams() {
    // Find all code blocks with mermaid language
    const codeBlocks = el('markdown-content').querySelectorAll('code.language-mermaid');

    if (codeBlocks.length === 0) return;

    // Process each mermaid diagram
    for (let i = 0; i < codeBlocks.length; i++) {
        const codeBlock = codeBlocks[i];
        const mermaidCode = codeBlock.textContent;
        const preElement = codeBlock.parentElement;

        try {
            // Generate unique ID
            const diagramId = `mermaid-diagram-${i}-${Date.now()}`;

            // Render mermaid diagram
            const { svg } = await mermaid.render(diagramId, mermaidCode);

            // Create diagram container with mermaid source for re-rendering
            const container = createDiagramContainer(svg, diagramId, mermaidCode);

            // Replace pre/code block with diagram container
            preElement.replaceWith(container);

            // Initialize panzoom for this diagram
            initializePanzoom(diagramId);

        } catch (error) {
            console.error('Error rendering mermaid diagram:', error);
            // Keep the original code block on error
            const errorDiv = document.createElement('div');
            errorDiv.className = 'mermaid-error';
            errorDiv.style.cssText = 'color: red; padding: 1rem; border: 1px solid red; border-radius: 4px; margin: 1rem 0;';
            errorDiv.textContent = `Error rendering diagram: ${error.message}`;
            preElement.parentElement.insertBefore(errorDiv, preElement);
        }
    }
}

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

export function resetToFit(panzoomInstance, homeState) {
    panzoomInstance.zoom(homeState.scale, { animate: true });
    panzoomInstance.pan(homeState.x, homeState.y, { animate: true });
}

export function updateZoomUI(panzoomInstance, controlsRoot) {
    if (!panzoomInstance || !controlsRoot) return;
    const percentEl = controlsRoot.querySelector('.zoom-percent');
    const rangeEl = controlsRoot.querySelector('.zoom-range');
    if (!percentEl || !rangeEl) return;
    const zoomPercent = Math.max(25, Math.min(400, Math.round(panzoomInstance.getScale() * 100)));
    percentEl.textContent = `${zoomPercent}%`;
    rangeEl.value = String(zoomPercent);
}

// ===========================
// Panzoom Initialization
// ===========================
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
    const controls = container.querySelector('.diagram-controls');
    const zoomInBtn = controls.querySelector('.zoom-in');
    const zoomOutBtn = controls.querySelector('.zoom-out');
    const zoomRange = controls.querySelector('.zoom-range');
    const resetBtn = controls.querySelector('.reset');
    const exportSvgBtn = controls.querySelector('.export-svg');
    const exportPngBtn = controls.querySelector('.export-png');
    const shareBtn = controls.querySelector('.share-diagram');
    const fullscreenBtn = controls.querySelector('.fullscreen');

    // Bind control events
    zoomInBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomIn();
        updateZoomUI(panzoomInstance, controls);
    });

    zoomOutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomOut();
        updateZoomUI(panzoomInstance, controls);
    });

    if (zoomRange) {
        zoomRange.addEventListener('input', (e) => {
            e.stopPropagation();
            const targetPercent = Number(e.target.value);
            if (!isNaN(targetPercent)) {
                panzoomInstance.zoom(targetPercent / 100);
                updateZoomUI(panzoomInstance, controls);
            }
        });
    }

    resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, instanceState.homeState);
        updateZoomUI(panzoomInstance, controls);
    });

    if (exportSvgBtn) {
        exportSvgBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadDiagramSvg(diagramId);
        });
    }

    if (exportPngBtn) {
        exportPngBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadDiagramPng(diagramId);
        });
    }

    if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            shareDiagramLink(diagramId);
        });
    }

    fullscreenBtn.addEventListener('click', (e) => {
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

    // Clone SVG for fullscreen - use original mermaid source SVG attributes
    const svgClone = svgElement.cloneNode(true);

    // Setup fullscreen wrapper
    const fullscreenWrapper = el('fullscreen-overlay').querySelector('.fullscreen-diagram-wrapper');
    fullscreenWrapper.innerHTML = '';
    fullscreenWrapper.appendChild(svgClone);

    // Show fullscreen first so container dimensions are available for fit calculation
    el('fullscreen-overlay').style.display = 'flex';

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
    el('fullscreen-overlay').panzoomInstance = fullscreenPanzoom;
    el('fullscreen-overlay').diagramId = diagramId;
    el('fullscreen-overlay').fullscreenState = fullscreenState;

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
    el('fullscreen-overlay').focus();
}

function setupFullscreenControls(panzoomInstance, wrapper, fullscreenState) {
    const controls = el('fullscreen-overlay').querySelector('.fullscreen-controls');
    const zoomInBtn = controls.querySelector('.zoom-in');
    const zoomOutBtn = controls.querySelector('.zoom-out');
    const zoomRange = controls.querySelector('.zoom-range');
    const resetBtn = controls.querySelector('.reset');
    const exportSvgBtn = controls.querySelector('.export-svg');
    const exportPngBtn = controls.querySelector('.export-png');
    const closeBtn = controls.querySelector('.close-fullscreen');

    // Remove old listeners by cloning
    const newZoomIn = zoomInBtn.cloneNode(true);
    const newZoomOut = zoomOutBtn.cloneNode(true);
    const newReset = resetBtn.cloneNode(true);
    const newZoomRangeLabel = zoomRange ? zoomRange.closest('.zoom-range-label').cloneNode(true) : null;
    const newExportSvg = exportSvgBtn ? exportSvgBtn.cloneNode(true) : null;
    const newExportPng = exportPngBtn ? exportPngBtn.cloneNode(true) : null;
    const newClose = closeBtn.cloneNode(true);

    zoomInBtn.replaceWith(newZoomIn);
    zoomOutBtn.replaceWith(newZoomOut);
    resetBtn.replaceWith(newReset);
    if (zoomRange && newZoomRangeLabel) zoomRange.closest('.zoom-range-label').replaceWith(newZoomRangeLabel);
    if (exportSvgBtn && newExportSvg) exportSvgBtn.replaceWith(newExportSvg);
    if (exportPngBtn && newExportPng) exportPngBtn.replaceWith(newExportPng);
    closeBtn.replaceWith(newClose);

    // Add new listeners
    newZoomIn.addEventListener('click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomIn();
        updateZoomUI(panzoomInstance, controls);
    });

    newZoomOut.addEventListener('click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomOut();
        updateZoomUI(panzoomInstance, controls);
    });

    newReset.addEventListener('click', (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, fullscreenState.homeState);
        updateZoomUI(panzoomInstance, controls);
    });

    const newZoomRange = controls.querySelector('.zoom-range');
    if (newZoomRange) {
        newZoomRange.addEventListener('input', (e) => {
            e.stopPropagation();
            const targetPercent = Number(e.target.value);
            if (!isNaN(targetPercent)) {
                panzoomInstance.zoom(targetPercent / 100);
                updateZoomUI(panzoomInstance, controls);
            }
        });
    }

    if (newExportSvg) {
        newExportSvg.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadDiagramSvg(el('fullscreen-overlay').diagramId);
        });
    }

    if (newExportPng) {
        newExportPng.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadDiagramPng(el('fullscreen-overlay').diagramId);
        });
    }

    newClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFullscreen();
    });

    // Mouse wheel zoom - use passive: false to allow preventDefault
    const wheelHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        panzoomInstance.zoomWithWheel(e);
        updateZoomUI(panzoomInstance, controls);
    };

    wrapper.addEventListener('wheel', wheelHandler, { passive: false });
    el('fullscreen-overlay').wheelHandler = wheelHandler;

    // Double click to reset to fit
    const dblClickHandler = (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, fullscreenState.homeState);
        updateZoomUI(panzoomInstance, controls);
    };

    wrapper.addEventListener('dblclick', dblClickHandler);
    el('fullscreen-overlay').dblClickHandler = dblClickHandler;
    updateZoomUI(panzoomInstance, controls);
}

export function closeFullscreen() {
    // Cleanup panzoom instance
    if (el('fullscreen-overlay').panzoomInstance) {
        try {
            el('fullscreen-overlay').panzoomInstance.destroy();
        } catch (error) {
            console.error('Error destroying fullscreen panzoom:', error);
        }
        el('fullscreen-overlay').panzoomInstance = null;
    }

    // Remove event handlers
    const fullscreenWrapper = el('fullscreen-overlay').querySelector('.fullscreen-diagram-wrapper');

    if (el('fullscreen-overlay').wheelHandler) {
        fullscreenWrapper.removeEventListener('wheel', el('fullscreen-overlay').wheelHandler, { passive: false });
        el('fullscreen-overlay').wheelHandler = null;
    }

    if (el('fullscreen-overlay').dblClickHandler) {
        fullscreenWrapper.removeEventListener('dblclick', el('fullscreen-overlay').dblClickHandler);
        el('fullscreen-overlay').dblClickHandler = null;
    }

    // Hide fullscreen
    el('fullscreen-overlay').style.display = 'none';

    // Clear content
    fullscreenWrapper.innerHTML = '';
    el('fullscreen-overlay').diagramId = null;
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
    // Update mermaid theme
    mermaid.initialize(getMermaidConfig());

    // Get all diagram containers
    const containers = el('markdown-content').querySelectorAll('.diagram-container');

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
            const oldInstance = state.currentPanzoomInstances.find(p => p.id === diagramId);
            if (oldInstance) {
                oldInstance.instance.destroy();
                state.currentPanzoomInstances = state.currentPanzoomInstances.filter(p => p.id !== diagramId);
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
