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
 * Load the viewer entry module (and its local module graph) into the test
 * environment via indirect eval at global scope.
 *
 * The production build is ES modules bundled by Vite. Under test we inline the
 * module graph: starting from src/main.js we follow relative (`./`, `../`)
 * imports depth-first so each module's code is concatenated before the modules
 * that import it, then strip the import/export keywords and eval the whole thing
 * at global scope. Function declarations and (converted) var declarations then
 * become global properties, which is what the test suite references.
 *
 * Bare imports (marked, mermaid, Panzoom, hljs, DOMPurify, CSS) are stripped,
 * not inlined — those libraries are provided as globals by tests/mocks/* and
 * tests/setup.js.
 *
 * @param {Document} document - The jsdom document object
 * @returns {void}
 */
const RELATIVE_IMPORT_RE = /from\s+['"](\.[^'"]+)['"]/g;

function inlineModule(filePath, visited, chunks) {
  const resolved = filePath.endsWith('.js') ? filePath : filePath + '.js';
  if (visited.has(resolved)) return;
  visited.add(resolved);

  let code = fs.readFileSync(resolved, 'utf8');
  const dir = path.dirname(resolved);

  // Inline relative-import dependencies first (depth-first) so their
  // declarations exist before the importing module's body runs. Matches the
  // path in `from './x.js'`, which works for single- and multi-line imports.
  let match;
  RELATIVE_IMPORT_RE.lastIndex = 0;
  const deps = [];
  while ((match = RELATIVE_IMPORT_RE.exec(code)) !== null) {
    if (match[1].endsWith('.css')) continue;
    // core/highlight.js configures the real highlight.js engine by importing the
    // core build plus individual language grammars. Those are bare imports that
    // get stripped, so inlining the module would leave the language bindings
    // dangling. Under test the engine is provided as a global `hljs` mock, so we
    // treat this module like the bare `highlight.js` dependency it replaces and
    // skip it — the `import hljs from './highlight.js'` line is stripped below.
    if (/(^|\/)highlight\.js$/.test(match[1])) continue;
    deps.push(path.resolve(dir, match[1]));
  }
  for (const dep of deps) inlineModule(dep, visited, chunks);

  // Strip module syntax so the body evals at global scope:
  //  - `import ... from '...'`  (named/default/namespace, single or multi-line)
  //  - `import '...'`           (side-effect imports, e.g. CSS)
  //  - `export` keywords on declarations and re-export lists
  // then convert top-level let/const (simple identifiers) to var so they
  // become globals.
  code = code
    .replace(/^[ \t]*import\b[\s\S]*?from\s+['"][^'"]+['"];?/gm, '')
    .replace(/^[ \t]*import\s+['"][^'"]+['"];?/gm, '')
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/^const (\w+)/gm, 'var $1')
    .replace(/^let (\w+)/gm, 'var $1');

  chunks.push(code);
}

function loadApp(document) {
  const entryPath = path.join(__dirname, '../../markdown-viewer/src/main.js');
  const chunks = [];
  inlineModule(entryPath, new Set(), chunks);
  (0, eval)(chunks.join('\n'));
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
