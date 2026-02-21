// ===========================
// Constants
// ===========================
const VALID_EXTENSIONS = ['.md', '.markdown'];
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const APP_VERSION = '0.0.43';
const APP_VERSION_LABEL = 'alpha';
const SOURCE_REPO = 'cbremer/specdown';
const SOURCE_REPO_URL = 'https://github.com/' + SOURCE_REPO;

// ===========================
// Global State
// ===========================
let currentPanzoomInstances = [];
let currentTheme = localStorage.getItem('theme') || 'light';
let currentRawMarkdown = '';
let currentViewMode = 'preview'; // 'preview' or 'raw'

// ===========================
// DOM Elements
// ===========================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseButton = document.getElementById('browse-button');
const contentArea = document.getElementById('content-area');
const markdownContent = document.getElementById('markdown-content');
const fileName = document.getElementById('file-name');
const loadNewFileButton = document.getElementById('load-new-file');
const themeToggle = document.getElementById('theme-toggle');
const fullscreenOverlay = document.getElementById('fullscreen-overlay');
const viewToggle = document.getElementById('view-toggle');

// ===========================
// Initialization
// ===========================
function init() {
    setupVersionInfo();
    setupTheme();
    setupEventListeners();
    configureMermaid();
    configureMarked();
    checkForUpdates();
}

// ===========================
// Version Info
// ===========================
function setupVersionInfo() {
    var versionLabel = document.getElementById('version-label');
    if (versionLabel) {
        versionLabel.textContent = 'v' + APP_VERSION + ' (' + APP_VERSION_LABEL + ')';
    }
}

// ===========================
// Version Check
// ===========================
function checkForUpdates() {
    const apiUrl = 'https://api.github.com/repos/' + SOURCE_REPO + '/releases/latest';
    fetch(apiUrl)
        .then(function(response) {
            if (!response.ok) return null;
            return response.json();
        })
        .then(function(data) {
            if (!data || !data.tag_name) return;
            const latest = data.tag_name.replace(/^v/, '');
            if (latest !== APP_VERSION) {
                const updateEl = document.getElementById('version-update');
                if (updateEl) {
                    const releaseUrl = data.html_url || SOURCE_REPO_URL + '/releases/latest';
                    updateEl.innerHTML = '<a href="' + releaseUrl + '" target="_blank" rel="noopener noreferrer">v' + latest + ' available</a>';
                    updateEl.style.display = '';
                }
            }
        })
        .catch(function() {
            // Version check is non-critical; silently ignore failures
        });
}

// ===========================
// Theme Management
// ===========================
function setupTheme() {
    document.documentElement.setAttribute('data-theme', currentTheme);
    updateThemeIcon();
}

function toggleTheme() {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon();
    
    // Re-render mermaid diagrams with new theme
    if (contentArea.style.display !== 'none') {
        reRenderMermaidDiagrams();
    }
}

function updateThemeIcon() {
    const icon = themeToggle.querySelector('.theme-icon');
    icon.textContent = currentTheme === 'light' ? '🌙' : '☀️';
}

// ===========================
// View Mode Toggle
// ===========================
function toggleViewMode() {
    if (!currentRawMarkdown) return;

    if (currentViewMode === 'preview') {
        currentViewMode = 'raw';
        // Clean up panzoom before switching
        cleanupPanzoomInstances();
        // Show raw markdown in a pre/code block
        const escaped = currentRawMarkdown
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        markdownContent.innerHTML = '<pre class="raw-markdown"><code>' + escaped + '</code></pre>';
    } else {
        currentViewMode = 'preview';
        // Re-render the preview
        renderMarkdown(currentRawMarkdown, fileName.textContent);
        return; // renderMarkdown handles the rest
    }
    updateViewToggleButton();
}

function updateViewToggleButton() {
    const label = viewToggle.querySelector('.view-toggle-label');
    const icon = viewToggle.querySelector('.view-toggle-icon');
    if (currentViewMode === 'preview') {
        label.textContent = 'Raw';
        icon.innerHTML = '&lt;/&gt;';
        viewToggle.classList.remove('active');
    } else {
        label.textContent = 'Preview';
        icon.innerHTML = '&#9664;';
        viewToggle.classList.add('active');
    }
}

// ===========================
// Event Listeners
// ===========================
function setupEventListeners() {
    // Browse button - stopPropagation prevents the dropZone click handler
    // from calling fileInput.click() a second time (button is inside drop-zone-content)
    browseButton.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });
    
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    dropZone.addEventListener('click', (e) => {
        if (e.target === dropZone || e.target.closest('.drop-zone-content')) {
            fileInput.click();
        }
    });
    
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // Load new file button
    loadNewFileButton.addEventListener('click', showDropZone);
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // View toggle (preview/raw)
    viewToggle.addEventListener('click', toggleViewMode);
    
    // Fullscreen overlay close
    fullscreenOverlay.addEventListener('click', (e) => {
        if (e.target === fullscreenOverlay) {
            closeFullscreen();
        }
    });
    
    // ESC key to close fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fullscreenOverlay.style.display !== 'none') {
            closeFullscreen();
        }
    });
    
    // Prevent default drag behavior on document
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());
}

// ===========================
// Drag and Drop Handlers
// ===========================
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('drag-over');
    }
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// ===========================
// File Processing
// ===========================
function handleFile(file) {
    // Validate file type
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!VALID_EXTENSIONS.includes(fileExtension)) {
        alert('Please select a valid Markdown file (.md or .markdown)');
        return;
    }
    
    // Read file
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        renderMarkdown(content, file.name);
    };
    reader.onerror = () => {
        alert('Error reading file. Please try again.');
    };
    reader.readAsText(file);
}

// ===========================
// Markdown Configuration
// ===========================
function configureMarked() {
    // Configure marked with custom renderer for syntax highlighting
    // Use marked.use() which properly integrates overrides without
    // replacing the entire renderer instance.
    marked.use({
        breaks: true,
        gfm: true,
        renderer: {
            code(code, lang) {
                // Guard against non-string code or missing hljs
                if (typeof code !== 'string') return false;
                if (lang && typeof hljs !== 'undefined' && hljs.getLanguage(lang)) {
                    try {
                        const highlighted = hljs.highlight(code, { language: lang }).value;
                        return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
                    } catch (err) {
                        console.error('Highlight error:', err);
                    }
                }
                const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                return `<pre><code class="language-${lang || ''}">${escaped}</code></pre>`;
            }
        }
    });
}

// ===========================
// Mermaid Configuration
// ===========================
function getMermaidConfig() {
    return {
        startOnLoad: false,
        theme: currentTheme === 'dark' ? 'dark' : 'default',
        securityLevel: 'strict',
        fontFamily: FONT_FAMILY
    };
}

function configureMermaid() {
    mermaid.initialize(getMermaidConfig());
}

// ===========================
// Markdown Rendering
// ===========================
async function renderMarkdown(content, filename) {
    try {
        // Clean up existing panzoom instances
        cleanupPanzoomInstances();

        // Store raw markdown for toggle
        currentRawMarkdown = content;
        currentViewMode = 'preview';
        updateViewToggleButton();

        // Parse markdown to HTML
        const htmlContent = marked.parse(content);

        // Update UI
        fileName.textContent = filename;
        markdownContent.innerHTML = htmlContent;
        
        // Show content area, hide drop zone
        dropZone.style.display = 'none';
        contentArea.style.display = 'flex';
        
        // Process mermaid diagrams
        await processMermaidDiagrams();
        
        // Scroll to top
        markdownContent.scrollTop = 0;
        
    } catch (error) {
        console.error('Error rendering markdown:', error);
        alert('Error rendering markdown content. Please check the file format.');
    }
}

// ===========================
// Mermaid Diagram Processing
// ===========================
async function processMermaidDiagrams() {
    // Find all code blocks with mermaid language
    const codeBlocks = markdownContent.querySelectorAll('code.language-mermaid');
    
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
        <button class="reset" title="Reset view">⟲</button>
        <button class="fullscreen" title="Fullscreen">⛶</button>
    `;
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'diagram-wrapper';
    wrapper.id = `wrapper-${diagramId}`;
    wrapper.innerHTML = svg;

    // Store mermaid source on the SVG for theme re-rendering
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
function getSvgNaturalDimensions(svgElement) {
    // SVG viewBox format: "min-x min-y width height"
    // The 3rd and 4th values ARE the width and height (not coordinates)
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
        const parts = viewBox.split(/[\s,]+/);
        if (parts.length >= 4) {
            const w = parseFloat(parts[2]);
            const h = parseFloat(parts[3]);
            if (w > 0 && h > 0) {
                return { width: w, height: h };
            }
        }
    }
    // Fall back to width/height attributes (skip percentage values like "100%")
    const wAttr = svgElement.getAttribute('width');
    const hAttr = svgElement.getAttribute('height');
    if (wAttr && hAttr && !String(wAttr).includes('%') && !String(hAttr).includes('%')) {
        const w = parseFloat(wAttr);
        const h = parseFloat(hAttr);
        if (w > 0 && h > 0 && !isNaN(w) && !isNaN(h)) {
            return { width: w, height: h };
        }
    }
    return null;
}

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

function resetToFit(panzoomInstance, homeState) {
    panzoomInstance.zoom(homeState.scale, { animate: true });
    panzoomInstance.pan(homeState.x, homeState.y, { animate: true });
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
    const state = {
        homeState: fitDiagramToContainer(wrapper, svgElement, panzoomInstance)
    };
    requestAnimationFrame(() => {
        state.homeState = fitDiagramToContainer(wrapper, svgElement, panzoomInstance);
    });

    // Store instance for cleanup
    currentPanzoomInstances.push({
        id: diagramId,
        instance: panzoomInstance,
        element: svgElement,
        state: state
    });

    // Get controls
    const container = wrapper.closest('.diagram-container');
    const controls = container.querySelector('.diagram-controls');
    const zoomInBtn = controls.querySelector('.zoom-in');
    const zoomOutBtn = controls.querySelector('.zoom-out');
    const resetBtn = controls.querySelector('.reset');
    const fullscreenBtn = controls.querySelector('.fullscreen');

    // Bind control events
    zoomInBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomIn();
    });

    zoomOutBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomOut();
    });

    resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, state.homeState);
    });

    fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openFullscreen(diagramId);
    });

    // Mouse wheel zoom
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        panzoomInstance.zoomWithWheel(e);
    }, { passive: false });

    // Double click to reset to fit
    wrapper.addEventListener('dblclick', () => {
        resetToFit(panzoomInstance, state.homeState);
    });
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
    const fullscreenWrapper = fullscreenOverlay.querySelector('.fullscreen-diagram-wrapper');
    fullscreenWrapper.innerHTML = '';
    fullscreenWrapper.appendChild(svgClone);

    // Show fullscreen first so container dimensions are available for fit calculation
    fullscreenOverlay.style.display = 'flex';

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
    fullscreenOverlay.panzoomInstance = fullscreenPanzoom;
    fullscreenOverlay.diagramId = diagramId;
    fullscreenOverlay.fullscreenState = fullscreenState;

    // Setup fullscreen controls with fresh event listeners
    setupFullscreenControls(fullscreenPanzoom, fullscreenWrapper, fullscreenState);

    // Focus for keyboard events
    fullscreenOverlay.focus();
}

function setupFullscreenControls(panzoomInstance, wrapper, fullscreenState) {
    const controls = fullscreenOverlay.querySelector('.fullscreen-controls');
    const zoomInBtn = controls.querySelector('.zoom-in');
    const zoomOutBtn = controls.querySelector('.zoom-out');
    const resetBtn = controls.querySelector('.reset');
    const closeBtn = controls.querySelector('.close-fullscreen');

    // Remove old listeners by cloning
    const newZoomIn = zoomInBtn.cloneNode(true);
    const newZoomOut = zoomOutBtn.cloneNode(true);
    const newReset = resetBtn.cloneNode(true);
    const newClose = closeBtn.cloneNode(true);

    zoomInBtn.replaceWith(newZoomIn);
    zoomOutBtn.replaceWith(newZoomOut);
    resetBtn.replaceWith(newReset);
    closeBtn.replaceWith(newClose);

    // Add new listeners
    newZoomIn.addEventListener('click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomIn();
    });

    newZoomOut.addEventListener('click', (e) => {
        e.stopPropagation();
        panzoomInstance.zoomOut();
    });

    newReset.addEventListener('click', (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, fullscreenState.homeState);
    });

    newClose.addEventListener('click', (e) => {
        e.stopPropagation();
        closeFullscreen();
    });

    // Mouse wheel zoom - use passive: false to allow preventDefault
    const wheelHandler = (e) => {
        e.preventDefault();
        e.stopPropagation();
        panzoomInstance.zoomWithWheel(e);
    };

    wrapper.addEventListener('wheel', wheelHandler, { passive: false });
    fullscreenOverlay.wheelHandler = wheelHandler;

    // Double click to reset to fit
    const dblClickHandler = (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, fullscreenState.homeState);
    };

    wrapper.addEventListener('dblclick', dblClickHandler);
    fullscreenOverlay.dblClickHandler = dblClickHandler;
}

function closeFullscreen() {
    // Cleanup panzoom instance
    if (fullscreenOverlay.panzoomInstance) {
        try {
            fullscreenOverlay.panzoomInstance.destroy();
        } catch (error) {
            console.error('Error destroying fullscreen panzoom:', error);
        }
        fullscreenOverlay.panzoomInstance = null;
    }
    
    // Remove event handlers
    const fullscreenWrapper = fullscreenOverlay.querySelector('.fullscreen-diagram-wrapper');
    
    if (fullscreenOverlay.wheelHandler) {
        fullscreenWrapper.removeEventListener('wheel', fullscreenOverlay.wheelHandler, { passive: false });
        fullscreenOverlay.wheelHandler = null;
    }
    
    if (fullscreenOverlay.dblClickHandler) {
        fullscreenWrapper.removeEventListener('dblclick', fullscreenOverlay.dblClickHandler);
        fullscreenOverlay.dblClickHandler = null;
    }
    
    // Hide fullscreen
    fullscreenOverlay.style.display = 'none';
    
    // Clear content
    fullscreenWrapper.innerHTML = '';
    fullscreenOverlay.diagramId = null;
}

// ===========================
// Cleanup
// ===========================
function cleanupPanzoomInstances() {
    currentPanzoomInstances.forEach(({ instance }) => {
        try {
            instance.destroy();
        } catch (error) {
            console.error('Error destroying panzoom instance:', error);
        }
    });
    currentPanzoomInstances = [];
}

function showDropZone() {
    // Cleanup
    cleanupPanzoomInstances();
    closeFullscreen();

    // Clear content
    markdownContent.innerHTML = '';
    fileName.textContent = '';
    fileInput.value = '';
    currentRawMarkdown = '';
    currentViewMode = 'preview';
    updateViewToggleButton();
    
    // Show drop zone, hide content
    contentArea.style.display = 'none';
    dropZone.style.display = 'flex';
}

// ===========================
// Re-render Mermaid (for theme change)
// ===========================
async function reRenderMermaidDiagrams() {
    // Update mermaid theme
    mermaid.initialize(getMermaidConfig());
    
    // Get all diagram containers
    const containers = markdownContent.querySelectorAll('.diagram-container');
    
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
            const oldInstance = currentPanzoomInstances.find(p => p.id === diagramId);
            if (oldInstance) {
                oldInstance.instance.destroy();
                currentPanzoomInstances = currentPanzoomInstances.filter(p => p.id !== diagramId);
            }

            // Update wrapper content
            wrapper.innerHTML = svg;

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

// ===========================
// Initialize App
// ===========================
init();
