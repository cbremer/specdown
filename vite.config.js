import { defineConfig } from 'vite';

// Vite build for the shared SpecDown viewer (Phase 1 — modernization roadmap).
//
// The same `dist/` output is consumed by all three surfaces, so the config is
// deliberately portable:
//   - base: './'  → relative asset URLs work under the GitHub Pages project
//     subpath (/specdown/) AND under file:// (Electron + iOS WKWebView).
//   - modulepreload.polyfill: false → Vite would otherwise inject a small inline
//     bootstrap script, which the app's Content-Security-Policy (script-src
//     'self', no 'unsafe-inline') would block. Native modulepreload support is
//     fine for our targets; the polyfill is unnecessary.
export default defineConfig({
  root: 'markdown-viewer',
  base: './',
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
