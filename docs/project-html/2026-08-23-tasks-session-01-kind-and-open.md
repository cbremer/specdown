# Session 01 — Document kind, open gates, sandboxed HTML preview

**Date:** 2026-08-23
**Status:** Ready to implement (**council-amended**)
**Spec:** [spec-html-v1](2026-08-23-spec-html-v1.md)
**Brainstorm:** [brainstorm-html-documents](2026-08-23-brainstorm-html-documents.md)
**Council:** [council-html-plan-review](2026-08-23-council-html-plan-review.md)

## Goal

Land the **runtime fork's skeleton** in one PR: SpecDown can open
`.html` / `.htm` on every ingress, preview the page in a sandboxed
iframe (document scripts never run in the app origin), and still
render markdown exactly as today.

Out of this session: TOC/Find/Print-for-HTML, workspace *link*
following, asset protocol, Safe mode, Mermaid-in-HTML, annotations,
repo browser HTML search. Workspace **listing** *is* in this
session (council H2).

## Preconditions

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
- [ ] `createTab` / tab restore sets `kind` from `detectKind`.
- [ ] `renderDocument` dispatches; markdown path unchanged.
- [ ] HTML path does **not** call `marked.parse` (test with a spy).
- [ ] `htmlTeardownFrame()` from `showDropZone`, last-HTML-tab
      close, and before remount. One iframe, many tabs: activate
      remounts from `tab.rawMarkdown`.

### 3. Stage + rewrite + host + CSP

- [ ] Stage markup: `#document-stage` as the `#content-main`
      preview flex child; `#markdown-content` and `#html-frame`
      are **siblings** (`sandbox="allow-scripts"`, `allow=""`, no
      same-origin). Do not nest the iframe in `.markdown-content`.
- [ ] `features/html-host.js` — string export only;
      `specdown-ready` + external-link intercept (spec §3.5).
- [ ] `features/html-document.js` — rewrite (CSP, inline host,
      strip nested frames / meta-refresh / `<base target>` /
      `javascript:` and `data:text/html` hrefs), blob URL mount,
      revoke, 8 MB cap **on HTML only**, navigation lock (reset
      if `src` leaves our blob).
- [ ] `index.html` CSP: add `frame-src 'self' blob: file: specdown:`.
      Do not add `blob:` to `script-src`. Test the production
      string.
- [ ] CSS: iframe fills the stage (zero SpecDown padding); split
      targets `#document-stage`, not `.markdown-content`; no
      whole-file format of `styles.css`.
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
- [ ] `ios/project.yml` — HTML document type + `public.html`.
- [ ] `WebBridge.swift` — picker includes `UTType.html`.
      No iOS sample button.

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

- [ ] `npm test` green.
- [ ] `npm run lint` zero warnings.
- [ ] `npm run typecheck` clean.
- [ ] Prettier only on files this session touches.

## Manual smoke (after gates)

1. `npm run preview` (or `dev`): drop the sample HTML — designed
   page, not a blank frame (CSP `frame-src` works) and not
   markdown. Toggle Raw. Open a `.md` in another tab; switch
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

- HTML opens on web + desktop + iOS picker types and is *visible*
  (CSP does not blank the stage).
- Markdown regression is zero.
- Security checklist in the spec is all checked for this PR.
- Chrome is honest (no Print-on-empty-content).
- One commit, one PR.
