# Tasks — Session 02: Phase 1 (Architecture — Vite + ESM foundation)

**Date:** 2026-06-13
**Type:** tasks (session-level implementation checklist)
**Phase:** 1 — Architecture (slice 1 of ~3: build foundation)
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §6

This session lands the **build-system foundation** for Phase 1: the shared
viewer moves from a no-build, 30+ vendored-`<script>` global-scope app to a
Vite + ES-module build that every surface consumes. The app **logic stays in a
single module** this slice (`src/main.js`) to keep the migration
behavior-preserving; the internal `core/`/`features/`/`platform/` file split and
lazy-loading of Mermaid are the next slices.

Decision on scope was confirmed with the maintainer ("Full Vite migration now",
app logic in one module, verify desktop/iOS on the branch before merge).

---

## What changed

### Build system
- [x] Added **Vite** (`vite.config.js`): `root: markdown-viewer`, `base: './'`
  (one build works under the Pages subpath, Electron `file://`, and iOS
  WKWebView), output to `markdown-viewer/dist/`. Disabled the modulepreload
  polyfill (an inline script the CSP would block). Mermaid is given its own
  manual chunk; Mermaid's per-diagram code additionally code-splits into lazy
  chunks automatically.
- [x] Scripts: `npm run dev` / `build` / `preview`. `build` = `vite build` +
  `scripts/copy-static.js` (copies `samples/` → `dist/samples/`).
- [x] Real npm dependencies replace `vendor/`: `marked`, `mermaid`,
  `@panzoom/panzoom`, `highlight.js`, `dompurify`. Removed
  `@highlightjs/cdn-assets`. **Deleted `markdown-viewer/vendor/` (3.2 MB)** —
  fully unreferenced after the migration (git history retains it).

### Shared viewer
- [x] `markdown-viewer/app.js` → `markdown-viewer/src/main.js`; prepended ES
  imports binding the libraries to the same identifiers the code already used
  (`marked`, `mermaid`, `Panzoom`, `hljs`, `DOMPurify`) + the hljs theme CSS, so
  **the app logic is otherwise unchanged**.
- [x] `index.html`: removed the 30+ vendored `<script>`/`<link>` tags; single
  `<script type="module" src="/src/main.js">`.

### Platform consumers (all now load `dist/`)
- [x] **Web** (`static.yml`): build + upload `markdown-viewer/dist` to Pages.
- [x] **Desktop** (`desktop/main.js`): `loadFile` → `dist/index.html`;
  `desktop`/`desktop:build` build first; electron-builder `files` → `dist/**`.
- [x] **iOS** (`project.yml` bundles `../markdown-viewer/dist`;
  `WebView.swift` subdirectory `dist`; `WebBridge.swift` samples
  `dist/samples`); `ios.yml` runs `npm ci && npm run build` before XcodeGen.

### Tooling / tests / docs
- [x] Test harness (`tests/helpers/loadApp.js`): reads `src/main.js`, strips ESM
  `import` lines (libraries are provided as globals by `tests/mocks/*` +
  `tests/setup.js`), evals as before. Body-extraction regex updated. **All 297
  tests pass unchanged.**
- [x] ESLint config: viewer source is now `sourceType: module`; ignore
  `markdown-viewer/dist`; `vite.config.js` treated as ESM. `npm run lint` clean.
- [x] Fixed a **Phase 0 regression**: `scripts/sync-version.js` grepped for the
  `#### vX.Y.Z (Current)` README line that Phase 0 removed, which would have
  failed `npm version` (the release pipeline). It now only updates
  `APP_VERSION` in `src/main.js` and no longer touches the README. Updated the
  `version` script's `git add` path accordingly.
- [x] Docs reconciled (CLAUDE.md, AGENTS.md, README, ios/README): repo maps,
  "no build step" claims, dev/build commands, library/architecture sections.

---

## Verified locally (headless)
- `npm run build` → succeeds; `dist/index.html` uses relative `./assets/` URLs,
  logos inlined as `data:` URIs, **no inline scripts** (CSP-clean), `samples/`
  copied.
- `npm run preview` + curl → `index.html`, main JS chunk, CSS, the Mermaid
  chunk, and `samples/sample.md` all return `200`; `marked`/`highlight` are
  bundled into the app chunk.
- `npm run lint` → 0 errors. `npm test` → **297 passed**.

## ⚠️ Needs manual verification on the branch before merge
These exercise `file://` module loading, which cannot be tested headlessly here:

1. **Desktop (Electron):** `npm run desktop` → app window renders; open a
   markdown file with Mermaid diagrams; check pan/zoom, fullscreen, SVG/PNG
   export, syntax highlighting, theme toggle, file-watch reload, and that
   external `https://` links open in the system browser. The one known risk is
   Vite's `crossorigin` attribute on the module `<script>` under `file://`; if
   scripts fail to load, the fix is small (drop the `crossorigin` attr / adjust
   base) — flag it and I'll address it.
2. **iOS/iPadOS:** the now-honest `ios.yml` should stay green (it builds the web
   app first). In the simulator, confirm `dist/index.html` loads, the bundled
   samples open from the drop screen, and the native bridge (theme, layout,
   print) still works.
3. **Web (Pages):** after merge, confirm the deployed site loads (relative
   `base: './'` under the `/specdown/` subpath) and Mermaid lazy chunks fetch.

---

## Deferred to the next Phase 1 slices
- **Internal module split** of `src/main.js` (~2.8k lines) into
  `core/`/`features/`/`platform/` so no file > 500 lines. This is the
  error-prone part (shared mutable state across modules) and is best verified
  incrementally — it needs the eval-based harness to evolve into a
  module-concatenating (or babel-jest) loader.
- **Lazy-load Mermaid itself** behind a dynamic `import()` (the per-diagram
  chunks already split; the engine entry does not yet).
- **Gradual TypeScript** (`checkJs` → per-module `.ts`).
- **Repo-wide Prettier pass** (still deferred; lands with the file split).

## Next session
Phase 1 slice 2 — internal module extraction. Add the next tasks file and update
the timeline below.
