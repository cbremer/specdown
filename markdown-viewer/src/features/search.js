// In-document search: highlight matches in the rendered markdown and navigate
// between them. State is private to this module.

let searchMatches = [];
let searchCurrentIndex = -1;
let searchHighlightNodes = [];

const el = (id) => document.getElementById(id);

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
  if (searchMatches.length === 0) {
    searchCount.textContent = '';
  } else {
    searchCount.textContent =
      searchCurrentIndex + 1 + ' / ' + searchMatches.length;
  }
}

export function openSearch() {
  const searchBar = el('search-bar');
  if (!searchBar) return;
  searchBar.style.display = 'flex';
  const searchInput = el('search-input');
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

export function runSearch(query) {
  const markdownContent = el('markdown-content');
  clearSearchHighlights();
  searchMatches = [];
  searchCurrentIndex = -1;

  if (!query || query.length < 1) {
    updateSearchCount();
    return;
  }

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
      const text = document.createTextNode(mark.textContent);
      mark.parentNode.replaceChild(text, mark);
    }
  });
  searchHighlightNodes = [];
  searchMatches = [];
  searchCurrentIndex = -1;

  // Normalize text nodes that were split
  const markdownContent = el('markdown-content');
  if (markdownContent) markdownContent.normalize();
}
