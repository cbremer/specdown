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
    rollupOptions: {
      output: {
        // Split the heavy Mermaid engine into its own chunk so it can be
        // cached independently of the app shell (and lazy-loaded in a later
        // slice). Highlight.js + DOMPurify stay with the app for now.
        manualChunks: {
          mermaid: ['mermaid'],
        },
      },
    },
  },
});
