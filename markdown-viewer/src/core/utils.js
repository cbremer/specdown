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
