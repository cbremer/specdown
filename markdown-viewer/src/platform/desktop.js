// @ts-check
// Desktop (Electron) integration: the file-watch model, the watch-toggle UI,
// session persistence, and the IPC wiring to the main process (native menus,
// file-open / file-changed / close-tab events, custom CSS).
//
// Tabs live in features/tabs.js; this layer drives them (createTab/closeTab on
// IPC events) and supplies tabs with the watch/session callbacks via
// configureTabs in main.js. The render core (renderMarkdown) is supplied here
// via configureDesktop — its DI var is named to avoid colliding with tabs.js's
// own render callback under the test harness.

import { state } from '../core/state.js';
import { isDesktop } from '../core/platform.js';
import { createTab, closeTab, renderTabBar } from '../features/tabs.js';
import { openSearch } from '../features/search.js';
import { applyCustomCss } from '../features/custom-css.js';
import { recordRecentFile, renderRecentFiles } from '../features/recent-files.js';
import { showToast } from '../features/toast.js';
import { performPrint, buildPrintableDocument, hasLoadedContent } from './ios-chrome.js';
import {
  hasDesktopBridge,
  bridgeWatchFile,
  bridgeUnwatchFile,
  bridgeRequestRefreshFile,
  bridgeSaveSession,
  bridgeExportPdf,
  bridgeOnFileOpened,
  bridgeOnFileChanged,
  bridgeOnCloseTab,
  bridgeOnTriggerPrint,
  bridgeOnTriggerExportPdf,
  bridgeOnTriggerSearch,
  bridgeOnApplyCustomCss,
  bridgeOnUpdateDownloaded,
  bridgeRestartToUpdate,
} from './bridge.js';

const el = (/** @type {string} */ id) => document.getElementById(id);

/** @type {Map<string, number>} filePath -> number of watching tabs */
const watchRefCounts = new Map();

// Render core (main.js), supplied via configureDesktop.
/** @type {(content: string, filename: string) => any} */
let reloadDoc = () => {};

/** @param {{ renderMarkdown?: Function }} [deps] */
export function configureDesktop(deps) {
  if (deps && typeof deps.renderMarkdown === 'function') {
    reloadDoc = /** @type {typeof reloadDoc} */ (deps.renderMarkdown);
  }
}

// The "Live" chip beside the filename: the single visible home for live-reload
// state. Green "Live" while auto-reloading, grey "Paused" when stopped, a
// brief "Updated" flash when a disk change lands. Click toggles pause/resume.
export function updateWatchToggle() {
  const watchToggle = el('watch-toggle');
  if (!watchToggle) return;

  const tab = state.activeTabId !== null ? state.tabs.find((t) => t.id === state.activeTabId) : null;

  if (!isDesktop || !tab || !tab.filePath) {
    watchToggle.style.display = 'none';
    return;
  }

  const label = watchToggle.querySelector('.watch-toggle-label');
  watchToggle.style.display = '';
  if (tab.watching) {
    watchToggle.classList.add('active');
    if (label) label.textContent = 'Live';
    watchToggle.title =
      'Live reload is on — this document updates automatically when the file changes on disk. Click to pause.';
  } else {
    watchToggle.classList.remove('active');
    if (label) label.textContent = 'Paused';
    watchToggle.title = 'Live reload is paused — click to resume.';
  }
}

// Briefly animate the watch toggle to signal that an auto-reload just
// happened. Without this, the reload is invisible if the user happens
// not to be looking at the content area when the disk write lands.
/** @type {ReturnType<typeof setTimeout> | null} */
let watchTogglePulseTimer = null;
function pulseWatchToggle() {
  const watchToggle = el('watch-toggle');
  if (!watchToggle) return;
  watchToggle.classList.remove('reloaded');
  // Force reflow so re-adding the class restarts the animation even
  // when multiple reloads happen in quick succession.
  void watchToggle.offsetWidth;
  watchToggle.classList.add('reloaded');
  watchToggle.title = 'Reloaded from disk';
  const pulseLabel = watchToggle.querySelector('.watch-toggle-label');
  if (pulseLabel) pulseLabel.textContent = 'Updated';

  if (watchTogglePulseTimer) clearTimeout(watchTogglePulseTimer);
  watchTogglePulseTimer = setTimeout(() => {
    watchToggle.classList.remove('reloaded');
    // Restore the state-appropriate tooltip.
    updateWatchToggle();
    watchTogglePulseTimer = null;
  }, 1200);
}

/** @param {string | null} [filePath] */
export function startWatchingFilePath(filePath) {
  if (!isDesktop || !filePath || !hasDesktopBridge()) return;

  const currentCount = watchRefCounts.get(filePath) || 0;
  watchRefCounts.set(filePath, currentCount + 1);

  if (currentCount === 0) {
    bridgeWatchFile(filePath);
  }
}

/** @param {string | null} [filePath] */
export function stopWatchingFilePath(filePath) {
  if (!isDesktop || !filePath || !hasDesktopBridge()) return;

  const currentCount = watchRefCounts.get(filePath) || 0;
  if (currentCount <= 1) {
    watchRefCounts.delete(filePath);
    bridgeUnwatchFile(filePath);
    return;
  }

  watchRefCounts.set(filePath, currentCount - 1);
}

export function toggleWatching() {
  if (!isDesktop) return;
  const tab = state.activeTabId !== null ? state.tabs.find((t) => t.id === state.activeTabId) : null;
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

// Manual refresh: re-read the active tab's file from disk on demand. The main
// process replies over the existing file-changed channel, so the tab updates
// in place (scroll preserved) and the chip flashes "Updated" — same path as a
// live reload, minus the watcher.
export function refreshActiveFileFromDisk() {
  if (!isDesktop) return;
  const tab = state.activeTabId !== null ? state.tabs.find((t) => t.id === state.activeTabId) : null;
  if (!tab || !tab.filePath) return;
  bridgeRequestRefreshFile(tab.filePath);
}

// Export the current document as a PDF file (desktop only): build the same
// standalone printable document the print pipeline uses and hand it to the
// shell, which renders it offscreen and writes the PDF via printToPDF.
export async function exportActivePdf() {
  if (!isDesktop || !hasDesktopBridge() || !hasLoadedContent()) return;
  const html = await buildPrintableDocument();
  if (!html) return;
  const fileNameEl = el('file-name');
  bridgeExportPdf({
    title: fileNameEl && fileNameEl.textContent ? fileNameEl.textContent : 'Specdown Document',
    html,
  });
}

export function setupDesktopIPC() {
  if (!hasDesktopBridge()) return;

  // Listen for files opened from the main process (Cmd+O, Finder, drag-to-dock)
  bridgeOnFileOpened(function (fileData) {
    createTab(fileData.filename, fileData.content, fileData.filePath);
    // Remember the path so the in-app recent-files list can reopen it later.
    if (fileData.filePath) {
      recordRecentFile({ type: 'path', ref: fileData.filePath, title: fileData.filename });
      renderRecentFiles();
    }
  });

  // Listen for close-tab command from native menu (Cmd+W)
  bridgeOnCloseTab(function () {
    if (state.activeTabId !== null) {
      closeTab(state.activeTabId);
    }
  });

  // Listen for file-changed events (watched file updated on disk, or a manual
  // "Reload from disk"). The same file can be open in more than one tab, so
  // update EVERY matching tab — and, crucially, decide the visible re-render by
  // whether the *active* tab is among them, not by the first match. Keying off
  // the first match (Array.find) silently broke Reload from disk whenever the
  // same file was open twice and the active copy wasn't the first: the handler
  // took the background branch and never refreshed the view.
  bridgeOnFileChanged(async function (fileData) {
    const matchingTabs = state.tabs.filter((t) => t.filePath === fileData.filePath);
    if (matchingTabs.length === 0) return;

    for (const tab of matchingTabs) {
      tab.rawMarkdown = fileData.content;
      tab.filename = fileData.filename;
    }

    const activeTab = matchingTabs.find((t) => t.id === state.activeTabId);

    if (activeTab) {
      // Preserve scroll position across the re-render so an
      // auto-reload doesn't yank the user back to the top.
      const markdownContent = el('markdown-content');
      if (!markdownContent) return;
      const savedScrollTop = markdownContent.scrollTop;

      if (activeTab.viewMode === 'raw') {
        state.currentRawMarkdown = fileData.content;
        const escaped = fileData.content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        markdownContent.innerHTML = `<pre class="raw-markdown"><code>${escaped}</code></pre>`;
        markdownContent.scrollTop = savedScrollTop;
      } else {
        await reloadDoc(fileData.content, fileData.filename);
        markdownContent.scrollTop = savedScrollTop;
      }

      // Visual feedback that an auto-reload happened — otherwise
      // the user has no way to tell the content just changed.
      pulseWatchToggle();
    }

    // Flag any non-active copies so the user sees that something changed when
    // they come back to them. (When the active tab wasn't among the matches,
    // this covers every match — the previous background-tab behavior.)
    let flaggedBackground = false;
    for (const tab of matchingTabs) {
      if (tab.id === state.activeTabId) continue;
      tab.hasUnseenChanges = true;
      flaggedBackground = true;
    }
    if (flaggedBackground) renderTabBar();
  });

  // Wire up watch toggle button
  const watchToggle = el('watch-toggle');
  if (watchToggle) {
    watchToggle.addEventListener('click', toggleWatching);
  }

  // Native menu: File > Print
  bridgeOnTriggerPrint(function () {
    performPrint();
  });

  // Native menu: File > Export as PDF
  bridgeOnTriggerExportPdf(function () {
    exportActivePdf();
  });

  // Native menu: Edit > Find
  bridgeOnTriggerSearch(function () {
    const contentArea = el('content-area');
    if (contentArea && contentArea.style.display !== 'none') {
      openSearch();
    }
  });

  // Appearance menu: apply custom CSS theme
  bridgeOnApplyCustomCss(function (cssContent) {
    applyCustomCss(cssContent);
  });

  // Auto-update: a downloaded update is ready — offer a one-click restart.
  bridgeOnUpdateDownloaded(function (info) {
    const version = info && info.version ? ` (v${info.version})` : '';
    showToast(`An update${version} is ready to install.`, {
      type: 'success',
      duration: 0, // persist until the user acts
      action: { label: 'Restart now', onClick: () => bridgeRestartToUpdate() },
    });
  });
}

export function saveDesktopSession() {
  if (!isDesktop || !hasDesktopBridge()) return;
  bridgeSaveSession(
    state.tabs.map((t) => ({
      filePath: t.filePath,
      filename: t.filename,
    }))
  );
}
