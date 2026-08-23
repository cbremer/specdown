# Session 01 — Document kind, open gates, sandboxed HTML preview

**Date:** 2026-08-23
**Status:** Ready to implement
**Spec:** [spec-html-v1](2026-08-23-spec-html-v1.md)
**Brainstorm:** [brainstorm-html-documents](2026-08-23-brainstorm-html-documents.md)

## Goal

Land the **runtime fork's skeleton** in one PR: SpecDown can open
`.html` / `.htm` on every ingress, preview the page in a sandboxed
iframe (document scripts never run in the app origin), and still
render markdown exactly as today.

Out of this session: TOC/Find/Print-for-HTML, workspace scan,
asset protocol, Safe mode, Mermaid-in-HTML, annotations, repo
browser HTML search.

## Preconditions

- Read the spec §2–4 and §6 security checklist before touching
  the render path.
- Unique top-level names (`htmlDetectKind`, `htmlRewriteDocument`,
  `htmlMountFrame`, …) — the eval harness collides on `let`/`const`.
- Do not assign raw file bytes to parent `innerHTML`.
- Do not put `allow-same-origin` on the host iframe.

## Tasks

### 1. Kind module

- [ ] Add `markdown-viewer/src/core/document-kind.js` (`// @ts-check`)
      with `detectKind(filename)`, `OPENABLE_EXTENSIONS`,
      `documentCapabilities(kind)`.
- [ ] JSDoc: `/** @typedef {'markdown' | 'html'} DocumentKind */`
- [ ] Unit tests: extensions (case), unknown → `null`, capabilities
      hide `present` / `annotate` / `authoredComments` for `html`.

### 2. Tab + dispatch

- [ ] Add `kind` to the `Tab` typedef in `core/state.js`.
- [ ] `createTab` / tab restore sets `kind` from `detectKind`.
- [ ] `renderDocument` dispatches; markdown path unchanged.
- [ ] HTML path does **not** call `marked.parse` (test with a spy).

### 3. Stage + rewrite + host

- [ ] Stage markup: `#document-stage` wrapping `#markdown-content`
      + `#html-frame` (`sandbox="allow-scripts"`, no same-origin).
- [ ] `features/html-host.js` — `specdown-ready` + external-link
      intercept (see spec §3.5).
- [ ] `features/html-document.js` — rewrite (CSP, inline host,
      strip nested frames / meta-refresh), blob URL mount, revoke
      on re-render and tab close, 8 MB cap.
- [ ] CSS: iframe fills the content pane; no prose max-width; no
      whole-file format of `styles.css`.
- [ ] Test: rewritten HTML contains the CSP meta; stage iframe
      attribute has `allow-scripts` and not `allow-same-origin`.

### 4. Open gates (all surfaces)

- [ ] `file-loading.js` — union extensions + toast copy.
- [ ] `index.html` — `accept=".md,.markdown,.html,.htm"`.
- [ ] `desktop/main.js` — `isOpenableDocument`; dialog filters
      Markdown / HTML / All; title "Open File". Keep the
      `artifactName` space regression test green.
- [ ] `manifest.webmanifest` — `file_handlers` for `text/html`.
- [ ] `ios/project.yml` — HTML document type + `public.html`.
- [ ] `WebBridge.swift` — picker includes `UTType.html`.
- [ ] Landing drop-card copy: "Markdown or HTML" (no new hero).

### 5. Raw / split

- [ ] Raw view shows author source for HTML tabs.
- [ ] Split shows source | iframe (not source | marked output).
- [ ] Toolbar: hide Present / Annotate / Comments on HTML via
      `documentCapabilities` (iOS sheet too if those actions are
      listed — do not add new sheet rows this session).

### 6. Sample

- [ ] `markdown-viewer/samples/html-showcase.html` — self-contained,
      designed, headings, no network.
- [ ] Landing + iOS sample button (second button, Mermaid stays
      primary). Allow-list the filename in `landing.js`.

### 7. Quality gates

- [ ] `npm test` green.
- [ ] `npm run lint` zero warnings.
- [ ] `npm run typecheck` clean.
- [ ] Prettier only on files this session touches.

## Manual smoke (after gates)

1. `npm run preview` (or `dev`): drop the sample HTML — designed
   page, not markdown. Toggle Raw. Open a `.md` in another tab;
   switch back.
2. Drop a `.txt` — still rejected.
3. In the HTML page console (iframe), `window.parent.specdown` is
   not readable (opaque / sandbox).
4. Desktop if a display exists: File > Open a `.html`; Live chip
   still appears for a path-backed file (reload can wait for a
   visual check).
5. Confirm print was **not** wired to `window.print()` on the
   shell for HTML (Print may no-op or stay markdown-only this
   session — do not regress markdown print).

## Done when

- HTML opens on web + desktop + iOS picker types.
- Markdown regression is zero.
- Security checklist in the spec is all checked for this PR.
- One commit, one PR.
