// Table of contents: builds a heading outline, toggles the sidebar (or the iOS
// sheet), and runs scroll-spy to highlight the active heading.

import { state } from '../core/state.js';
import { isIOSNative } from '../core/platform.js';
import {
  syncIOSChrome,
  closeIOSTocSheet,
  closeIOSActionSheet,
  setIOSSheetVisibility,
} from '../platform/ios-chrome.js';

const el = (id) => document.getElementById(id);

export function buildToc() {
  const tocNav = el('toc-nav');
  const iosTocNav = el('ios-toc-nav');
  if (!tocNav && !iosTocNav) return;
  const markdownContent = el('markdown-content');
  const headings = markdownContent.querySelectorAll('h1, h2, h3, h4');
  state.tocEntries = [];

  headings.forEach((h, i) => {
    // Ensure each heading has an id for anchor linking
    if (!h.id) {
      h.id = 'toc-heading-' + i;
    }

    state.tocEntries.push({
      id: h.id,
      level: parseInt(h.tagName[1], 10),
      text: h.textContent,
    });
  });

  renderTocNavigation(tocNav);
  renderTocNavigation(iosTocNav);

  const tocToggle = el('toc-toggle');
  if (tocToggle) {
    tocToggle.style.display = state.tocEntries.length > 0 && !isIOSNative ? '' : 'none';
  }

  if (state.tocEntries.length === 0 && state.tocVisible) {
    toggleToc(false);
  } else {
    scheduleTocActiveHeadingUpdate();
  }

  syncIOSChrome();
}

function renderTocNavigation(navElement) {
  if (!navElement) return;
  navElement.innerHTML = '';

  state.tocEntries.forEach((entry) => {
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

export function toggleToc(forceState) {
  const nextVisible = typeof forceState === 'boolean' ? forceState : !state.tocVisible;
  if (isIOSNative && nextVisible && (state.currentViewMode !== 'preview' || state.tocEntries.length === 0)) {
    return;
  }

  state.tocVisible = nextVisible;
  if (isIOSNative) {
    if (state.tocVisible) {
      closeIOSActionSheet();
      setIOSSheetVisibility(el('ios-toc-sheet'), true);
      updateTocActiveHeading();
    } else {
      setIOSSheetVisibility(el('ios-toc-sheet'), false);
    }
  } else {
    const tocSidebar = el('toc-sidebar');
    if (tocSidebar) tocSidebar.style.display = state.tocVisible ? '' : 'none';
  }
  const tocToggle = el('toc-toggle');
  if (tocToggle) tocToggle.classList.toggle('active', state.tocVisible);
  syncIOSChrome();
}

export function scheduleTocActiveHeadingUpdate() {
  if (!state.tocVisible || state.tocScrollSpyScheduled) return;
  state.tocScrollSpyScheduled = true;
  requestAnimationFrame(() => {
    state.tocScrollSpyScheduled = false;
    updateTocActiveHeading();
  });
}

function updateTocActiveHeading() {
  if (!state.tocVisible) return;
  const markdownContent = el('markdown-content');
  const headings = markdownContent.querySelectorAll('h1, h2, h3, h4');
  const scrollTop = markdownContent.scrollTop;
  let activeId = null;

  headings.forEach((h) => {
    if (h.offsetTop - 60 <= scrollTop) {
      activeId = h.id;
    }
  });

  [el('toc-nav'), el('ios-toc-nav')].forEach((navElement) => {
    if (!navElement) return;
    navElement.querySelectorAll('.toc-link').forEach((link) => {
      const isActive = link.getAttribute('href') === '#' + activeId;
      link.classList.toggle('toc-link-active', isActive);
    });
  });
}
