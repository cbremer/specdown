// Tab management: the open-document model (create / switch / close), the tab
// bar UI, and the empty-state drop zone reset.
//
// Tabs are coupled to two things that live elsewhere: the render core
// (`renderMarkdown`, main.js) and the desktop file-watch / session layer
// (platform/desktop.js). Both are supplied via configureTabs so this module
// has no import cycle with the desktop layer. The DI vars are named to avoid
// colliding with those globals under the test harness (which flattens every
// module to global scope).

import { state } from '../core/state.js';
import { isDesktop } from '../core/platform.js';
import { escapeHtml } from '../core/utils.js';
import { cleanupPanzoomInstances, closeFullscreen } from './diagrams.js';
import { closeSearch } from './search.js';
import { toggleToc } from './toc.js';
import { toggleSplitView } from './split-view.js';
import { updateViewToggleButton } from './view-mode.js';
import { showToast } from './toast.js';
import {
  requestNativeOpenIfAvailable,
  syncIOSChrome,
  closeIOSActionSheet,
  closeIOSTocSheet,
} from '../platform/ios-chrome.js';

const MAX_TABS = 10;
const el = (id) => document.getElementById(id);

// Render-core / desktop callbacks, wired by configureTabs in init().
let renderDoc = () => {};
let refreshWatchUI = () => {};
let persistSession = () => {};
let beginWatch = () => {};
let endWatch = () => {};

export function configureTabs(deps) {
  if (!deps) return;
  if (typeof deps.renderMarkdown === 'function') renderDoc = deps.renderMarkdown;
  if (typeof deps.updateWatchToggle === 'function') refreshWatchUI = deps.updateWatchToggle;
  if (typeof deps.saveDesktopSession === 'function') persistSession = deps.saveDesktopSession;
  if (typeof deps.startWatchingFilePath === 'function') beginWatch = deps.startWatchingFilePath;
  if (typeof deps.stopWatchingFilePath === 'function') endWatch = deps.stopWatchingFilePath;
}

function saveActiveTabState() {
  if (state.activeTabId === null) return;
  const tab = state.tabs.find((t) => t.id === state.activeTabId);
  if (!tab) return;
  tab.viewMode = state.currentViewMode;
  const markdownContent = el('markdown-content');
  if (markdownContent) tab.scrollTop = markdownContent.scrollTop;
}

export function renderTabBar() {
  const tabBar = el('tab-bar');
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
    html += `<button class="tab-close" data-close-id="${tab.id}" title="Close tab" aria-label="Close ${escapeHtml(tab.filename)}">×</button>`;
    html += `</div>`;
  }
  html += `<button class="tab-new" title="Open new file" aria-label="Open new file">+</button>`;

  tabBar.innerHTML = html;

  tabBar.querySelectorAll('.tab').forEach((tabEl) => {
    tabEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) return;
      const id = parseInt(tabEl.getAttribute('data-tab-id'), 10);
      switchTab(id);
    });
  });

  tabBar.querySelectorAll('.tab-close').forEach((btn) => {
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
      const fileInput = el('file-input');
      if (fileInput) fileInput.click();
    });
  }
}

export function createTab(filename, content, filePath) {
  if (state.tabs.length >= MAX_TABS) {
    showToast('Maximum of ' + MAX_TABS + ' tabs reached. Close a tab to open another file.', {
      type: 'warning',
    });
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
    hasUnseenChanges: false,
  };
  state.tabs.push(tab);
  state.activeTabId = id;

  if (tab.watching) {
    beginWatch(tab.filePath);
  }

  renderTabBar();
  if (isDesktop) {
    refreshWatchUI();
    persistSession();
  }
  renderDoc(content, filename);
}

export async function switchTab(id) {
  if (id === state.activeTabId) return;

  saveActiveTabState();
  state.activeTabId = id;
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab) return;

  // Clear the "unseen changes" flag now that the user is looking at it.
  tab.hasUnseenChanges = false;

  renderTabBar();
  if (isDesktop) refreshWatchUI();
  cleanupPanzoomInstances();

  const markdownContent = el('markdown-content');

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
    el('file-name').textContent = tab.filename;
    el('drop-zone').style.display = 'none';
    el('content-area').style.display = 'flex';
    updateViewToggleButton();
    markdownContent.scrollTop = tab.scrollTop;
    syncIOSChrome();
  } else {
    await renderDoc(tab.rawMarkdown, tab.filename);
    markdownContent.scrollTop = tab.scrollTop;
  }
}

export async function closeTab(id) {
  const idx = state.tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;

  const wasActive = id === state.activeTabId;
  const closedTab = state.tabs[idx];

  // Stop watching before removing the tab
  if (isDesktop && closedTab.watching && closedTab.filePath) {
    endWatch(closedTab.filePath);
  }

  if (wasActive) {
    cleanupPanzoomInstances();
  }

  state.tabs.splice(idx, 1);

  if (isDesktop) persistSession();

  if (state.tabs.length === 0) {
    state.activeTabId = null;
    renderTabBar();
    if (isDesktop) refreshWatchUI();
    showDropZone();
  } else if (wasActive) {
    const newIdx = Math.min(idx, state.tabs.length - 1);
    const newTab = state.tabs[newIdx];
    state.activeTabId = newTab.id;
    renderTabBar();
    if (isDesktop) refreshWatchUI();

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
      el('markdown-content').innerHTML = `<pre class="raw-markdown"><code>${escaped}</code></pre>`;
      el('file-name').textContent = newTab.filename;
      el('drop-zone').style.display = 'none';
      el('content-area').style.display = 'flex';
      updateViewToggleButton();
      syncIOSChrome();
    } else {
      await renderDoc(newTab.rawMarkdown, newTab.filename);
    }
  } else {
    renderTabBar();
  }
}

export function showDropZone() {
  // Cleanup
  cleanupPanzoomInstances();
  closeFullscreen();
  closeSearch();
  closeIOSActionSheet();
  closeIOSTocSheet();

  // Clear content
  el('markdown-content').innerHTML = '';
  el('file-name').textContent = '';
  el('file-input').value = '';
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
  const tocNav = el('toc-nav');
  if (tocNav) tocNav.innerHTML = '';
  const iosTocNav = el('ios-toc-nav');
  if (iosTocNav) iosTocNav.innerHTML = '';
  state.tocEntries = [];
  const tocSidebar = el('toc-sidebar');
  if (tocSidebar) tocSidebar.style.display = 'none';

  // Show drop zone, hide content
  el('content-area').style.display = 'none';
  el('drop-zone').style.display = 'flex';
  syncIOSChrome();
}
