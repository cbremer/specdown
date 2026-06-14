# Tasks — Session 04: Phase 1 (heavy-dependency loading / bundle size)

**Date:** 2026-06-14
**Type:** tasks (session-level implementation checklist)
**Phase:** 1 — Architecture (the "lazy-load heavy deps" roadmap item)
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §6

With the internal module split done (session 03), this session attacks the
**app-shell download size**. Two heavy dependencies dominated the eager bundle:
**Mermaid** (+ its cytoscape/katex/wardley ecosystem) and **highlight.js** (its
full ~190-language grammar set). The gate is unchanged: `npm run build` +
`npm run lint` + the **297 Jest tests**, green at every commit.

---

## 1. Lazy-load Mermaid — defer ~2 MB until a diagram renders (PR #119, merged)

Mermaid was statically imported in three places (`main.js`,
`core/render-config.js`, `features/diagrams.js`), so it sat in the eager graph
and downloaded on every page load even for diagram-less docs. The existing
`manualChunks: { mermaid }` put it in a *named* chunk, but the entry still
linked that chunk **statically**, so the browser fetched it anyway.

- A single cached dynamic import behind **`loadMermaid()`** in
  `render-config.js`, awaited on demand by `processMermaidDiagrams()` and the
  theme re-render (`reRenderMermaidDiagrams()`, which now early-returns when
  there are no diagrams).
- Removed all three static `import … 'mermaid'` lines, the startup
  `configureMermaid()` call, and dead `mermaid`/`Panzoom`/`hljs` imports.
- **Removed `manualChunks: { mermaid }` from `vite.config.js`** — forcing the
  named chunk dragged mermaid's shared deps into it, which the eager entry then
  imported statically, defeating the split. With a real dynamic import Rollup
  code-splits mermaid (and each diagram type) into async chunks automatically.
- **Test-harness compat:** `loadMermaid()` prefers a `globalThis.mermaid` (the
  Jest mock) and only falls back to `import('mermaid')` in production, so the
  dynamic branch is never taken under test.
- **Verified:** entry references mermaid only via `import("./mermaid.core-…")`;
  no modulepreload; `mermaid.core` (592 kB) + `cytoscape` (443 kB) + `katex`
  (261 kB) + `wardley` (615 kB) + ~40 per-diagram chunks all deferred.
- Confirmed rendering still works on the **desktop build** post-merge.

## 2. Trim highlight.js to a curated language set

highlight.js can't be lazy-loaded the same way: the marked `code()` renderer is
**synchronous**, and unlike diagrams, code blocks are common, so deferring the
engine wouldn't help most documents. The lever is instead **trimming** — every
page load pays for hljs, so shrinking it is an unconditional win.

- New **`core/highlight.js`**: starts from `highlight.js/lib/core` and
  `registerLanguage`s a curated ~29-language set (js/ts, python, bash/shell,
  json, yaml, markdown, xml, css/scss, sql, java, kotlin, swift, go, rust,
  c/cpp/csharp, ruby, php, objectivec, diff, dockerfile, ini, makefile,
  graphql, plaintext). `registerLanguage` wires each grammar's **aliases**, so
  short forms come free (`js`, `ts`, `html`/`svg`, `sh`, `md`, `yml`, `toml`, …).
- `render-config.js` now imports `hljs` from `./highlight.js` instead of the
  full `highlight.js` package. Languages outside the set still render — just as
  an escaped plain code block via the renderer's existing fallback.
- **Test-harness compat:** `core/highlight.js` imports the core engine + grammar
  modules as bare imports, which the eval harness strips — leaving the language
  bindings dangling. Since the engine is a global `hljs` mock under test, the
  harness (`tests/helpers/loadApp.js`) now **skips inlining** any relative
  `…/highlight.js` import, treating it like the bare `highlight.js` dependency it
  replaces (the `import hljs from './highlight.js'` line is stripped as before).
- **Result:** app-shell entry **1,098,692 → 261,494 bytes** (~837 kB / 76%
  smaller). Real-hljs smoke test confirms python highlights, `js`/`toml` aliases
  resolve, and unknown languages fall back to plain. `npm run build` ✓,
  `npm run lint` ✓, `npm test` → **297 passed**.

## Patterns / gotchas

- **Eval-harness + bare imports:** any identifier that comes from a *stripped*
  bare import and is then *referenced* (not just `typeof`-guarded) throws
  `ReferenceError` under the harness — the harness's contract is "every
  bare-imported binding you reference is provided as a global mock." A config
  module like `core/highlight.js` references 29 such bindings, so it can't be
  inlined; it's skipped and the global mock stands in. (Mermaid sidesteps this
  by `globalThis.mermaid`-checking inside `loadMermaid()`.)
- **Named manualChunks ≠ lazy:** a manual chunk is still statically linked
  unless the only path to it is a dynamic `import()`. Removing the manualChunk
  and adding a real dynamic import is what actually defers the download.

## Remaining / next

- Phase 1's "lazy-load heavy deps" item is now substantially done (Mermaid
  deferred, hljs trimmed). Next Phase 1 step: **gradual TypeScript** (`checkJs`
  + JSDoc types across the new `core/`/`features/`/`platform/` modules).
- Possible later refinement: lazy-load hljs via a post-render DOM pass (render
  code blocks unhighlighted, then highlight asynchronously) to defer it for
  diagram/prose-only docs — lower value than the trim, deferred.
