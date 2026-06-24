// @ts-check
// SpecDown — shared viewer entry point.
//
// Phase 1 (modernization roadmap): the viewer is an ES-module graph bundled by
// Vite, split into core/features/platform modules. This entry keeps the render
// core (`renderMarkdown`), the event-wiring hub, and the init() DI wiring; the
// cohesive features live in their own modules. `marked` and `DOMPurify` are used
// directly by the render core here; the heavy `mermaid` engine is loaded on
// demand by the diagram module (see core/render-config.js `loadMermaid`).
import { marked } from 'marked';
import DOMPurify from 'dompurify';
// Side-effect import of a highlight.js theme; Vite resolves it at build time.
// TypeScript 6+ reports TS2882 for an untyped side-effect import (the .css file
// resolves physically but has no type declaration), so suppress it here.
// @ts-expect-error -- no type declaration for the CSS module
import 'highlight.js/styles/github-dark.css';

// Internal modules (Phase 1 split — extracting cohesive units out of this entry).
import { isDesktop, isIOSNative } from './core/platform.js';
import { state } from './core/state.js';
import {
  normalizeMarkdownUrl,
  getSvgNaturalDimensions,
  revealHtmlComments,
} from './core/utils.js';
import { configureMarked } from './core/render-config.js';
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
  exportAnnotations,
  importAnnotationsFromFile,
  toggleAnnotationPanel,
  openAnnotationPanel,
} from './features/annotations.js';
import { handleRepoUrl } from './features/repo-browser.js';
import { updateMinimap, updateMinimapViewport } from './features/minimap.js';
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
import { createTab, configureTabs } from './features/tabs.js';
import { showToast } from './features/toast.js';
import {
  registerCommands,
  toggleCommandPalette,
  closeCommandPalette,
  isCommandPaletteOpen,
} from './features/command-palette.js';
import {
  openShortcutsSheet,
  closeShortcutsSheet,
  isShortcutsSheetOpen,
} from './features/shortcuts.js';
import {
  setupToolbarOverflow,
  closeOverflowMenu,
  isOverflowMenuOpen,
} from './features/toolbar-overflow.js';
import { registerServiceWorker, registerFileHandlerLaunchConsumer } from './features/pwa.js';
import {
  startPresentation,
  exitPresentation,
  isPresentationOpen,
  hasPresentableDiagrams,
} from './features/presentation.js';
import {
  configureRecentFiles,
  renderRecentFiles,
  clearRecentFiles,
  restoreLastSession,
} from './features/recent-files.js';
import { enhanceCodeBlocks } from './features/code-copy.js';
import {
  setupComments,
  refreshCommentsUI,
  toggleComments,
} from './features/comments.js';
import {
  setupWorkspace,
  renderWorkspaceSidebar,
  openWorkspaceFolder,
  hasWorkspace,
  configureWorkspace,
  tryOpenDroppedFolder,
  isFolderDragDropSupported,
} from './features/workspace.js';
import {
  setupDesktopIPC,
  updateWatchToggle,
  saveDesktopSession,
  startWatchingFilePath,
  stopWatchingFilePath,
  configureDesktop,
} from './platform/desktop.js';
import { bridgeRequestOpenPath } from './platform/bridge.js';

// ===========================
// Constants
// ===========================
const APP_VERSION = '0.0.152';
const APP_VERSION_LABEL = 'alpha';
const SOURCE_REPO = 'cbremer/specdown';
const SOURCE_REPO_URL = 'https://github.com/' + SOURCE_REPO;

// ===========================
// Global State
// ===========================

// ===========================
// DOM Elements
// ===========================
const $ = (/** @type {string} */ id) => document.getElementById(id);
// `req` is for elements the app assumes always exist (used unguarded below); it
// casts the null away. At runtime a missing element throws on first use, exactly
// as before this typing pass.
const req = (/** @type {string} */ id) => /** @type {HTMLElement} */ (document.getElementById(id));

const dropZone = req('drop-zone');
const fileInput = req('file-input');
const browseButton = req('browse-button');
const openSampleBasic = $('open-sample-basic');
const openSampleMermaid = $('open-sample-mermaid');
const contentArea = req('content-area');
const markdownContent = req('markdown-content');
const fileName = req('file-name');
const themeToggle = req('theme-toggle');
// The fullscreen overlay carries expando properties set by features/diagrams.js.
const fullscreenOverlay = /** @type {HTMLElement & { panzoomInstance?: any, fullscreenState?: { homeState: { scale: number, x: number, y: number } } }} */ (
    document.getElementById('fullscreen-overlay')
);
const viewToggle = req('view-toggle');
const urlInput = /** @type {HTMLInputElement | null} */ ($('url-input'));
const openUrlBtn = $('open-url-btn');
const urlError = $('url-error');
const tocToggle = $('toc-toggle');
const annotationToggle = $('annotation-toggle');
const annotationListToggle = $('annotation-list-toggle');
const annotationPanelClose = $('annotation-panel-close');
const splitToggle = $('split-toggle');
const splitRawPane = $('split-raw-pane');
const splitRawContent = $('split-raw-content');
const printButton = $('print-button');
const presentButton = $('present-button');
const workspaceToggle = $('workspace-toggle');
const searchBar = $('search-bar');
const searchInput = /** @type {HTMLInputElement | null} */ ($('search-input'));
const searchPrev = $('search-prev');
const searchNext = $('search-next');
const searchClose = $('search-close');
const shareToast = $('share-toast');
const iosOpenButton = $('ios-open-button');
const iosContentsButton = /** @type {HTMLButtonElement | null} */ ($('ios-contents-button'));
const iosViewButton = /** @type {HTMLButtonElement | null} */ ($('ios-view-button'));
const iosMoreButton = /** @type {HTMLButtonElement | null} */ ($('ios-more-button'));
const iosActionSheet = $('ios-action-sheet');
const iosActionSheetClose = $('ios-action-sheet-close');
const iosSplitButton = /** @type {HTMLButtonElement | null} */ ($('ios-split-button'));
const iosPresentButton = /** @type {HTMLButtonElement | null} */ ($('ios-present-button'));
const iosCommentsButton = /** @type {HTMLButtonElement | null} */ ($('ios-comments-button'));
const iosAnnotationsButton = /** @type {HTMLButtonElement | null} */ ($('ios-annotations-button'));
const iosPrintButton = /** @type {HTMLButtonElement | null} */ ($('ios-print-button'));
const iosThemeButton = $('ios-theme-button');
const iosTocSheet = $('ios-toc-sheet');
const iosTocClose = $('ios-toc-close');

// ===========================
// Initialization
// ===========================
function init() {
    configureTheme({ reRenderDiagrams: () => reRenderMermaidDiagrams() });
    configureFileLoading({
        createTab: (/** @type {string} */ filename, /** @type {string} */ content, /** @type {string | null} */ filePath) =>
            createTab(filename, content, filePath),
    });
    configureShareLinks({
        createTab: (/** @type {string} */ filename, /** @type {string} */ md) => createTab(filename, md),
    });
    configureViewMode({
        renderMarkdown: (/** @type {string} */ content, /** @type {string} */ title) => renderMarkdown(content, title),
        cleanupPanzoom: () => cleanupPanzoomInstances(),
    });
    configureTabs({
        renderMarkdown: (/** @type {string} */ content, /** @type {string} */ title) => renderMarkdown(content, title),
        updateWatchToggle: () => updateWatchToggle(),
        saveDesktopSession: () => saveDesktopSession(),
        startWatchingFilePath: (/** @type {string | null} */ filePath) => startWatchingFilePath(filePath),
        stopWatchingFilePath: (/** @type {string | null} */ filePath) => stopWatchingFilePath(filePath),
    });
    configureDesktop({
        renderMarkdown: (/** @type {string} */ content, /** @type {string} */ title) => renderMarkdown(content, title),
    });
    configureRecentFiles({ onSelect: (entry) => openRecentEntry(entry) });
    configureWorkspace({
        openFile: (/** @type {string} */ name, /** @type {string} */ content) => createTab(name, content, null),
    });
    registerAppCommands();
    setupVersionInfo();
    setupTheme();
    setupIOSNativeUI();
    setupToolbarOverflow();
    setupRecentFiles();
    setupWorkspace();
    setupComments();
    setupEventListeners();
    configureMarked();
    checkForUpdates();
    checkForDiagramLink();
    registerServiceWorker();
    // Open .md/.markdown files launched via the OS "Open with" on an installed PWA.
    registerFileHandlerLaunchConsumer((/** @type {File} */ file) => handleFile(file));
    // Session restore (web only): reopen the last document on launch, unless a
    // shared diagram link already opened something. The native shells manage
    // their own session, so they're excluded.
    if (!isDesktop && !isIOSNative && state.tabs.length === 0) {
        restoreLastSession();
    }
    if (isDesktop) {
        setupDesktopIPC();
    }
}

// ===========================
// Command Palette registry
// ===========================
// The modifier glyph shown in command hints — ⌘ on Apple platforms, Ctrl else.
const CMD_MOD = /Mac|iPhone|iPad/.test(navigator.platform || '') ? '⌘' : 'Ctrl';

// Commands that act on the open document are only offered while one is visible.
const isDocumentOpen = () => contentArea.style.display !== 'none';

function registerAppCommands() {
    registerCommands([
        {
            id: 'open-file',
            title: 'Open file…',
            keywords: ['browse', 'load', 'new'],
            run: () => {
                if (!requestNativeOpenIfAvailable()) fileInput.click();
            },
        },
        {
            id: 'open-folder',
            title: 'Open folder…',
            keywords: ['workspace', 'directory', 'browse', 'files', 'sidebar'],
            run: () => openWorkspaceFolder(),
            isAvailable: () => isDesktop,
        },
        {
            id: 'toggle-theme',
            title: 'Toggle theme (light / dark / system)',
            keywords: ['dark', 'light', 'appearance', 'color'],
            run: () => toggleTheme(),
        },
        {
            id: 'toggle-view',
            title: 'Toggle raw / preview',
            keywords: ['markdown', 'source', 'code'],
            run: () => toggleViewMode(),
            isAvailable: isDocumentOpen,
        },
        {
            id: 'toggle-toc',
            title: 'Toggle table of contents',
            keywords: ['outline', 'headings', 'contents'],
            run: () => toggleToc(),
            isAvailable: isDocumentOpen,
        },
        {
            id: 'toggle-comments',
            title: 'Show / hide HTML comments',
            keywords: ['comments', 'hidden', 'html', 'reveal'],
            run: () => toggleComments(),
            isAvailable: isDocumentOpen,
        },
        {
            id: 'toggle-split',
            title: 'Toggle split view',
            keywords: ['preview', 'raw', 'side'],
            run: () => toggleSplitView(),
            isAvailable: isDocumentOpen,
        },
        {
            id: 'toggle-annotate',
            title: 'Toggle annotation mode',
            keywords: ['notes', 'comment', 'markup'],
            run: () => {
                toggleAnnotationMode();
                syncIOSChrome();
            },
            isAvailable: isDocumentOpen,
        },
        {
            id: 'show-annotations',
            title: 'Show annotations list',
            keywords: ['notes', 'annotations', 'panel', 'comments'],
            run: () => openAnnotationPanel(),
            isAvailable: isDocumentOpen,
        },
        {
            id: 'find',
            title: 'Find in document',
            hint: CMD_MOD + ' F',
            keywords: ['search'],
            run: () => openSearch(),
            isAvailable: isDocumentOpen,
        },
        {
            id: 'print',
            title: 'Print / Save as PDF',
            hint: CMD_MOD + ' P',
            keywords: ['pdf', 'export', 'save'],
            run: () => performPrint(),
            isAvailable: isDocumentOpen,
        },
        {
            id: 'present-diagrams',
            title: 'Present diagrams',
            keywords: ['presentation', 'slideshow', 'fullscreen', 'mermaid', 'diagram'],
            run: () => startPresentation(),
            isAvailable: () => isDocumentOpen() && hasPresentableDiagrams(),
        },
        {
            id: 'export-annotations',
            title: 'Export annotations',
            keywords: ['annotations', 'notes', 'download', 'backup', 'json'],
            run: () => exportAnnotations(),
        },
        {
            id: 'import-annotations',
            title: 'Import annotations',
            keywords: ['annotations', 'notes', 'upload', 'restore', 'json'],
            run: () => importAnnotationsFromFile(),
        },
        {
            id: 'shortcuts',
            title: 'Keyboard shortcuts',
            hint: '?',
            keywords: ['help', 'keys', 'cheatsheet'],
            run: () => openShortcutsSheet(),
        },
    ]);
}

// ===========================
// Recent Files
// ===========================
// Re-open a recents entry: URLs re-fetch via handleUrl; desktop file paths are
// re-read by the Electron main process over the requestOpenPath bridge.
/** @param {import('./features/recent-files.js').RecentEntry} entry */
function openRecentEntry(entry) {
    if (entry.type === 'path') {
        bridgeRequestOpenPath(entry.ref);
        return;
    }
    handleUrl(entry.ref);
}

function setupRecentFiles() {
    renderRecentFiles();
    const clearBtn = $('recent-files-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearRecentFiles();
            renderRecentFiles();
        });
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
        const target = /** @type {HTMLElement | null} */ (e.target);
        if (target && target.closest('.url-section')) return;
        if (e.target === dropZone || (target && target.closest('.drop-zone-content'))) {
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
        tocToggle.addEventListener('click', () => toggleToc());
    }

    // Annotation toggle (sync iOS chrome after toggling)
    if (annotationToggle) {
        annotationToggle.addEventListener('click', () => {
            toggleAnnotationMode();
            syncIOSChrome();
        });
    }

    // Annotations list panel (toggle button + close button)
    if (annotationListToggle) {
        annotationListToggle.addEventListener('click', () => toggleAnnotationPanel());
    }
    if (annotationPanelClose) {
        annotationPanelClose.addEventListener('click', () => toggleAnnotationPanel());
    }

    // Split view toggle
    if (splitToggle) {
        splitToggle.addEventListener('click', toggleSplitView);
    }

    // Print button
    if (printButton) {
        printButton.addEventListener('click', performPrint);
    }

    // Present button (shown only when the document has diagrams)
    if (presentButton) {
        presentButton.addEventListener('click', () => startPresentation());
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

    if (iosPresentButton) {
        iosPresentButton.addEventListener('click', () => {
            closeIOSActionSheet();
            startPresentation();
        });
    }

    if (iosCommentsButton) {
        iosCommentsButton.addEventListener('click', () => {
            closeIOSActionSheet();
            toggleComments();
        });
    }

    if (iosAnnotationsButton) {
        iosAnnotationsButton.addEventListener('click', () => {
            closeIOSActionSheet();
            openAnnotationPanel();
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
        // Cmd/Ctrl+K — toggle the command palette (works anywhere)
        if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            toggleCommandPalette();
            return;
        }
        // "?" — open the keyboard shortcut sheet (unless typing or in a dialog)
        if (e.key === '?' && !isTypingTarget(e.target) && !isCommandPaletteOpen()) {
            e.preventDefault();
            openShortcutsSheet();
            return;
        }
        // ESC
        if (e.key === 'Escape') {
            if (isCommandPaletteOpen()) {
                closeCommandPalette();
            } else if (isShortcutsSheetOpen()) {
                closeShortcutsSheet();
            } else if (isPresentationOpen()) {
                exitPresentation();
            } else if (isOverflowMenuOpen()) {
                closeOverflowMenu();
            } else if (fullscreenOverlay.style.display !== 'none') {
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
        if (!e.dataTransfer) return;
        // Capture files synchronously — the FileList is invalidated after the event.
        const droppedFiles = Array.from(e.dataTransfer.files || []);
        const openDroppedFiles = () => {
            if (state.tabs.length > 0) {
                for (const file of droppedFiles) handleFile(file);
            }
        };
        // Folder drag-and-drop is Chromium-only and async; elsewhere open files
        // directly (keeps the synchronous drop path on other browsers).
        if (isFolderDragDropSupported()) {
            tryOpenDroppedFolder(e.dataTransfer).then((handled) => {
                if (!handled) openDroppedFiles();
            });
        } else {
            openDroppedFiles();
        }
    });

    // TOC scroll spy
    markdownContent.addEventListener('scroll', scheduleTocActiveHeadingUpdate);
}

// True when the event target is a text-entry element, so global single-key
// shortcuts (like "?") don't fire while the user is typing.
/** @param {EventTarget | null} target */
function isTypingTarget(target) {
    if (!target) return false;
    const element = /** @type {HTMLElement} */ (target);
    const tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || element.isContentEditable === true;
}

// ===========================
// Drag and Drop Handlers
// ===========================
/** @param {DragEvent} e */
function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add('drag-over');
}

/** @param {DragEvent} e */
function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!dropZone.contains(/** @type {Node | null} */ (e.relatedTarget))) {
        dropZone.classList.remove('drag-over');
    }
}

/** @param {DragEvent} e */
function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove('drag-over');

    if (!e.dataTransfer) return;
    // Capture files synchronously — the FileList is invalidated after the event.
    const droppedFiles = Array.from(e.dataTransfer.files || []);
    const openDroppedFiles = () => {
        for (const file of droppedFiles) handleFile(file);
    };
    // A dropped folder opens as a workspace (Chromium, async); otherwise — and on
    // browsers without the API — fall back to opening the dropped files directly.
    if (isFolderDragDropSupported()) {
        tryOpenDroppedFolder(e.dataTransfer).then((handled) => {
            if (!handled) openDroppedFiles();
        });
    } else {
        openDroppedFiles();
    }
}


// ===========================
// Markdown Rendering
// ===========================
/**
 * @param {string} content
 * @param {string} filename
 */
async function renderMarkdown(content, filename) {
    try {
        // Clean up existing panzoom instances
        cleanupPanzoomInstances();

        // Store raw markdown for toggle
        state.currentRawMarkdown = content;
        state.currentViewMode = 'preview';
        updateViewToggleButton();

        // Parse markdown to HTML (synchronous: marked.parse returns a string here)
        const htmlContent = /** @type {string} */ (marked.parse(content));

        // Update UI
        fileName.textContent = filename;
        // Keep HTML comment nodes through sanitization (`#comment`) so they can
        // be revealed below — DOMPurify strips them by default, which silently
        // dropped authored `<!-- … -->` content from the preview.
        markdownContent.innerHTML = DOMPurify.sanitize(htmlContent, { ADD_TAGS: ['#comment'] });

        // Reveal authored HTML comments as styled blocks, then sync the toggle.
        revealHtmlComments(markdownContent);
        refreshCommentsUI();

        // Add copy buttons to code blocks
        enhanceCodeBlocks(markdownContent);

        // Show content area, hide drop zone
        dropZone.style.display = 'none';
        contentArea.style.display = 'flex';
        syncIOSChrome();

        // Process mermaid diagrams
        await processMermaidDiagrams();

        // Reveal the Present entry points (desktop toolbar + iPhone action sheet)
        // only when there are diagrams to present.
        const canPresent = hasPresentableDiagrams();
        if (presentButton) {
            presentButton.style.display = canPresent ? '' : 'none';
        }
        if (iosPresentButton) {
            iosPresentButton.style.display = canPresent ? '' : 'none';
        }

        // Reveal the workspace Files toggle when a folder is loaded, and refresh
        // the sidebar so the active file is highlighted.
        if (workspaceToggle) {
            workspaceToggle.style.display = hasWorkspace() ? '' : 'none';
        }
        renderWorkspaceSidebar();

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
        showToast('Error rendering markdown content. Please check the file format.', { type: 'error' });
    }
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
