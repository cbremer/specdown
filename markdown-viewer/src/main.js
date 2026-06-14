// SpecDown — shared viewer entry point.
//
// Phase 1 (modernization roadmap): the formerly-vendored browser globals are
// now real ES-module imports bundled by Vite. They are bound to the same
// identifiers (`marked`, `mermaid`, `Panzoom`, `hljs`, `DOMPurify`) the rest of
// this file already used, so the app logic below is unchanged. The internal
// split into core/features/platform modules is a subsequent slice; for now the
// logic remains in this single module to keep the migration behavior-preserving.
import { marked } from 'marked';
import mermaid from 'mermaid';
import Panzoom from '@panzoom/panzoom';
import hljs from 'highlight.js';
import DOMPurify from 'dompurify';
import 'highlight.js/styles/github-dark.css';

// Internal modules (Phase 1 split — extracting cohesive units out of this entry).
import {
  escapeHtml,
  normalizeMarkdownUrl,
  getSvgNaturalDimensions,
} from './core/utils.js';
import {
  downloadDiagramSvg,
  downloadDiagramPng,
} from './features/diagram-export.js';
import {
  openSearch,
  closeSearch,
  runSearch,
  navigateSearch,
  clearSearchHighlights,
} from './features/search.js';
import {
  toggleAnnotationMode,
  renderAnnotations,
} from './features/annotations.js';
import { handleRepoUrl } from './features/repo-browser.js';

// ===========================
// Constants
// ===========================
const VALID_EXTENSIONS = ['.md', '.markdown'];
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const APP_VERSION = '0.0.94';
const APP_VERSION_LABEL = 'alpha';
const SOURCE_REPO = 'cbremer/specdown';
const SOURCE_REPO_URL = 'https://github.com/' + SOURCE_REPO;
const MAX_DIAGRAM_URL_PARAM_LENGTH = 65536;

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
const isIOSNative = !!(
    typeof window !== 'undefined'
    && window.iosNative
    && window.webkit
    && window.webkit.messageHandlers
    && window.webkit.messageHandlers.specdown
);

// TOC state
let tocVisible = false;
let tocEntries = [];
let tocScrollSpyScheduled = false;

// Split view state
let splitViewActive = false;
let iosLayoutMode = 'phone';


// ===========================
// DOM Elements
// ===========================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseButton = document.getElementById('browse-button');
const iosSampleSection = document.getElementById('ios-sample-section');
const openSampleBasic = document.getElementById('open-sample-basic');
const openSampleMermaid = document.getElementById('open-sample-mermaid');
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
const iosActionBar = document.getElementById('ios-action-bar');
const iosOpenButton = document.getElementById('ios-open-button');
const iosContentsButton = document.getElementById('ios-contents-button');
const iosViewButton = document.getElementById('ios-view-button');
const iosMoreButton = document.getElementById('ios-more-button');
const iosActionSheet = document.getElementById('ios-action-sheet');
const iosActionSheetClose = document.getElementById('ios-action-sheet-close');
const iosSplitButton = document.getElementById('ios-split-button');
const iosPrintButton = document.getElementById('ios-print-button');
const iosThemeButton = document.getElementById('ios-theme-button');
const iosTocSheet = document.getElementById('ios-toc-sheet');
const iosTocClose = document.getElementById('ios-toc-close');
const iosTocNav = document.getElementById('ios-toc-nav');

// ===========================
// Initialization
// ===========================
function init() {
    setupVersionInfo();
    setupTheme();
    setupIOSNativeUI();
    setupEventListeners();
    configureMermaid();
    configureMarked();
    checkForUpdates();
    checkForDiagramLink();
    if (isDesktop) {
        setupDesktopIPC();
    }
}

function setupIOSNativeUI() {
    document.body.classList.toggle('ios-native', isIOSNative);
    document.documentElement.classList.toggle('ios-native', isIOSNative);
    if (iosSampleSection) {
        iosSampleSection.style.display = isIOSNative ? '' : 'none';
    }
    document.body.classList.toggle('ios-pad', isIOSNative && iosLayoutMode === 'pad');
    document.documentElement.classList.toggle('ios-pad', isIOSNative && iosLayoutMode === 'pad');
    syncIOSChrome();
}

function requestNativeOpenIfAvailable() {
    if (isDesktop && window.specdown && window.specdown.requestFileOpen) {
        window.specdown.requestFileOpen();
        return true;
    }
    if (isIOSNative && window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.specdown) {
        window.webkit.messageHandlers.specdown.postMessage({ action: 'openFilePicker' });
        return true;
    }
    return false;
}

function requestBundledSampleIfAvailable(sampleName) {
    if (!isIOSNative || !window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.specdown) {
        return false;
    }
    window.webkit.messageHandlers.specdown.postMessage({
        action: 'openBundledSample',
        data: { name: sampleName }
    });
    return true;
}

function requestNativePrintIfAvailable() {
    if (!isIOSNative || !window.webkit || !window.webkit.messageHandlers || !window.webkit.messageHandlers.specdown || !hasLoadedContent()) {
        return false;
    }
    window.webkit.messageHandlers.specdown.postMessage({
        action: 'printDocument',
        data: {
            title: fileName ? fileName.textContent : '',
            html: buildPrintableDocument()
        }
    });
    return true;
}

function hasLoadedContent() {
    return !!(contentArea && contentArea.style.display !== 'none' && currentRawMarkdown);
}

function setIOSSheetVisibility(sheet, visible) {
    if (!sheet) return;
    sheet.style.display = visible ? 'flex' : 'none';
}

function closeIOSActionSheet() {
    setIOSSheetVisibility(iosActionSheet, false);
}

function closeIOSTocSheet() {
    setIOSSheetVisibility(iosTocSheet, false);
    tocVisible = false;
    if (tocToggle) tocToggle.classList.remove('active');
    syncIOSChrome();
}

function updateIOSActionButtonLabel(button, label) {
    if (!button) return;
    const labelEl = button.querySelector('.ios-action-label');
    if (labelEl) {
        labelEl.textContent = label;
    }
}

function updateIOSSheetButton(button, label, active) {
    if (!button) return;
    button.textContent = label;
    button.classList.toggle('active', !!active);
}

function performPrint() {
    if (requestNativePrintIfAvailable()) {
        return;
    }
    window.print();
}

window.setIOSLayoutMode = function(mode) {
    iosLayoutMode = mode === 'pad' ? 'pad' : 'phone';
    if (isIOSNative) {
        document.body.classList.toggle('ios-pad', iosLayoutMode === 'pad');
        document.documentElement.classList.toggle('ios-pad', iosLayoutMode === 'pad');
        if (iosLayoutMode === 'pad') {
            closeIOSActionSheet();
            closeIOSTocSheet();
        }
    }
    syncIOSChrome();
};

function buildPrintableDocument() {
    const title = (fileName && fileName.textContent) ? fileName.textContent : 'Specdown Document';
    const printableContent = markdownContent.cloneNode(true);

    printableContent.querySelectorAll('.diagram-controls, .annotation-popover, .search-highlight, .search-highlight-current')
        .forEach((element) => element.remove());
    printableContent.querySelectorAll('.annotation-badge').forEach((badge) => badge.remove());
    printableContent.querySelectorAll('.has-annotation').forEach((element) => {
        element.classList.remove('has-annotation');
    });
    printableContent.querySelectorAll('.diagram-wrapper').forEach((wrapper) => {
        wrapper.style.height = 'auto';
        wrapper.style.overflow = 'visible';
    });
    printableContent.querySelectorAll('.diagram-wrapper svg').forEach((svg) => {
        svg.style.maxWidth = '100%';
        svg.style.height = 'auto';
        svg.style.position = 'static';
        svg.style.transform = 'none';
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        @page {
            margin: 18mm 14mm;
        }
        html {
            box-sizing: border-box;
            background: #ffffff;
        }
        *,
        *::before,
        *::after {
            box-sizing: inherit;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #111827;
            background: #ffffff;
            margin: 0;
            padding: 0;
            line-height: 1.6;
        }
        .print-shell {
            max-width: 100%;
            padding: 12px 10px 16px;
        }
        .print-title {
            margin: 0 0 24px;
            font-size: 28px;
            font-weight: 700;
        }
        .print-content h1,
        .print-content h2,
        .print-content h3,
        .print-content h4,
        .print-content h5,
        .print-content h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            line-height: 1.3;
        }
        .print-content h1,
        .print-content h2 {
            padding-bottom: 0.3em;
            border-bottom: 1px solid #d1d5db;
        }
        .print-content p,
        .print-content ul,
        .print-content ol,
        .print-content table,
        .print-content blockquote,
        .print-content pre,
        .print-content .diagram-container {
            margin-bottom: 1em;
        }
        .print-content ul,
        .print-content ol {
            padding-left: 2em;
        }
        .print-content code {
            font-family: "SFMono-Regular", SFMono-Regular, ui-monospace, Menlo, monospace;
            background: #f3f4f6;
            padding: 0.15em 0.35em;
            border-radius: 4px;
            font-size: 0.92em;
        }
        .print-content pre {
            white-space: pre-wrap;
            word-break: break-word;
            overflow: visible;
            border: 1px solid #d1d5db;
            background: #f9fafb;
            border-radius: 8px;
            padding: 1em;
        }
        .print-content pre code {
            background: transparent;
            padding: 0;
        }
        .print-content table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }
        .print-content th,
        .print-content td {
            border: 1px solid #d1d5db;
            padding: 0.6em;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
        }
        .print-content blockquote {
            margin-left: 0;
            padding-left: 1em;
            border-left: 4px solid #60a5fa;
            color: #4b5563;
        }
        .print-content img,
        .print-content svg {
            max-width: 100%;
            height: auto;
        }
        .print-content .raw-markdown,
        .print-content .html-comment-block,
        .print-content .diagram-container,
        .print-content pre,
        .print-content table,
        .print-content blockquote {
            max-width: 100%;
        }
        .print-content .diagram-container,
        .print-content .diagram-wrapper {
            page-break-inside: avoid;
            break-inside: avoid;
        }
    </style>
</head>
<body>
    <main class="print-shell">
        <h1 class="print-title">${escapeHtml(title)}</h1>
        <section class="print-content">${printableContent.innerHTML}</section>
    </main>
</body>
</html>`;
}

function syncIOSChrome() {
    if (!isIOSNative) return;

    const hasContent = hasLoadedContent();
    const showActionBar = (hasContent || tabs.length > 0) && iosLayoutMode !== 'pad';
    const canShowContents = hasContent && currentViewMode === 'preview' && tocEntries.length > 0;

    if (iosActionBar) {
        iosActionBar.style.display = showActionBar ? 'grid' : 'none';
    }

    if (iosContentsButton) {
        iosContentsButton.disabled = !canShowContents;
        iosContentsButton.classList.toggle('active', tocVisible);
    }

    if (iosViewButton) {
        iosViewButton.disabled = !hasContent;
        iosViewButton.classList.toggle('active', currentViewMode === 'raw');
        updateIOSActionButtonLabel(iosViewButton, currentViewMode === 'preview' ? 'Raw' : 'Preview');
    }

    if (iosMoreButton) {
        iosMoreButton.disabled = !hasContent;
    }

    updateIOSSheetButton(iosSplitButton, splitViewActive ? 'Hide Split View' : 'Show Split View', splitViewActive);
    updateIOSSheetButton(iosThemeButton, currentTheme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode', false);

    if (iosSplitButton) iosSplitButton.disabled = !hasContent;
    if (iosPrintButton) iosPrintButton.disabled = !hasContent;
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
    if (isIOSNative) {
        return;
    }
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
                    const link = document.createElement('a');
                    link.href = releaseUrl;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.textContent = 'v' + latest + ' available';
                    updateEl.textContent = '';
                    updateEl.appendChild(link);
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
    syncIOSChrome();
    
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
    syncIOSChrome();
    if (contentArea && contentArea.style.display !== 'none') {
        reRenderMermaidDiagrams();
    }
};

// iOS API: called by Swift shell to load a file (Session 2+)
window.loadFileContent = function(content, filename) {
    createTab(filename, content);
};

// ===========================
// View Mode Toggle
// ===========================
function toggleViewMode() {
    if (!currentRawMarkdown) return;

    if (currentViewMode === 'preview') {
        currentViewMode = 'raw';
        if (tocVisible) {
            toggleToc(false);
        }
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
    syncIOSChrome();
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
        if (requestNativeOpenIfAvailable()) return;
        fileInput.click();
    });

    if (openSampleBasic) {
        openSampleBasic.addEventListener('click', (e) => {
            e.stopPropagation();
            requestBundledSampleIfAvailable('sample.md');
        });
    }

    if (openSampleMermaid) {
        openSampleMermaid.addEventListener('click', (e) => {
            e.stopPropagation();
            requestBundledSampleIfAvailable('sample-with-mermaid.md');
        });
    }

    // File input change
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop
    dropZone.addEventListener('click', (e) => {
        if (e.target.closest && e.target.closest('.url-section')) return;
        if (e.target === dropZone || e.target.closest('.drop-zone-content')) {
            if (requestNativeOpenIfAvailable()) return;
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

    // Annotation toggle (sync iOS chrome after toggling)
    if (annotationToggle) {
        annotationToggle.addEventListener('click', () => {
            toggleAnnotationMode();
            syncIOSChrome();
        });
    }

    // Split view toggle
    if (splitToggle) {
        splitToggle.addEventListener('click', toggleSplitView);
    }

    // Print button
    if (printButton) {
        printButton.addEventListener('click', performPrint);
    }

    if (iosOpenButton) {
        iosOpenButton.addEventListener('click', () => {
            closeIOSActionSheet();
            if (requestNativeOpenIfAvailable()) return;
            fileInput.click();
        });
    }

    if (iosContentsButton) {
        iosContentsButton.addEventListener('click', () => {
            if (iosContentsButton.disabled) return;
            toggleToc();
        });
    }

    if (iosViewButton) {
        iosViewButton.addEventListener('click', () => {
            if (iosViewButton.disabled) return;
            closeIOSActionSheet();
            toggleViewMode();
        });
    }

    if (iosMoreButton) {
        iosMoreButton.addEventListener('click', () => {
            if (iosMoreButton.disabled) return;
            closeIOSTocSheet();
            setIOSSheetVisibility(iosActionSheet, true);
        });
    }

    if (iosActionSheetClose) {
        iosActionSheetClose.addEventListener('click', closeIOSActionSheet);
    }

    if (iosActionSheet) {
        iosActionSheet.addEventListener('click', (e) => {
            if (e.target === iosActionSheet) {
                closeIOSActionSheet();
            }
        });
    }

    if (iosTocClose) {
        iosTocClose.addEventListener('click', closeIOSTocSheet);
    }

    if (iosTocSheet) {
        iosTocSheet.addEventListener('click', (e) => {
            if (e.target === iosTocSheet) {
                closeIOSTocSheet();
            }
        });
    }

    if (iosSplitButton) {
        iosSplitButton.addEventListener('click', () => {
            if (iosSplitButton.disabled) return;
            closeIOSActionSheet();
            toggleSplitView();
        });
    }

    if (iosPrintButton) {
        iosPrintButton.addEventListener('click', () => {
            if (iosPrintButton.disabled) return;
            closeIOSActionSheet();
            performPrint();
        });
    }

    if (iosThemeButton) {
        iosThemeButton.addEventListener('click', () => {
            closeIOSActionSheet();
            toggleTheme();
        });
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
                performPrint();
            }
        }

        if (fullscreenOverlay.style.display !== 'none' && fullscreenOverlay.panzoomInstance) {
            const instance = fullscreenOverlay.panzoomInstance;
            const controls = fullscreenOverlay.querySelector('.fullscreen-controls');
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                instance.zoomIn();
                updateZoomUI(instance, controls);
            } else if (e.key === '-') {
                e.preventDefault();
                instance.zoomOut();
                updateZoomUI(instance, controls);
            } else if (e.key === '0') {
                e.preventDefault();
                if (fullscreenOverlay.fullscreenState?.homeState) {
                    resetToFit(instance, fullscreenOverlay.fullscreenState.homeState);
                    updateZoomUI(instance, controls);
                }
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
    markdownContent.addEventListener('scroll', scheduleTocActiveHeadingUpdate);
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
        const handled = await handleRepoUrl(url, {
            clearError: clearUrlError,
            showError: showUrlError,
            onSelectFile: handleUrl,
        });
        if (handled) {
            if (urlInput) urlInput.value = '';
            return;
        }
    }

    const fetchUrl = normalizeMarkdownUrl(url);
    const filename = getFilenameFromUrl(url);

    try {
        const response = await fetch(fetchUrl, { credentials: 'omit' });
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
            // marked v16+ passes the code token object ({ text, lang, ... })
            // to renderer methods rather than positional (code, lang) args.
            code({ text: code, lang }) {
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
        fontFamily: FONT_FAMILY,
        // Render node labels as SVG <text> rather than <foreignObject> HTML.
        // Mermaid 11 defaults to HTML labels; our DOMPurify pass strips the
        // foreignObject, so shapes render but the label text disappears. SVG
        // text survives sanitization (this matches Mermaid 10's behavior).
        htmlLabels: false,
        flowchart: { htmlLabels: false }
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
        markdownContent.innerHTML = DOMPurify.sanitize(htmlContent);

        // Make HTML comments visible
        revealHtmlComments(markdownContent);

        // Show content area, hide drop zone
        dropZone.style.display = 'none';
        contentArea.style.display = 'flex';
        syncIOSChrome();

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

        // Render annotations for this document (re-arms handlers if active)
        renderAnnotations(filename);

        // Scroll to top
        markdownContent.scrollTop = 0;
        syncIOSChrome();

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

function resetToFit(panzoomInstance, homeState) {
    panzoomInstance.zoom(homeState.scale, { animate: true });
    panzoomInstance.pan(homeState.x, homeState.y, { animate: true });
}

function updateZoomUI(panzoomInstance, controlsRoot) {
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
        resetToFit(panzoomInstance, state.homeState);
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
        resetToFit(panzoomInstance, state.homeState);
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
    fullscreenOverlay.focus();
}

function setupFullscreenControls(panzoomInstance, wrapper, fullscreenState) {
    const controls = fullscreenOverlay.querySelector('.fullscreen-controls');
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
        updateZoomUI(panzoomInstance, controls);
    };

    wrapper.addEventListener('wheel', wheelHandler, { passive: false });
    fullscreenOverlay.wheelHandler = wheelHandler;

    // Double click to reset to fit
    const dblClickHandler = (e) => {
        e.stopPropagation();
        resetToFit(panzoomInstance, fullscreenState.homeState);
        updateZoomUI(panzoomInstance, controls);
    };

    wrapper.addEventListener('dblclick', dblClickHandler);
    fullscreenOverlay.dblClickHandler = dblClickHandler;
    updateZoomUI(panzoomInstance, controls);
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
    closeIOSActionSheet();
    closeIOSTocSheet();

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
    if (tocVisible) toggleToc(false);
    if (splitViewActive) toggleSplitView();
    if (tocNav) tocNav.innerHTML = '';
    if (iosTocNav) iosTocNav.innerHTML = '';
    tocEntries = [];
    if (tocSidebar) tocSidebar.style.display = 'none';

    // Show drop zone, hide content
    contentArea.style.display = 'none';
    dropZone.style.display = 'flex';
    syncIOSChrome();
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

// ===========================
// Tab Management
// ===========================
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
            if (requestNativeOpenIfAvailable()) return;
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
        if (tocVisible) {
            toggleToc(false);
        }
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
        syncIOSChrome();
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
            if (tocVisible) {
                toggleToc(false);
            }
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
            syncIOSChrome();
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
            performPrint();
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
    if (!tocNav && !iosTocNav) return;
    const headings = markdownContent.querySelectorAll('h1, h2, h3, h4');
    tocEntries = [];

    headings.forEach((h, i) => {
        // Ensure each heading has an id for anchor linking
        if (!h.id) {
            h.id = 'toc-heading-' + i;
        }

        tocEntries.push({
            id: h.id,
            level: parseInt(h.tagName[1], 10),
            text: h.textContent
        });
    });

    renderTocNavigation(tocNav);
    renderTocNavigation(iosTocNav);

    if (tocToggle) {
        tocToggle.style.display = tocEntries.length > 0 && !isIOSNative ? '' : 'none';
    }

    if (tocEntries.length === 0 && tocVisible) {
        toggleToc(false);
    } else {
        scheduleTocActiveHeadingUpdate();
    }

    syncIOSChrome();
}

function renderTocNavigation(navElement) {
    if (!navElement) return;
    navElement.innerHTML = '';

    tocEntries.forEach((entry) => {
        const link = document.createElement('a');
        link.className = 'toc-link toc-level-' + entry.level;
        link.href = '#' + entry.id;
        link.textContent = entry.text;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const heading = document.getElementById(entry.id);
            if (!heading) return;
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (isIOSNative) {
                closeIOSTocSheet();
            }
        });
        navElement.appendChild(link);
    });
}

function toggleToc(forceState) {
    const nextVisible = typeof forceState === 'boolean' ? forceState : !tocVisible;
    if (isIOSNative && nextVisible && (currentViewMode !== 'preview' || tocEntries.length === 0)) {
        return;
    }

    tocVisible = nextVisible;
    if (isIOSNative) {
        if (tocVisible) {
            closeIOSActionSheet();
            setIOSSheetVisibility(iosTocSheet, true);
            updateTocActiveHeading();
        } else {
            setIOSSheetVisibility(iosTocSheet, false);
        }
    } else if (tocSidebar) {
        tocSidebar.style.display = tocVisible ? '' : 'none';
    }
    if (tocToggle) tocToggle.classList.toggle('active', tocVisible);
    syncIOSChrome();
}

function scheduleTocActiveHeadingUpdate() {
    if (!tocVisible || tocScrollSpyScheduled) return;
    tocScrollSpyScheduled = true;
    requestAnimationFrame(() => {
        tocScrollSpyScheduled = false;
        updateTocActiveHeading();
    });
}

function updateTocActiveHeading() {
    if (!tocVisible) return;
    const headings = markdownContent.querySelectorAll('h1, h2, h3, h4');
    const scrollTop = markdownContent.scrollTop;
    let activeId = null;

    headings.forEach((h) => {
        if (h.offsetTop - 60 <= scrollTop) {
            activeId = h.id;
        }
    });

    [tocNav, iosTocNav].forEach((navElement) => {
        if (!navElement) return;
        navElement.querySelectorAll('.toc-link').forEach((link) => {
            const isActive = link.getAttribute('href') === '#' + activeId;
            link.classList.toggle('toc-link-active', isActive);
        });
    });
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

    syncIOSChrome();
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
        if (encoded.length > MAX_DIAGRAM_URL_PARAM_LENGTH) return;
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
// Initialize App
// ===========================
init();
