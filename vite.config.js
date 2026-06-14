import { defineConfig } from 'vite';

// Strips the `crossorigin` attribute Vite stamps onto the generated
// <script>/<link> tags. Over file:// (iOS WKWebView), crossorigin triggers a
// CORS check that blocks the bundled CSS/JS, leaving an unstyled page with no
// app logic. Electron's Chromium tolerates it, but WKWebView does not. The
// attribute is unnecessary for our same-origin/local assets on every surface.
const stripCrossorigin = {
  name: 'strip-crossorigin',
  transformIndexHtml(html) {
    return html.replace(/\s+crossorigin(?:=("|')[^"']*\1)?/g, '');
  },
};

// Vite build for the shared SpecDown viewer (modernization roadmap).
//
// The same `dist/` output is consumed by all three surfaces, so the config is
// deliberately portable:
//   - base: './'  → relative asset URLs work under the GitHub Pages project
//     subpath (/specdown/) AND under file:// (Electron + iOS WKWebView).
//   - modulepreload.polyfill: false → Vite would otherwise inject a small inline
//     bootstrap script, which the app's Content-Security-Policy (script-src
//     'self', no 'unsafe-inline') would block. Native modulepreload support is
//     fine for our targets; the polyfill is unnecessary.
//   - stripCrossorigin plugin → see above; required for iOS WKWebView file://.
export default defineConfig({
  root: 'markdown-viewer',
  base: './',
  plugins: [stripCrossorigin],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulepreload: { polyfill: false },
    // The heavy Mermaid engine is loaded on demand via a dynamic import (see
    // core/render-config.js `loadMermaid`), so Rollup automatically code-splits
    // it — and its diagram-type sub-modules — into async chunks that the app
    // shell never loads until a document actually contains a diagram. We do NOT
    // force a manualChunk for mermaid: doing so pulls mermaid's *shared* deps
    // into that chunk, which the eager entry then has to import statically,
    // defeating the lazy-load. Highlight.js + DOMPurify stay with the app shell.
  },
});
