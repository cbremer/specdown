// @ts-check
// In-document search: highlight matches in the rendered markdown and navigate
// between them. State is private to this module.
import { isPresentationOpen } from './presentation.js';

// A small document can otherwise expand into millions of highlight nodes.
// Stop after finding one overflow match; never allocate a mark for that match.
const SEARCH_MAX_HIGHLIGHTS = 1000;
let searchResultsTruncated = false;
/** @type {HTMLElement[]} */
let searchMatches = [];
let searchCurrentIndex = -1;
/** @type {HTMLElement[]} */
let searchHighlightNodes = [];

const el = (/** @type {string} */ id) => document.getElementById(id);

/** @param {string} str */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightCurrentMatch() {
  searchMatches.forEach((m, i) => {
    m.classList.toggle('search-highlight-current', i === searchCurrentIndex);
  });
  if (searchMatches[searchCurrentIndex]) {
    searchMatches[searchCurrentIndex].scrollIntoView({
      block: 'center',
      behavior: 'smooth',
    });
  }
}

function updateSearchCount() {
  const searchCount = el('search-count');
  if (!searchCount) return;
  searchCount.setAttribute('role', 'status');
  searchCount.setAttribute('aria-live', 'polite');
  searchCount.setAttribute('aria-atomic', 'true');
  if (searchMatches.length === 0) {
    searchCount.textContent = '';
    searchCount.removeAttribute('aria-label');
    searchCount.removeAttribute('title');
  } else {
    searchCount.textContent =
      searchCurrentIndex + 1 + ' / ' + searchMatches.length +
      (searchResultsTruncated ? '+' : '');
    if (searchResultsTruncated) {
      searchCount.setAttribute(
        'aria-label',
        `Match ${searchCurrentIndex + 1} of the first ${SEARCH_MAX_HIGHLIGHTS} matches. More matches are not highlighted.`
      );
      searchCount.title = `Showing the first ${SEARCH_MAX_HIGHLIGHTS} matches. More matches are not highlighted.`;
    } else {
      searchCount.setAttribute(
        'aria-label',
        `Match ${searchCurrentIndex + 1} of ${searchMatches.length}`
      );
      searchCount.removeAttribute('title');
    }
  }
}

export function openSearch() {
  // All entry points (shortcut, palette and toolbar) share this boundary.
  // Find belongs to the document, which these diagram surfaces obscure.
  const fullscreen = el('fullscreen-overlay');
  if (isPresentationOpen() || (fullscreen && fullscreen.style.display !== 'none')) return;
  const searchBar = el('search-bar');
  if (!searchBar) return;
  searchBar.style.display = 'flex';
  const searchInput = /** @type {HTMLInputElement | null} */ (el('search-input'));
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  clearSearchHighlights();
  updateSearchCount();
}

export function closeSearch() {
  const searchBar = el('search-bar');
  if (!searchBar) return;
  searchBar.style.display = 'none';
  clearSearchHighlights();
  searchMatches = [];
  searchCurrentIndex = -1;
  updateSearchCount();
}

/** @param {string} query */
export function runSearch(query) {
  const markdownContent = el('markdown-content');
  clearSearchHighlights();
  searchMatches = [];
  searchCurrentIndex = -1;

  if (!query || query.length < 1) {
    updateSearchCount();
    return;
  }
  if (!markdownContent) return;

  // Walk text nodes in markdownContent, wrap matches with <mark>
  const walker = document.createTreeWalker(markdownContent, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      // Skip script/style and diagram wrappers
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
      if (parent.closest('.diagram-wrapper')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const regex = new RegExp(escapeRegex(query), 'gi');
  const nodesToProcess = [];
  let node;
  while ((node = walker.nextNode())) {
    if (regex.test(node.textContent || '')) {
      nodesToProcess.push(node);
    }
    regex.lastIndex = 0;
  }

  for (const textNode of nodesToProcess) {
    // These nodes already contain a match. Once the global budget is full,
    // that establishes overflow without changing this or any later node.
    if (searchMatches.length === SEARCH_MAX_HIGHLIGHTS) {
      searchResultsTruncated = true;
      break;
    }
    const text = textNode.textContent || '';
    const parts = [];
    let lastIndex = 0;
    let match;
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      if (searchMatches.length === SEARCH_MAX_HIGHLIGHTS) {
        searchResultsTruncated = true;
        break;
      }
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

    // lastIndex remains at the last highlighted match when the limit is hit,
    // so the entire unhighlighted suffix (including the overflow match) stays.
    if (lastIndex < text.length) {
      parts.push(document.createTextNode(text.slice(lastIndex)));
    }

    if (parts.length > 0 && textNode.parentNode) {
      const frag = document.createDocumentFragment();
      parts.forEach((p) => frag.appendChild(p));
      textNode.parentNode.replaceChild(frag, textNode);
    }
    if (searchResultsTruncated) break;
  }

  if (searchMatches.length > 0) {
    searchCurrentIndex = 0;
    highlightCurrentMatch();
  }
  updateSearchCount();
}

/** @param {number} direction */
export function navigateSearch(direction) {
  if (searchMatches.length === 0) return;
  searchCurrentIndex =
    (searchCurrentIndex + direction + searchMatches.length) % searchMatches.length;
  highlightCurrentMatch();
  updateSearchCount();
}

export function clearSearchHighlights() {
  // Unwrap all <mark> elements
  searchHighlightNodes.forEach((mark) => {
    if (mark.parentNode) {
      const text = document.createTextNode(mark.textContent || '');
      mark.parentNode.replaceChild(text, mark);
    }
  });
  searchHighlightNodes = [];
  searchMatches = [];
  searchCurrentIndex = -1;
  searchResultsTruncated = false;

  // Normalize text nodes that were split
  const markdownContent = el('markdown-content');
  if (markdownContent) markdownContent.normalize();
  updateSearchCount();
}
