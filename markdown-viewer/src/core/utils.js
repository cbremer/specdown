// Pure, dependency-free helpers shared across the viewer.

/**
 * Escape a string for safe interpolation into HTML.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalize a GitHub "blob" URL to its raw-content equivalent so the markdown
 * can be fetched directly. Supports github.com and GitHub Enterprise hosts;
 * returns the URL unchanged if it isn't a recognized blob URL.
 * @param {string} url
 * @returns {string}
 */
export function normalizeMarkdownUrl(url) {
  // Pattern: https://<host>/<owner>/<repo>/blob/<ref>/<path>
  const githubBlobPattern = /^(https?):\/\/([^/]+)\/([^/]+)\/([^/]+)\/blob\/(.+)$/;
  const match = url.match(githubBlobPattern);
  if (match) {
    const [, protocol, host, owner, repo, rest] = match;
    // github.com uses a dedicated raw content host
    if (host === 'github.com') {
      return 'https://raw.githubusercontent.com/' + owner + '/' + repo + '/' + rest;
    }
    // GitHub Enterprise uses /raw/ instead of /blob/ on the same host
    return protocol + '://' + host + '/' + owner + '/' + repo + '/raw/' + rest;
  }
  return url;
}

/**
 * Read an SVG element's natural pixel dimensions from its viewBox (preferred)
 * or width/height attributes. Returns null when no usable size is found.
 * @param {SVGElement} svgElement
 * @returns {{ width: number, height: number } | null}
 */
export function getSvgNaturalDimensions(svgElement) {
  // SVG viewBox format: "min-x min-y width height" — the 3rd/4th values are
  // the width and height (not coordinates).
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
  // Fall back to width/height attributes (skip percentage values like "100%").
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

/**
 * Replace HTML comment nodes in a container with visible styled blocks, so
 * authored comments are shown rather than hidden.
 * @param {Node} container
 */
export function revealHtmlComments(container) {
  // Walk the DOM and replace comment nodes with visible styled blocks
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_COMMENT, null);

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
