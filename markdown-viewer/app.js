// ===========================
// Constants
// ===========================
const VALID_EXTENSIONS = ['.md', '.markdown'];
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const APP_VERSION = '0.0.66';
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

// Tab state
let tabs = [];         // Array of { id, filename, filePath, rawMarkdown, viewMode, scrollTop, watching }
let activeTabId = null;
let nextTabId = 0;
const MAX_TABS = 10;
const watchRefCounts = new Map(); // filePath -> number of watching tabs

// Desktop detection
const isDesktop = !!(typeof window !== 'undefined' && window.specdown && window.specdown.isDesktop);

// TOC state
let tocVisible = false;

// Split view state
let splitViewActive = false;

// Search state
let searchMatches = [];
let searchCurrentIndex = -1;
let searchHighlightNodes = [];

// ===========================
// DOM Elements
// ===========================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseButton = document.getElementById('browse-button');
const contentArea = document.getElementById('content-area');
const markdownContent = document.getElementById('markdown-content');
const fileName = document.getElementById('file-name');
const tabBar = document.getElementById('tab-bar');
const themeToggle = document.getElementById('theme-toggle');
const fullscreenOverlay = document.getElementById('fullscreen-overlay');
const viewToggle = document.getElementById('view-toggle');
const watchToggle = document.getElementById('watch-toggle');
const urlInput = document.getElementById('url-input');
const openUrlBtn = document.getElementById('open-url-btn');
const urlError = document.getElementById('url-error');
const tocToggle = document.getElementById('toc-toggle');
const annotationToggle = document.getElementById('annotation-toggle');
const tocSidebar = document.getElementById('toc-sidebar');
const tocNav = document.getElementById('toc-nav');
const splitToggle = document.getElementById('split-toggle');
const splitRawPane = document.getElementById('split-raw-pane');
const splitRawContent = document.getElementById('split-raw-content');
const printButton = document.getElementById('print-button');
const searchBar = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');
const searchCount = document.getElementById('search-count');
const searchPrev = document.getElementById('search-prev');
const searchNext = document.getElementById('search-next');
const searchClose = document.getElementById('search-close');
const shareToast = document.getElementById('share-toast');

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
    checkForDiagramLink();
    if (isDesktop) {
        setupDesktopIPC();
    }
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

// iOS API: called by Swift shell to set theme externally
window.setTheme = function(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon();
    if (contentArea && contentArea.style.display !== 'none') {
        reRenderMermaidDiagrams();
    }
};

// iOS API: called by Swift shell to load a file (Session 2+)
window.loadFileContent = function(content, filename) {
    renderMarkdown(content, filename);
};

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

    // Persist view mode to active tab state
    if (activeTabId !== null) {
        const tab = tabs.find(t => t.id === activeTabId);
        if (tab) tab.viewMode = currentViewMode;
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
    function requestNativeOpenIfDesktop() {
        if (isDesktop && window.specdown && window.specdown.requestFileOpen) {
            window.specdown.requestFileOpen();
            return true;
        }
        return false;
    }

    // Browse button - stopPropagation prevents the dropZone click handler
    // from calling fileInput.click() a second time (button is inside drop-zone-content)
    browseButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (requestNativeOpenIfDesktop()) return;
        fileInput.click();
    });

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    dropZone.addEventListener('click', (e) => {
        if (e.target.closest && e.target.closest('.url-section')) return;
        if (e.target === dropZone || e.target.closest('.drop-zone-content')) {
            if (requestNativeOpenIfDesktop()) return;
            fileInput.click();
        }
    });

    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // View toggle (preview/raw)
    viewToggle.addEventListener('click', toggleViewMode);

    // TOC toggle
    if (tocToggle) {
        tocToggle.addEventListener('click', toggleToc);
    }

    // Annotation toggle
    if (annotationToggle) {
        annotationToggle.addEventListener('click', toggleAnnotationMode);
    }

    // Split view toggle
    if (splitToggle) {
        splitToggle.addEventListener('click', toggleSplitView);
    }

    // Print button
    if (printButton) {
        printButton.addEventListener('click', () => window.print());
    }

    // Search bar events
    if (searchInput) {
        searchInput.addEventListener('input', () => runSearch(searchInput.value));
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.shiftKey ? navigateSearch(-1) : navigateSearch(1);
            } else if (e.key === 'Escape') {
                closeSearch();
            }
        });
    }
    if (searchPrev) searchPrev.addEventListener('click', () => navigateSearch(-1));
    if (searchNext) searchNext.addEventListener('click', () => navigateSearch(1));
    if (searchClose) searchClose.addEventListener('click', closeSearch);

    // Fullscreen overlay close
    fullscreenOverlay.addEventListener('click', (e) => {
        if (e.target === fullscreenOverlay) {
            closeFullscreen();
        }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // ESC
        if (e.key === 'Escape') {
            if (fullscreenOverlay.style.display !== 'none') {
                closeFullscreen();
            } else if (searchBar && searchBar.style.display !== 'none') {
                closeSearch();
            }
            return;
        }
        // Cmd/Ctrl+F — open search
        if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
            if (contentArea.style.display !== 'none') {
                e.preventDefault();
                openSearch();
            }
            return;
        }
        // Cmd/Ctrl+P — print
        if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
            if (contentArea.style.display !== 'none') {
                e.preventDefault();
                window.print();
            }
        }
    });

    // URL input
    if (openUrlBtn) {
        openUrlBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleUrl(urlInput ? urlInput.value.trim() : '');
        });
    }
    if (urlInput) {
        urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleUrl(urlInput.value.trim());
        });
        urlInput.addEventListener('click', (e) => e.stopPropagation());
    }

    // Prevent default drag behavior on document
    document.addEventListener('dragover', (e) => e.preventDefault());

    // Document-level drop: open files as new tabs when tabs are already open.
    // When the drop zone is visible its handler fires first and calls
    // stopPropagation(), so this listener is only reached for drops on the
    // content area (when the drop zone is hidden).
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        if (tabs.length > 0 && e.dataTransfer && e.dataTransfer.files.length > 0) {
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
                handleFile(e.dataTransfer.files[i]);
            }
        }
    });

    // TOC scroll spy
    markdownContent.addEventListener('scroll', updateTocActiveHeading);
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
    for (let i = 0; i < files.length; i++) {
        handleFile(files[i]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    for (let i = 0; i < files.length; i++) {
        handleFile(files[i]);
    }
    // Reset so the same file can be re-opened in a new tab
    if (e.target && 'value' in e.target) {
        e.target.value = '';
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

    // Read file and open in a new tab
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = e.target.result;
        createTab(file.name, content, file.path || null);
    };
    reader.onerror = () => {
        alert('Error reading file. Please try again.');
    };
    reader.readAsText(file);
}

// ===========================
// URL Loading
// ===========================
function normalizeMarkdownUrl(url) {
    // Match GitHub-style blob URLs on any host (supports github.com and GitHub Enterprise)
    // Pattern: https://<host>/<owner>/<repo>/blob/<ref>/<path>
    const githubBlobPattern = /^(https?):\/\/([^/]+)\/([^/]+)\/([^/]+)\/blob\/(.+)$/;
    const match = url.match(githubBlobPattern);
    if (match) {
        var protocol = match[1];
        var host = match[2];
        var owner = match[3];
        var repo = match[4];
        var rest = match[5];

        // github.com uses a dedicated raw content host
        if (host === 'github.com') {
            return 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + rest;
        }
        // GitHub Enterprise uses /raw/ instead of /blob/ on the same host
        return protocol + '://' + host + '/' + owner + '/' + repo + '/raw/' + rest;
    }
    return url;
}

function getFilenameFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const segments = pathname.split('/').filter(function(s) { return s.length > 0; });
        if (segments.length > 0) {
            return segments[segments.length - 1];
        }
    } catch (e) {
        // ignore invalid URL
    }
    return 'untitled.md';
}

function showUrlError(message) {
    if (!urlError) return;
    urlError.textContent = message;
    urlError.style.display = '';
}

function clearUrlError() {
    if (!urlError) return;
    urlError.style.display = 'none';
    urlError.textContent = '';
}

async function handleUrl(url) {
    clearUrlError();

    if (!url || !/^https?:\/\//.test(url)) {
        showUrlError('Please enter a valid URL starting with http:// or https://');
        return;
    }

    // Check if this is a GitHub repo URL to show the file browser
    const isRepoBrowserUrl = /^https?:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(url);
    if (isRepoBrowserUrl) {
        const handled = await handleRepoUrl(url);
        if (handled) {
            if (urlInput) urlInput.value = '';
            return;
        }
    }

    const fetchUrl = normalizeMarkdownUrl(url);
    const filename = getFilenameFromUrl(url);

    try {
        const response = await fetch(fetchUrl, { credentials: 'include' });
        if (!response.ok) {
            showUrlError('Failed to fetch URL: HTTP ' + response.status);
            return;
        }
        const markdown = await response.text();
        if (urlInput) urlInput.value = '';
        createTab(filename, markdown);
    } catch (e) {
        showUrlError('Could not fetch URL — the server may not allow cross-origin requests. Try using the raw file URL.');
    }
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

        // Make HTML comments visible
        revealHtmlComments(markdownContent);

        // Show content area, hide drop zone
        dropZone.style.display = 'none';
        contentArea.style.display = 'flex';

        // Process mermaid diagrams
        await processMermaidDiagrams();

        // Refresh TOC
        buildToc();

        // Update split raw pane if active
        if (splitViewActive) {
            updateSplitRawPane(content);
        }

        // Clear any active search
        clearSearchHighlights();

        // Render annotations for this document
        renderAnnotations(filename);
        if (annotationMode) attachAnnotationHandlers();

        // Scroll to top
        markdownContent.scrollTop = 0;

    } catch (error) {
        console.error('Error rendering markdown:', error);
        alert('Error rendering markdown content. Please check the file format.');
    }
}

// ===========================
// HTML Comment Reveal
// ===========================
function revealHtmlComments(container) {
    // Walk the DOM and replace comment nodes with visible styled blocks
    const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_COMMENT,
        null
    );

    const commentNodes = [];
    while (walker.nextNode()) {
        commentNodes.push(walker.currentNode);
    }

    commentNodes.forEach((node) => {
        const text = node.nodeValue.trim();
        if (!text) return;

        const block = document.createElement('div');
        block.className = 'html-comment-block';
        block.textContent = text;
        node.parentNode.replaceChild(block, node);
    });
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
        <button class="export-svg" title="Download as SVG">SVG</button>
        <button class="export-png" title="Download as PNG">PNG</button>
        <button class="share-diagram" title="Copy shareable link">🔗</button>
        <button class="fullscreen" title="Fullscreen">⛶</button>
    `;

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'diagram-wrapper';
    wrapper.id = `wrapper-${diagramId}`;
    wrapper.innerHTML = svg;

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
    const exportSvgBtn = controls.querySelector('.export-svg');
    const exportPngBtn = controls.querySelector('.export-png');
    const shareBtn = controls.querySelector('.share-diagram');
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

    // Setup minimap
    requestAnimationFrame(() => {
        updateMinimap(svgClone);
        updateMinimapViewport(fullscreenPanzoom, fullscreenWrapper);
    });

    // Update minimap viewport on pan/zoom
    svgClone.addEventListener('panzoomchange', () => {
        updateMinimapViewport(fullscreenPanzoom, fullscreenWrapper);
    });

    // Focus for keyboard events
    fullscreenOverlay.focus();
}

function setupFullscreenControls(panzoomInstance, wrapper, fullscreenState) {
    const controls = fullscreenOverlay.querySelector('.fullscreen-controls');
    const zoomInBtn = controls.querySelector('.zoom-in');
    const zoomOutBtn = controls.querySelector('.zoom-out');
    const resetBtn = controls.querySelector('.reset');
    const exportSvgBtn = controls.querySelector('.export-svg');
    const exportPngBtn = controls.querySelector('.export-png');
    const closeBtn = controls.querySelector('.close-fullscreen');

    // Remove old listeners by cloning
    const newZoomIn = zoomInBtn.cloneNode(true);
    const newZoomOut = zoomOutBtn.cloneNode(true);
    const newReset = resetBtn.cloneNode(true);
    const newExportSvg = exportSvgBtn ? exportSvgBtn.cloneNode(true) : null;
    const newExportPng = exportPngBtn ? exportPngBtn.cloneNode(true) : null;
    const newClose = closeBtn.cloneNode(true);

    zoomInBtn.replaceWith(newZoomIn);
    zoomOutBtn.replaceWith(newZoomOut);
    resetBtn.replaceWith(newReset);
    if (exportSvgBtn && newExportSvg) exportSvgBtn.replaceWith(newExportSvg);
    if (exportPngBtn && newExportPng) exportPngBtn.replaceWith(newExportPng);
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

    if (newExportSvg) {
        newExportSvg.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadDiagramSvg(fullscreenOverlay.diagramId);
        });
    }

    if (newExportPng) {
        newExportPng.addEventListener('click', (e) => {
            e.stopPropagation();
            downloadDiagramPng(fullscreenOverlay.diagramId);
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
    closeSearch();

    // Clear content
    markdownContent.innerHTML = '';
    fileName.textContent = '';
    fileInput.value = '';
    currentRawMarkdown = '';
    currentViewMode = 'preview';
    updateViewToggleButton();

    // Clear tab state
    tabs = [];
    activeTabId = null;
    renderTabBar();

    // Reset TOC and split view
    if (tocVisible) toggleToc();
    if (splitViewActive) toggleSplitView();
    if (tocNav) tocNav.innerHTML = '';

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
// Tab Management
// ===========================
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function saveActiveTabState() {
    if (activeTabId === null) return;
    const tab = tabs.find(t => t.id === activeTabId);
    if (!tab) return;
    tab.viewMode = currentViewMode;
    tab.scrollTop = markdownContent.scrollTop;
}

function renderTabBar() {
    if (!tabBar) return;

    if (tabs.length === 0) {
        tabBar.style.display = 'none';
        tabBar.innerHTML = '';
        return;
    }

    tabBar.style.display = 'flex';

    let html = '';
    for (const tab of tabs) {
        const isActive = tab.id === activeTabId;
        const hasChanges = !!tab.hasUnseenChanges;
        const classes = ['tab'];
        if (isActive) classes.push('tab-active');
        if (hasChanges) classes.push('tab-has-changes');
        html += `<div class="${classes.join(' ')}" data-tab-id="${tab.id}">`;
        if (tab.watching) {
            const dotTitle = hasChanges ? 'File changed on disk' : 'Watching for changes';
            html += `<span class="tab-watching-dot" title="${dotTitle}"></span>`;
        }
        html += `<span class="tab-filename">${escapeHtml(tab.filename)}</span>`;
        html += `<button class="tab-close" data-close-id="${tab.id}" title="Close tab">×</button>`;
        html += `</div>`;
    }
    html += `<button class="tab-new" title="Open new file">+</button>`;

    tabBar.innerHTML = html;

    tabBar.querySelectorAll('.tab').forEach(tabEl => {
        tabEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-close')) return;
            const id = parseInt(tabEl.getAttribute('data-tab-id'), 10);
            switchTab(id);
        });
    });

    tabBar.querySelectorAll('.tab-close').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.getAttribute('data-close-id'), 10);
            closeTab(id);
        });
    });

    const newTabBtn = tabBar.querySelector('.tab-new');
    if (newTabBtn) {
        newTabBtn.addEventListener('click', () => {
            if (isDesktop && window.specdown && window.specdown.requestFileOpen) {
                window.specdown.requestFileOpen();
                return;
            }
            fileInput.click();
        });
    }
}

function createTab(filename, content, filePath) {
    if (tabs.length >= MAX_TABS) {
        alert('Maximum of ' + MAX_TABS + ' tabs reached. Close a tab to open another file.');
        return;
    }

    // Save current tab state before switching
    saveActiveTabState();

    const id = ++nextTabId;
    const tab = {
        id,
        filename,
        filePath: filePath || null,
        rawMarkdown: content,
        viewMode: 'preview',
        scrollTop: 0,
        watching: !!(isDesktop && filePath),
        hasUnseenChanges: false
    };
    tabs.push(tab);
    activeTabId = id;

    if (tab.watching) {
        startWatchingFilePath(tab.filePath);
    }

    renderTabBar();
    if (isDesktop) {
        updateWatchToggle();
        saveDesktopSession();
    }
    renderMarkdown(content, filename);
}

async function switchTab(id) {
    if (id === activeTabId) return;

    saveActiveTabState();
    activeTabId = id;
    const tab = tabs.find(t => t.id === id);
    if (!tab) return;

    // Clear the "unseen changes" flag now that the user is looking at it.
    tab.hasUnseenChanges = false;

    renderTabBar();
    if (isDesktop) updateWatchToggle();
    cleanupPanzoomInstances();

    if (tab.viewMode === 'raw') {
        currentRawMarkdown = tab.rawMarkdown;
        currentViewMode = 'raw';
        const escaped = tab.rawMarkdown
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        markdownContent.innerHTML = `<pre class="raw-markdown"><code>${escaped}</code></pre>`;
        fileName.textContent = tab.filename;
        dropZone.style.display = 'none';
        contentArea.style.display = 'flex';
        updateViewToggleButton();
        markdownContent.scrollTop = tab.scrollTop;
    } else {
        await renderMarkdown(tab.rawMarkdown, tab.filename);
        markdownContent.scrollTop = tab.scrollTop;
    }
}

async function closeTab(id) {
    const idx = tabs.findIndex(t => t.id === id);
    if (idx === -1) return;

    const wasActive = (id === activeTabId);
    const closedTab = tabs[idx];

    // Stop watching before removing the tab
    if (isDesktop && closedTab.watching && closedTab.filePath) {
        stopWatchingFilePath(closedTab.filePath);
    }

    if (wasActive) {
        cleanupPanzoomInstances();
    }

    tabs.splice(idx, 1);

    if (isDesktop) saveDesktopSession();

    if (tabs.length === 0) {
        activeTabId = null;
        renderTabBar();
        if (isDesktop) updateWatchToggle();
        showDropZone();
    } else if (wasActive) {
        const newIdx = Math.min(idx, tabs.length - 1);
        const newTab = tabs[newIdx];
        activeTabId = newTab.id;
        renderTabBar();
        if (isDesktop) updateWatchToggle();

        if (newTab.viewMode === 'raw') {
            currentRawMarkdown = newTab.rawMarkdown;
            currentViewMode = 'raw';
            const escaped = newTab.rawMarkdown
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            markdownContent.innerHTML = `<pre class="raw-markdown"><code>${escaped}</code></pre>`;
            fileName.textContent = newTab.filename;
            dropZone.style.display = 'none';
            contentArea.style.display = 'flex';
            updateViewToggleButton();
        } else {
            await renderMarkdown(newTab.rawMarkdown, newTab.filename);
        }
    } else {
        renderTabBar();
    }
}

// ===========================
// Desktop IPC Integration
// ===========================
function updateWatchToggle() {
    if (!watchToggle) return;

    const tab = activeTabId !== null ? tabs.find(t => t.id === activeTabId) : null;
    const canWatch = !!(tab && tab.filePath);

    if (!canWatch) {
        watchToggle.style.display = 'none';
        return;
    }

    watchToggle.style.display = '';
    if (tab.watching) {
        watchToggle.classList.add('active');
        watchToggle.title = 'Watching — click to stop';
    } else {
        watchToggle.classList.remove('active');
        watchToggle.title = 'Auto-reload when file changes on disk';
    }
}

// Briefly animate the watch toggle to signal that an auto-reload just
// happened. Without this, the reload is invisible if the user happens
// not to be looking at the content area when the disk write lands.
let watchTogglePulseTimer = null;
function pulseWatchToggle() {
    if (!watchToggle) return;
    watchToggle.classList.remove('reloaded');
    // Force reflow so re-adding the class restarts the animation even
    // when multiple reloads happen in quick succession.
    // eslint-disable-next-line no-unused-expressions
    void watchToggle.offsetWidth;
    watchToggle.classList.add('reloaded');
    watchToggle.title = 'Reloaded from disk';

    if (watchTogglePulseTimer) clearTimeout(watchTogglePulseTimer);
    watchTogglePulseTimer = setTimeout(() => {
        watchToggle.classList.remove('reloaded');
        // Restore the state-appropriate tooltip.
        updateWatchToggle();
        watchTogglePulseTimer = null;
    }, 1200);
}

function startWatchingFilePath(filePath) {
    if (!isDesktop || !filePath || !window.specdown || !window.specdown.watchFile) return;

    const currentCount = watchRefCounts.get(filePath) || 0;
    watchRefCounts.set(filePath, currentCount + 1);

    if (currentCount === 0) {
        window.specdown.watchFile(filePath);
    }
}

function stopWatchingFilePath(filePath) {
    if (!isDesktop || !filePath || !window.specdown || !window.specdown.unwatchFile) return;

    const currentCount = watchRefCounts.get(filePath) || 0;
    if (currentCount <= 1) {
        watchRefCounts.delete(filePath);
        window.specdown.unwatchFile(filePath);
        return;
    }

    watchRefCounts.set(filePath, currentCount - 1);
}

function toggleWatching() {
    if (!isDesktop) return;
    const tab = activeTabId !== null ? tabs.find(t => t.id === activeTabId) : null;
    if (!tab || !tab.filePath) return;

    tab.watching = !tab.watching;

    if (tab.watching) {
        startWatchingFilePath(tab.filePath);
    } else {
        stopWatchingFilePath(tab.filePath);
    }

    renderTabBar();
    updateWatchToggle();
}

function setupDesktopIPC() {
    // Listen for files opened from the main process (Cmd+O, Finder, drag-to-dock)
    window.specdown.onFileOpened(function(fileData) {
        createTab(fileData.filename, fileData.content, fileData.filePath);
    });

    // Listen for close-tab command from native menu (Cmd+W)
    window.specdown.onCloseTab(function() {
        if (activeTabId !== null) {
            closeTab(activeTabId);
        }
    });

    // Listen for file-changed events (watched file updated on disk)
    window.specdown.onFileChanged(async function(fileData) {
        const tab = tabs.find(t => t.filePath === fileData.filePath);
        if (!tab) return;

        tab.rawMarkdown = fileData.content;
        tab.filename = fileData.filename;

        if (tab.id === activeTabId) {
            // Preserve scroll position across the re-render so an
            // auto-reload doesn't yank the user back to the top.
            const savedScrollTop = markdownContent.scrollTop;

            if (tab.viewMode === 'raw') {
                currentRawMarkdown = fileData.content;
                const escaped = fileData.content
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                markdownContent.innerHTML = `<pre class="raw-markdown"><code>${escaped}</code></pre>`;
                markdownContent.scrollTop = savedScrollTop;
            } else {
                await renderMarkdown(fileData.content, fileData.filename);
                markdownContent.scrollTop = savedScrollTop;
            }

            // Visual feedback that an auto-reload happened — otherwise
            // the user has no way to tell the content just changed.
            pulseWatchToggle();
        } else {
            // Background tab: flag it so the user sees that something
            // changed when they come back to it.
            tab.hasUnseenChanges = true;
            renderTabBar();
        }
    });

    // Wire up watch toggle button
    if (watchToggle) {
        watchToggle.addEventListener('click', toggleWatching);
    }

    // Native menu: File > Print
    if (window.specdown.onTriggerPrint) {
        window.specdown.onTriggerPrint(function() {
            window.print();
        });
    }

    // Native menu: Edit > Find
    if (window.specdown.onTriggerSearch) {
        window.specdown.onTriggerSearch(function() {
            if (contentArea.style.display !== 'none') {
                openSearch();
            }
        });
    }

    // Appearance menu: apply custom CSS theme
    if (window.specdown.onApplyCustomCss) {
        window.specdown.onApplyCustomCss(function(cssContent) {
            applyCustomCss(cssContent);
        });
    }
}

function saveDesktopSession() {
    if (!isDesktop || !window.specdown.saveSession) return;
    window.specdown.saveSession(tabs.map(t => ({
        filePath: t.filePath,
        filename: t.filename
    })));
}

// ===========================
// Feature: Print / PDF Export
// ===========================
// Print button wired in setupEventListeners; Cmd+P wired in keydown handler.
// CSS print styles in styles.css hide UI chrome automatically.

// ===========================
// Feature: Table of Contents
// ===========================
function buildToc() {
    if (!tocNav) return;
    const headings = markdownContent.querySelectorAll('h1, h2, h3, h4');
    tocNav.innerHTML = '';

    if (headings.length === 0) {
        if (tocToggle) tocToggle.style.display = 'none';
        return;
    }

    if (tocToggle) tocToggle.style.display = '';

    headings.forEach((h, i) => {
        // Ensure each heading has an id for anchor linking
        if (!h.id) {
            h.id = 'toc-heading-' + i;
        }

        const level = parseInt(h.tagName[1], 10);
        const link = document.createElement('a');
        link.className = 'toc-link toc-level-' + level;
        link.href = '#' + h.id;
        link.textContent = h.textContent;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        tocNav.appendChild(link);
    });
}

function toggleToc() {
    tocVisible = !tocVisible;
    if (tocSidebar) tocSidebar.style.display = tocVisible ? '' : 'none';
    if (tocToggle) tocToggle.classList.toggle('active', tocVisible);
}

function updateTocActiveHeading() {
    if (!tocVisible || !tocNav) return;
    const headings = markdownContent.querySelectorAll('h1, h2, h3, h4');
    const scrollTop = markdownContent.scrollTop;
    let activeId = null;

    headings.forEach((h) => {
        if (h.offsetTop - 60 <= scrollTop) {
            activeId = h.id;
        }
    });

    tocNav.querySelectorAll('.toc-link').forEach((link) => {
        const isActive = link.getAttribute('href') === '#' + activeId;
        link.classList.toggle('toc-link-active', isActive);
    });
}

// ===========================
// Feature: In-Document Search
// ===========================
function openSearch() {
    if (!searchBar) return;
    searchBar.style.display = 'flex';
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    clearSearchHighlights();
    updateSearchCount();
}

function closeSearch() {
    if (!searchBar) return;
    searchBar.style.display = 'none';
    clearSearchHighlights();
    searchMatches = [];
    searchCurrentIndex = -1;
    updateSearchCount();
}

function runSearch(query) {
    clearSearchHighlights();
    searchMatches = [];
    searchCurrentIndex = -1;

    if (!query || query.length < 1) {
        updateSearchCount();
        return;
    }

    // Walk text nodes in markdownContent, wrap matches with <mark>
    const walker = document.createTreeWalker(
        markdownContent,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode: (node) => {
                // Skip script/style and diagram wrappers
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                const tag = parent.tagName;
                if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
                if (parent.closest('.diagram-wrapper')) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    );

    const regex = new RegExp(escapeRegex(query), 'gi');
    const nodesToProcess = [];
    let node;
    while ((node = walker.nextNode())) {
        if (regex.test(node.textContent)) {
            nodesToProcess.push(node);
        }
        regex.lastIndex = 0;
    }

    nodesToProcess.forEach((textNode) => {
        const text = textNode.textContent;
        const parts = [];
        let lastIndex = 0;
        let match;
        regex.lastIndex = 0;

        while ((match = regex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(document.createTextNode(text.slice(lastIndex, match.index)));
            }
            const mark = document.createElement('mark');
            mark.className = 'search-highlight';
            mark.textContent = match[0];
            parts.push(mark);
            searchHighlightNodes.push(mark);
            searchMatches.push(mark);
            lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
            parts.push(document.createTextNode(text.slice(lastIndex)));
        }

        if (parts.length > 0 && textNode.parentNode) {
            const frag = document.createDocumentFragment();
            parts.forEach((p) => frag.appendChild(p));
            textNode.parentNode.replaceChild(frag, textNode);
        }
    });

    if (searchMatches.length > 0) {
        searchCurrentIndex = 0;
        highlightCurrentMatch();
    }
    updateSearchCount();
}

function navigateSearch(direction) {
    if (searchMatches.length === 0) return;
    searchCurrentIndex = (searchCurrentIndex + direction + searchMatches.length) % searchMatches.length;
    highlightCurrentMatch();
    updateSearchCount();
}

function highlightCurrentMatch() {
    searchMatches.forEach((m, i) => {
        m.classList.toggle('search-highlight-current', i === searchCurrentIndex);
    });
    if (searchMatches[searchCurrentIndex]) {
        searchMatches[searchCurrentIndex].scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
}

function clearSearchHighlights() {
    // Unwrap all <mark> elements
    searchHighlightNodes.forEach((mark) => {
        if (mark.parentNode) {
            const text = document.createTextNode(mark.textContent);
            mark.parentNode.replaceChild(text, mark);
        }
    });
    searchHighlightNodes = [];
    searchMatches = [];
    searchCurrentIndex = -1;

    // Normalize text nodes that were split
    if (markdownContent) markdownContent.normalize();
}

function updateSearchCount() {
    if (!searchCount) return;
    if (searchMatches.length === 0) {
        searchCount.textContent = '';
    } else {
        searchCount.textContent = (searchCurrentIndex + 1) + ' / ' + searchMatches.length;
    }
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ===========================
// Feature: Split View
// ===========================
function toggleSplitView() {
    splitViewActive = !splitViewActive;

    if (splitToggle) splitToggle.classList.toggle('active', splitViewActive);

    const contentMain = document.getElementById('content-main');
    if (contentMain) {
        contentMain.classList.toggle('split-active', splitViewActive);
    }

    if (splitRawPane) {
        splitRawPane.style.display = splitViewActive ? '' : 'none';
    }

    if (splitViewActive && currentRawMarkdown) {
        updateSplitRawPane(currentRawMarkdown);
    }
}

function updateSplitRawPane(content) {
    if (!splitRawContent) return;
    const escaped = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    splitRawContent.innerHTML = `<code>${escaped}</code>`;
}

// ===========================
// Feature: Diagram Export (SVG / PNG)
// ===========================
function getSvgElementForDiagram(diagramId) {
    const wrapper = document.getElementById('wrapper-' + diagramId);
    if (!wrapper) return null;
    // Try original wrapper first, then fullscreen wrapper
    return wrapper.querySelector('svg') ||
        fullscreenOverlay.querySelector('.fullscreen-diagram-wrapper svg');
}

function downloadDiagramSvg(diagramId) {
    const svgEl = getSvgElementForDiagram(diagramId);
    if (!svgEl) return;

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, (diagramId || 'diagram') + '.svg');
}

function downloadDiagramPng(diagramId) {
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

// ===========================
// Feature: Shareable Diagram Links
// ===========================
function shareDiagramLink(diagramId) {
    const wrapper = document.getElementById('wrapper-' + diagramId);
    if (!wrapper) return;
    const svgEl = wrapper.querySelector('svg');
    if (!svgEl) return;
    const source = svgEl.getAttribute('data-mermaid-source');
    if (!source) return;

    const encoded = btoa(unescape(encodeURIComponent(source)));
    const shareUrl = window.location.origin + window.location.pathname + '?diagram=' + encodeURIComponent(encoded);

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(shareUrl).then(() => showShareToast());
    } else {
        // Fallback: select from a temporary textarea
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showShareToast();
    }
}

function showShareToast() {
    if (!shareToast) return;
    shareToast.style.display = '';
    setTimeout(() => { shareToast.style.display = 'none'; }, 2500);
}

function checkForDiagramLink() {
    try {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get('diagram');
        if (!encoded) return;
        const source = decodeURIComponent(escape(atob(decodeURIComponent(encoded))));
        if (!source) return;

        // Synthesize a one-diagram markdown document
        const md = '```mermaid\n' + source + '\n```\n';
        createTab('shared-diagram.md', md);
    } catch (e) {
        // Silently ignore malformed deep links
    }
}

// ===========================
// Feature: Diagram Minimap (Fullscreen)
// ===========================
function updateMinimap(svgElement) {
    const minimapEl = document.getElementById('fullscreen-minimap');
    const canvas = document.getElementById('minimap-canvas');
    if (!minimapEl || !canvas) return;

    const dims = getSvgNaturalDimensions(svgElement);
    if (!dims) { minimapEl.style.display = 'none'; return; }

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
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
}

function updateMinimapViewport(panzoomInstance, wrapper) {
    const viewportEl = document.getElementById('minimap-viewport');
    const canvas = document.getElementById('minimap-canvas');
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

// ===========================
// Feature: Custom CSS Themes
// ===========================
let customStyleEl = null;

function applyCustomCss(cssContent) {
    if (!customStyleEl) {
        customStyleEl = document.createElement('style');
        customStyleEl.id = 'custom-theme';
        document.head.appendChild(customStyleEl);
    }
    customStyleEl.textContent = cssContent || '';
}

// ===========================
// Feature: GitHub Repo File Browser
// ===========================
// Enhances the URL input to accept github.com/<owner>/<repo> URLs and
// show a list of .md files from the repo for the user to pick one.

async function fetchGitHubRepoFiles(repoUrl) {
    // Match: https://github.com/<owner>/<repo>
    const repoPattern = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/?$/;
    const match = repoUrl.match(repoPattern);
    if (!match) return null;

    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');

    // Use GitHub Search API to find .md files (avoids full tree traversal)
    const apiUrl = `https://api.github.com/search/code?q=extension:md+repo:${owner}/${repo}&per_page=100`;

    try {
        const resp = await fetch(apiUrl, {
            headers: { Accept: 'application/vnd.github+json' }
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        if (!data.items || data.items.length === 0) return [];

        return data.items.map((item) => ({
            path: item.path,
            url: item.html_url,
            rawUrl: `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${item.path}`
        }));
    } catch (e) {
        return null;
    }
}

async function handleRepoUrl(url) {
    clearUrlError();
    const files = await fetchGitHubRepoFiles(url);
    if (files === null) {
        // Not a repo URL or fetch failed — fall through to normal URL handling
        return false;
    }
    if (files.length === 0) {
        showUrlError('No markdown files found in this repository.');
        return true;
    }

    showRepoBrowser(files, url);
    return true;
}

function showRepoBrowser(files, repoUrl) {
    let modal = document.getElementById('repo-browser-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'repo-browser-modal';
        modal.className = 'repo-browser-modal';
        document.body.appendChild(modal);
    }

    const repoName = repoUrl.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');

    modal.innerHTML = `
        <div class="repo-browser-content">
            <div class="repo-browser-header">
                <span class="repo-browser-title">${escapeHtml(repoName)}</span>
                <button class="repo-browser-close" title="Close">&#10005;</button>
            </div>
            <div class="repo-browser-search">
                <input type="text" class="repo-browser-filter" placeholder="Filter files..." autocomplete="off">
            </div>
            <ul class="repo-browser-list">
                ${files.map((f) => `
                    <li class="repo-browser-item" data-raw-url="${escapeHtml(f.rawUrl)}">
                        <span class="repo-file-icon">📄</span>
                        <span class="repo-file-path">${escapeHtml(f.path)}</span>
                    </li>
                `).join('')}
            </ul>
        </div>
    `;
    modal.style.display = 'flex';

    modal.querySelector('.repo-browser-close').addEventListener('click', () => {
        modal.style.display = 'none';
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
    });

    const filterInput = modal.querySelector('.repo-browser-filter');
    filterInput.addEventListener('input', () => {
        const q = filterInput.value.toLowerCase();
        modal.querySelectorAll('.repo-browser-item').forEach((item) => {
            const path = item.querySelector('.repo-file-path').textContent.toLowerCase();
            item.style.display = path.includes(q) ? '' : 'none';
        });
    });
    filterInput.focus();

    modal.querySelectorAll('.repo-browser-item').forEach((item) => {
        item.addEventListener('click', () => {
            const rawUrl = item.getAttribute('data-raw-url');
            modal.style.display = 'none';
            handleUrl(rawUrl);
        });
    });
}

// ===========================
// Feature: Annotation Mode
// ===========================
// Lightweight sticky-note annotations stored in localStorage, keyed by filename.
// Users can double-click any paragraph or heading to add/edit an annotation.

const ANNOTATIONS_KEY = 'specdown-annotations';

function loadAnnotations(key) {
    try {
        const raw = localStorage.getItem(ANNOTATIONS_KEY);
        const all = raw ? JSON.parse(raw) : {};
        return all[key] || {};
    } catch (e) {
        return {};
    }
}

function saveAnnotations(key, annotations) {
    try {
        const raw = localStorage.getItem(ANNOTATIONS_KEY);
        const all = raw ? JSON.parse(raw) : {};
        if (Object.keys(annotations).length === 0) {
            delete all[key];
        } else {
            all[key] = annotations;
        }
        localStorage.setItem(ANNOTATIONS_KEY, JSON.stringify(all));
    } catch (e) {
        // localStorage quota exceeded — silently ignore
    }
}

let annotationMode = false;
let annotationKey = '';

function toggleAnnotationMode() {
    annotationMode = !annotationMode;
    const btn = document.getElementById('annotation-toggle');
    if (btn) btn.classList.toggle('active', annotationMode);

    if (annotationMode && annotationKey) {
        attachAnnotationHandlers();
    } else {
        detachAnnotationHandlers();
    }
}

function renderAnnotations(key) {
    annotationKey = key;
    // Remove old annotation badges
    markdownContent.querySelectorAll('.annotation-badge').forEach((b) => b.remove());

    const annotations = loadAnnotations(key);
    Object.entries(annotations).forEach(([idx, text]) => {
        const el = markdownContent.querySelectorAll('[data-annot-idx]')[parseInt(idx, 10)];
        if (el) attachAnnotationBadge(el, parseInt(idx, 10), text);
    });
}

function attachAnnotationHandlers() {
    // Index all annotatable elements
    const els = markdownContent.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, blockquote');
    els.forEach((el, idx) => {
        el.setAttribute('data-annot-idx', idx);
        el.classList.add('annotatable');
        el.addEventListener('dblclick', handleAnnotationDblClick);
    });
}

function detachAnnotationHandlers() {
    markdownContent.querySelectorAll('.annotatable').forEach((el) => {
        el.removeEventListener('dblclick', handleAnnotationDblClick);
        el.classList.remove('annotatable');
    });
}

function handleAnnotationDblClick(e) {
    if (!annotationMode) return;
    const el = e.currentTarget;
    const idx = parseInt(el.getAttribute('data-annot-idx'), 10);
    const annotations = loadAnnotations(annotationKey);
    const existing = annotations[idx] || '';

    const note = prompt('Add annotation (leave blank to remove):', existing);
    if (note === null) return; // cancelled

    if (note.trim() === '') {
        delete annotations[idx];
        const badge = el.querySelector('.annotation-badge');
        if (badge) badge.remove();
    } else {
        annotations[idx] = note.trim();
        attachAnnotationBadge(el, idx, note.trim());
    }
    saveAnnotations(annotationKey, annotations);
}

function attachAnnotationBadge(el, idx, text) {
    // Remove existing badge first
    const existing = el.querySelector('.annotation-badge');
    if (existing) existing.remove();

    el.setAttribute('data-annot-idx', idx);
    el.classList.add('has-annotation');

    const badge = document.createElement('span');
    badge.className = 'annotation-badge';
    badge.title = text;
    badge.textContent = '✎';
    badge.addEventListener('click', (e) => {
        e.stopPropagation();
        showAnnotationPopover(badge, text);
    });
    el.appendChild(badge);
}

function showAnnotationPopover(anchor, text) {
    let popover = document.getElementById('annotation-popover');
    if (!popover) {
        popover = document.createElement('div');
        popover.id = 'annotation-popover';
        popover.className = 'annotation-popover';
        document.body.appendChild(popover);
    }
    popover.textContent = text;
    const rect = anchor.getBoundingClientRect();
    popover.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    popover.style.left = (rect.left + window.scrollX) + 'px';
    popover.style.display = '';

    const hide = (e) => {
        if (!popover.contains(e.target) && e.target !== anchor) {
            popover.style.display = 'none';
            document.removeEventListener('click', hide);
        }
    };
    setTimeout(() => document.addEventListener('click', hide), 0);
}

// ===========================
// Initialize App
// ===========================
init();
