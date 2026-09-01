/**
 * HTML-on Vite index.html transforms.
 *
 * Applied only when the HTML-documents flag is compiled on (`--mode html`).
 * Source markdown-viewer/index.html stays production-shaped: no frame-src,
 * file-input accept stays markdown-only. Flag-off greps of the source file
 * must keep passing.
 */

/**
 * Add `frame-src 'self' file: specdown:` to the parent CSP. Never adds
 * `blob:` or `'unsafe-inline'` to script-src.
 * @param {string} html
 * @returns {string}
 */
function htmlInjectParentFrameSrc(html) {
  return html.replace(
    /(http-equiv="Content-Security-Policy"[^>]*content=")([^"]*)(")/i,
    (full, pre, csp, post) => {
      if (/frame-src/i.test(csp)) return full;
      return `${pre}${csp}; frame-src 'self' file: specdown:${post}`;
    }
  );
}

/**
 * Widen `#file-input` accept to Markdown + HTML on HTML-on builds.
 * @param {string} html
 * @returns {string}
 */
function htmlInjectFileAccept(html) {
  return html.replace(
    /(<input\b[^>]*\bid="file-input"[^>]*\baccept=")[^"]*(")/i,
    '$1.md,.markdown,.html,.htm$2'
  );
}

module.exports = {
  htmlInjectParentFrameSrc,
  htmlInjectFileAccept,
};
