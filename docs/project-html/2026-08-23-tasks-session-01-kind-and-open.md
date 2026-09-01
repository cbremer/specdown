# Session 01 — Document kind, open gates, sandboxed HTML preview

**Date:** 2026-08-23 (staging rail: 2026-08-25)
**Status:** Implemented on branch `html` (council-amended) — after
Session 00. Base branch **`html`**, not `main`.
**Spec:** [spec-html-v1](2026-08-23-spec-html-v1.md) ·
[staging](2026-08-25-spec-html-staging.md)
**Brainstorm:** [brainstorm-html-documents](2026-08-23-brainstorm-html-documents.md)
**Council:** [council-html-plan-review](2026-08-23-council-html-plan-review.md)
**Previous:** [Session 00](2026-08-25-tasks-session-00-staging-rail.md)

## Goal

Land the **runtime fork's skeleton** in one PR **on `html`**:
SpecDown (HTML-on build) can open `.html` / `.htm` on every
ingress, preview the page in a sandboxed iframe (document
scripts never run in the app origin), and still render markdown
exactly as today. This PR must **not** merge to `main` (that
would ship a Release). Dogfood with `npm run dev:html` /
`preview:html` / `desktop:html`.

Out of this session: TOC/Find/Print-for-HTML, workspace _link_
following, asset protocol, Safe mode, Mermaid-in-HTML, annotations,
repo browser HTML search. Workspace **listing** _is_ in this
session (council H2).

## Preconditions

- [Session 00](2026-08-25-tasks-session-00-staging-rail.md) is on
  `main` and branch `html` exists. This PR’s base is `html`.
- Build/test HTML-on: `VITE_HTML_DOCUMENTS` / `npm run dev:html`.
  Keep a flag-**off** CI job green (markdown gates + CSP source
  unchanged on that job — if this session changes source
  `index.html` CSP, the transform must still leave flag-off
  builds without `frame-src`, per the staging spec).
- Read the spec §2–6 and the council F1–F3 fatals before touching
  the render path.
- Unique top-level names (`htmlDetectKind`, `htmlRewriteDocument`,
  `htmlMountFrame`, `htmlTeardownFrame`, `htmlHostInlineSource`, …)
  — the eval harness collides on `let`/`const`.
- `html-host.js` exports **only** a string. No host side effects
  in the parent.
- Do not assign raw file bytes to parent `innerHTML`.
- Do not put `allow-same-origin` on the host iframe.
- Do not call `performPrint()` on an HTML tab.
- Drops use `getPathForFile` only (no `file.path`).
- `renderDocument` takes the tab (or explicit `kind`). Do not
  re-detect at render time.

## Tasks

### 1. Kind module

- [ ] Add `markdown-viewer/src/core/document-kind.js` (`// @ts-check`)
      with `detectKind(filename)`, `OPENABLE_EXTENSIONS`,
      `documentCapabilities(kind)`.
- [ ] JSDoc: `/** @typedef {'markdown' | 'html'} DocumentKind */`
- [ ] Session 01 HTML capabilities: `preview`, `raw`, `split`,
      `liveReload`, `fileInfo` only. Print / Find / TOC / Present /
      Annotate / Comments are **false**.
- [ ] Unit tests: extensions (case), unknown → `null`, capabilities
      hide the Session 02+ set. No Content-Type sniff.

### 2. Tab + dispatch + lifecycle

- [ ] Add `kind` to the `Tab` typedef in `core/state.js`.
- [ ] `createTab` / tab restore / `window.loadFileContent` set
      `kind` from `detectKind`.
- [ ] `renderDocument` dispatches; markdown path unchanged.
      Wire **all** DI sites: `configureTabs`, `configureDesktop`
      (live reload), `configureViewMode`. Keep the
      `renderMarkdown` wrapper for existing tests.
- [ ] HTML path does **not** call `marked.parse` (test with a spy).
- [ ] Stage apply on create / switch / close / raw / empty:
      hide iframe on markdown, raw, and drop-zone; reload the
      **preview host** then `specdown-load` on HTML activate.
- [ ] Desktop `refresh-file` + session restore + recents use
      `isOpenableDocument`.

### 3. Stage + rewrite + host + CSP

- [ ] Stage markup: `#document-stage` as the `#content-main`
      preview flex child; `#markdown-content` and `#html-frame`
      are **siblings** (`sandbox="allow-scripts"`, `allow=""`, no
      same-origin). Do not nest the iframe in `.markdown-content`.
- [ ] Bundled `markdown-viewer/html-preview-host.html` — own CSP
      (Faithful `'unsafe-inline' https:`), host script as that
      page’s `'self'`. `#html-frame.src` is this URL, **not**
      a blob or srcdoc.
- [ ] `features/html-document.js` — rewrite (strip author CSP /
      `<base>` / nested frames / executable hrefs),
      `postMessage` `specdown-load`, navigation lock (reset if
      `src` leaves the host URL).
- [ ] 8 MB cap **on HTML only, at read** (`handleFile` /
      `openFileByPath` / iOS `openDocument`; `stat` first).
- [ ] Parent CSP: HTML-on **builds** add
      `frame-src 'self' file: specdown:` (Vite transform or
      equivalent). Do **not** add `blob:` or `'unsafe-inline'`
      to parent `script-src`. Source `index.html` on a flag-off
      grep still has **no** `frame-src` until the production
      flip — test both the source file and the HTML-on `dist`
      CSP. `#document-stage` may exist on this branch (layout
      is not flag-gated); markdown Print golden path is
      mandatory.
- [ ] iOS: reject `WKScriptMessage` unless
      `frameInfo.isMainFrame`. Cancel iframe navigations.
- [ ] CSS: iframe fills the stage (zero SpecDown padding); split
      targets `#document-stage`, not `.markdown-content`;
      `@media print` reset for `#document-stage` (markdown
      fallback must not clip); no whole-file format of
      `styles.css`.
- [ ] Lone-file toast if rewrite sees relative URLs and there is
      no `baseHref` (sample may suppress).
- [ ] Test: rewritten HTML contains the CSP meta; stage iframe
      attribute has `allow-scripts` and not `allow-same-origin`.

### 4. Open gates (all surfaces)

- [ ] `file-loading.js` — union extensions + toast copy;
      `handleUrl` is **extension-only** (no Content-Type sniff).
- [ ] `index.html` — `accept=".md,.markdown,.html,.htm"` only.
      **No** drop-card / hero / pillar copy change.
- [ ] `desktop/main.js` — `isOpenableDocument` for open, drop,
      **session restore**, **workspace scan**; dialog filters
      Markdown / HTML / All; title "Open File";
      `will-frame-navigate` denies in-frame http(s) (`openExternal`).
      Keep the `artifactName` space regression test green.
- [ ] **Do not** change `package.json` `fileAssociations` or
      `manifest.webmanifest` `file_handlers` (Session 04).
- [ ] Web `workspace.js` walk lists HTML; empty copy mentions
      Markdown or HTML. Relative link following can wait.
- [ ] `ios/project.yml` — add `public.html` to
      `LSItemContentTypes` only (do **not** redeclare under
      `UTImportedTypeDeclarations`). Rank Alternate.
- [ ] `WebBridge.swift` — picker includes `UTType.html`.
      No iOS sample button.
- [ ] iPad `ContentView.swift` — label “Open File” is enough;
      do not add a third sidebar sample.
- [ ] Update inverted tests in the same PR:
      `desktop-main.test.js` (`.html` now openable),
      file-loading toast copy. Landing copy tests stay
      unchanged. Do not test iframe `load` in jsdom.

### 5. Raw / split / honest chrome

- [ ] Raw view shows author source; **hide `#html-frame`** in raw.
- [ ] Split shows source | iframe. CSS must size the **stage**.
      If not actually wired, set `split: false` instead of a lie.
- [ ] `documentCapabilities` gates toolbar, overflow, **palette
      `isAvailable`**, **iOS sheet**, and **`⌘F` / `⌘P`**.
- [ ] On HTML render / tab switch: empty `#markdown-content`,
      `tocEntries = []`, close TOC, close search, annotate
      **off**, `refreshCommentsUI()`.
- [ ] `performPrint()` returns immediately on HTML (no
      `window.print()` fallback). Unit test: HTML tab does not
      clone `#markdown-content` into the print path.
- [ ] Host key-forward for ⌘K / ⌘F / ⌘P / `?` / Esc, **or**
      document that chrome shortcuts need focus on the filename.
- [ ] Skip link still reaches the stage; iframe `title` = filename.

### 6. Sample

- [ ] `markdown-viewer/samples/html-showcase.html` — self-contained,
      designed, headings, no network. **QA-only** — no landing or
      iOS button in this session.

### 7. Quality gates

- [ ] `npm test` green (flag-off **and** HTML-on, once CI
      matrix exists).
- [ ] `npm run lint` zero warnings.
- [ ] `npm run typecheck` clean.
- [ ] Prettier only on files this session touches.

## Manual smoke (after gates)

Run **`preview:html` / `dev:html` / `desktop:html`**, not the
flag-off scripts (those must still reject `.html`). Also run the
staging spec’s **markdown golden path** on the same SHA.

1. `npm run preview:html` (or `dev:html`): drop the sample HTML — designed
   page via the **preview host** (not a blank frame, not
   markdown). Toggle Raw. Open a `.md` in another tab; switch
   back. Close the last tab — landing, no leftover iframe.
2. Drop a `.txt` — still rejected. Drop a large `.md` — still
   opens (cap is HTML-only).
3. In the HTML page console (iframe), `window.parent.specdown` is
   not readable (opaque / sandbox).
4. Print / Find / Contents / Annotate / Comments / Present are
   not offered on the HTML tab (desktop toolbar + iOS sheet +
   palette). Markdown print still works.
5. Desktop if a display exists: File > Open a `.html`; session
   restore after relaunch; Open Folder lists HTML; Live chip on
   a path-backed file. A link inside the HTML that points at
   `https://…` opens in the system browser, not in the iframe.
6. Confirm markdown `performPrint()` was not regresssed.

## Done when

- HTML opens on web + desktop + iOS picker types **in the HTML-on
  build** and is _visible_ (CSP does not blank the stage).
- Flag-off build still rejects `.html`; markdown golden path is
  green (including Print not clipped).
- Security checklist in the spec is all checked for this PR.
- Chrome is honest (no Print-on-empty-content).
- One commit, one PR, into **`html`**. Not `main`.
