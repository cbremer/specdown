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
import { isDesktop, isIOSNative } from './core/platform.js';
import { state } from './core/state.js';
import {
  escapeHtml,
  normalizeMarkdownUrl,
  getSvgNaturalDimensions,
  revealHtmlComments,
} from './core/utils.js';
import {
  configureMarked,
  configureMermaid,
  getMermaidConfig,
} from './core/render-config.js';
import {
  handleFile,
  handleFileSelect,
  handleUrl,
  configureFileLoading,
} from './features/file-loading.js';
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
import { updateMinimap, updateMinimapViewport } from './features/minimap.js';
import { applyCustomCss } from './features/custom-css.js';
import {
  processMermaidDiagrams,
  cleanupPanzoomInstances,
  reRenderMermaidDiagrams,
  closeFullscreen,
  updateZoomUI,
  resetToFit,
} from './features/diagrams.js';
import {
  setupIOSNativeUI,
  syncIOSChrome,
  requestNativeOpenIfAvailable,
  requestBundledSampleIfAvailable,
  performPrint,
  closeIOSActionSheet,
  closeIOSTocSheet,
  setIOSSheetVisibility,
} from './platform/ios-chrome.js';
import {
  buildToc,
  toggleToc,
  scheduleTocActiveHeadingUpdate,
} from './features/toc.js';
import {
  toggleSplitView,
  updateSplitRawPane,
} from './features/split-view.js';
import {
  setupTheme,
  toggleTheme,
  configureTheme,
} from './features/theme.js';
import {
  toggleViewMode,
  updateViewToggleButton,
  configureViewMode,
} from './features/view-mode.js';
import {
  shareDiagramLink,
  checkForDiagramLink,
  configureShareLinks,
} from './features/share-links.js';

// ===========================
// Constants
// ===========================
const APP_VERSION = '0.0.101';
const APP_VERSION_LABEL = 'alpha';
const SOURCE_REPO = 'cbremer/specdown';
const SOURCE_REPO_URL = 'https://github.com/' + SOURCE_REPO;

// ===========================
// Global State
// ===========================

// Tab state
const MAX_TABS = 10;
const watchRefCounts = new Map(); // filePath -> number of watching tabs


// Split view state


// ===========================
// DOM Elements
// ===========================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseButton = document.getElementById('browse-button');
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
const searchPrev = document.getElementById('search-prev');
const searchNext = document.getElementById('search-next');
const searchClose = document.getElementById('search-close');
const shareToast = document.getElementById('share-toast');
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
    configureTheme({ reRenderDiagrams: () => reRenderMermaidDiagrams() });
    configureFileLoading({ createTab: (...a) => createTab(...a) });
    configureShareLinks({ createTab: (filename, md) => createTab(filename, md) });
    configureViewMode({
        renderMarkdown: (content, title) => renderMarkdown(content, title),
        cleanupPanzoom: () => cleanupPanzoomInstances(),
    });
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

// iOS API: called by Swift shell to load a file (Session 2+)
window.loadFileContent = function(content, filename) {
    createTab(filename, content);
};


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
        if (state.tabs.length > 0 && e.dataTransfer && e.dataTransfer.files.length > 0) {
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


// ===========================
// Markdown Rendering
// ===========================
async function renderMarkdown(content, filename) {
    try {
        // Clean up existing panzoom instances
        cleanupPanzoomInstances();

        // Store raw markdown for toggle
        state.currentRawMarkdown = content;
        state.currentViewMode = 'preview';
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
        if (state.splitViewActive) {
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
    state.currentRawMarkdown = '';
    state.currentViewMode = 'preview';
    updateViewToggleButton();

    // Clear tab state
    state.tabs = [];
    state.activeTabId = null;
    renderTabBar();

    // Reset TOC and split view
    if (state.tocVisible) toggleToc(false);
    if (state.splitViewActive) toggleSplitView();
    if (tocNav) tocNav.innerHTML = '';
    if (iosTocNav) iosTocNav.innerHTML = '';
    state.tocEntries = [];
    if (tocSidebar) tocSidebar.style.display = 'none';

    // Show drop zone, hide content
    contentArea.style.display = 'none';
    dropZone.style.display = 'flex';
    syncIOSChrome();
}

// ===========================
// Tab Management
// ===========================
function saveActiveTabState() {
    if (state.activeTabId === null) return;
    const tab = state.tabs.find(t => t.id === state.activeTabId);
    if (!tab) return;
    tab.viewMode = state.currentViewMode;
    tab.scrollTop = markdownContent.scrollTop;
}

function renderTabBar() {
    if (!tabBar) return;

    if (state.tabs.length === 0) {
        tabBar.style.display = 'none';
        tabBar.innerHTML = '';
        return;
    }

    tabBar.style.display = 'flex';

    let html = '';
    for (const tab of state.tabs) {
        const isActive = tab.id === state.activeTabId;
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
    if (state.tabs.length >= MAX_TABS) {
        alert('Maximum of ' + MAX_TABS + ' tabs reached. Close a tab to open another file.');
        return;
    }

    // Save current tab state before switching
    saveActiveTabState();

    const id = ++state.nextTabId;
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
    state.tabs.push(tab);
    state.activeTabId = id;

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
    if (id === state.activeTabId) return;

    saveActiveTabState();
    state.activeTabId = id;
    const tab = state.tabs.find(t => t.id === id);
    if (!tab) return;

    // Clear the "unseen changes" flag now that the user is looking at it.
    tab.hasUnseenChanges = false;

    renderTabBar();
    if (isDesktop) updateWatchToggle();
    cleanupPanzoomInstances();

    if (tab.viewMode === 'raw') {
        if (state.tocVisible) {
            toggleToc(false);
        }
        state.currentRawMarkdown = tab.rawMarkdown;
        state.currentViewMode = 'raw';
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
    const idx = state.tabs.findIndex(t => t.id === id);
    if (idx === -1) return;

    const wasActive = (id === state.activeTabId);
    const closedTab = state.tabs[idx];

    // Stop watching before removing the tab
    if (isDesktop && closedTab.watching && closedTab.filePath) {
        stopWatchingFilePath(closedTab.filePath);
    }

    if (wasActive) {
        cleanupPanzoomInstances();
    }

    state.tabs.splice(idx, 1);

    if (isDesktop) saveDesktopSession();

    if (state.tabs.length === 0) {
        state.activeTabId = null;
        renderTabBar();
        if (isDesktop) updateWatchToggle();
        showDropZone();
    } else if (wasActive) {
        const newIdx = Math.min(idx, state.tabs.length - 1);
        const newTab = state.tabs[newIdx];
        state.activeTabId = newTab.id;
        renderTabBar();
        if (isDesktop) updateWatchToggle();

        if (newTab.viewMode === 'raw') {
            if (state.tocVisible) {
                toggleToc(false);
            }
            state.currentRawMarkdown = newTab.rawMarkdown;
            state.currentViewMode = 'raw';
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

    const tab = state.activeTabId !== null ? state.tabs.find(t => t.id === state.activeTabId) : null;
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
    const tab = state.activeTabId !== null ? state.tabs.find(t => t.id === state.activeTabId) : null;
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
        if (state.activeTabId !== null) {
            closeTab(state.activeTabId);
        }
    });

    // Listen for file-changed events (watched file updated on disk)
    window.specdown.onFileChanged(async function(fileData) {
        const tab = state.tabs.find(t => t.filePath === fileData.filePath);
        if (!tab) return;

        tab.rawMarkdown = fileData.content;
        tab.filename = fileData.filename;

        if (tab.id === state.activeTabId) {
            // Preserve scroll position across the re-render so an
            // auto-reload doesn't yank the user back to the top.
            const savedScrollTop = markdownContent.scrollTop;

            if (tab.viewMode === 'raw') {
                state.currentRawMarkdown = fileData.content;
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
    window.specdown.saveSession(state.tabs.map(t => ({
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
// Initialize App
// ===========================
init();
