/**
 * Helper to load app.js with all CDN dependencies mocked
 */

const fs = require('fs');
const path = require('path');

// Load mocks
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

/**
 * Load the app.js file into the test environment
 *
 * Uses indirect eval — (0, eval)(code) — to execute app.js at global scope.
 * This means function declarations and var-declared variables automatically
 * become properties of the global object, eliminating the need for fragile
 * regex transformations like "function X" → "global.X = function".
 *
 * The only regex remaining converts top-level let/const to var, since let/const
 * are block-scoped and would not become global properties even at global scope.
 * This regex only matches simple identifier patterns (not destructuring).
 *
 * @param {Document} document - The jsdom document object
 * @returns {void}
 */
function loadApp(document) {
  // Read the viewer entry module.
  const appPath = path.join(__dirname, '../../markdown-viewer/src/main.js');
  let appCode = fs.readFileSync(appPath, 'utf8');

  // Strip ES-module import statements. In the production build Vite resolves
  // these to bundled dependencies; under test the libraries (marked, mermaid,
  // Panzoom, hljs, DOMPurify) are provided as globals by tests/mocks/* and
  // tests/setup.js, and the bare CSS import has no runtime behavior. Removing
  // the import lines lets us keep evaluating the module body at global scope.
  appCode = appCode.replace(/^\s*import\b[^\n]*$/gm, '');

  // Convert top-level let/const to var so they become global properties.
  // Only matches simple identifier patterns (e.g. "const foo"), not destructuring
  // (e.g. "const { a, b }") which would need different handling.
  appCode = appCode.replace(/^const (\w+)/gm, 'var $1');
  appCode = appCode.replace(/^let (\w+)/gm, 'var $1');

  // Indirect eval executes code at global scope rather than in the caller's
  // local scope. This means var declarations and function declarations
  // naturally become global object properties without needing explicit
  // "global.X = ..." assignments.
  (0, eval)(appCode);
}

/**
 * Load the index.html structure into the document
 * @param {Document} document - The jsdom document object
 * @returns {void}
 */
function loadHTML(document) {
  const htmlPath = path.join(__dirname, '../../markdown-viewer/index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');

  // Extract body content. The module <script> now lives in <head>, so the
  // body no longer contains script tags — take everything inside <body>.
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
  if (bodyMatch) {
    document.body.innerHTML = bodyMatch[1];
  }
}

module.exports = {
  loadApp,
  loadHTML,
};
