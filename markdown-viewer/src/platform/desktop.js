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
import { performPrint } from './ios-chrome.js';

const el = (id) => document.getElementById(id);

const watchRefCounts = new Map(); // filePath -> number of watching tabs

// Render core (main.js), supplied via configureDesktop.
let reloadDoc = () => {};

export function configureDesktop(deps) {
  if (deps && typeof deps.renderMarkdown === 'function') reloadDoc = deps.renderMarkdown;
}

export function updateWatchToggle() {
  const watchToggle = el('watch-toggle');
  if (!watchToggle) return;

  const tab = state.activeTabId !== null ? state.tabs.find((t) => t.id === state.activeTabId) : null;
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
  const watchToggle = el('watch-toggle');
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

export function startWatchingFilePath(filePath) {
  if (!isDesktop || !filePath || !window.specdown || !window.specdown.watchFile) return;

  const currentCount = watchRefCounts.get(filePath) || 0;
  watchRefCounts.set(filePath, currentCount + 1);

  if (currentCount === 0) {
    window.specdown.watchFile(filePath);
  }
}

export function stopWatchingFilePath(filePath) {
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

export function setupDesktopIPC() {
  // Listen for files opened from the main process (Cmd+O, Finder, drag-to-dock)
  window.specdown.onFileOpened(function (fileData) {
    createTab(fileData.filename, fileData.content, fileData.filePath);
  });

  // Listen for close-tab command from native menu (Cmd+W)
  window.specdown.onCloseTab(function () {
    if (state.activeTabId !== null) {
      closeTab(state.activeTabId);
    }
  });

  // Listen for file-changed events (watched file updated on disk)
  window.specdown.onFileChanged(async function (fileData) {
    const tab = state.tabs.find((t) => t.filePath === fileData.filePath);
    if (!tab) return;

    tab.rawMarkdown = fileData.content;
    tab.filename = fileData.filename;

    if (tab.id === state.activeTabId) {
      // Preserve scroll position across the re-render so an
      // auto-reload doesn't yank the user back to the top.
      const markdownContent = el('markdown-content');
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
        await reloadDoc(fileData.content, fileData.filename);
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
  const watchToggle = el('watch-toggle');
  if (watchToggle) {
    watchToggle.addEventListener('click', toggleWatching);
  }

  // Native menu: File > Print
  if (window.specdown.onTriggerPrint) {
    window.specdown.onTriggerPrint(function () {
      performPrint();
    });
  }

  // Native menu: Edit > Find
  if (window.specdown.onTriggerSearch) {
    window.specdown.onTriggerSearch(function () {
      if (el('content-area').style.display !== 'none') {
        openSearch();
      }
    });
  }

  // Appearance menu: apply custom CSS theme
  if (window.specdown.onApplyCustomCss) {
    window.specdown.onApplyCustomCss(function (cssContent) {
      applyCustomCss(cssContent);
    });
  }
}

export function saveDesktopSession() {
  if (!isDesktop || !window.specdown.saveSession) return;
  window.specdown.saveSession(
    state.tabs.map((t) => ({
      filePath: t.filePath,
      filename: t.filename,
    }))
  );
}
