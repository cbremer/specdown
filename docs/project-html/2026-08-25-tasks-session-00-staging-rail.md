# Session 00 — Staging rail (before any HTML runtime)

**Date:** 2026-08-25
**Status:** Ready to implement — **first code PR**, targets **`main`**
**Spec:** [spec-html-staging](2026-08-25-spec-html-staging.md)
**HTML runtime spec:** [spec-html-v1](2026-08-23-spec-html-v1.md)
  (do not implement that file in this session)

## Goal

Give HTML work a place to live that is **not a SpecDown
release**: compile-time flag (default off), scripts to dogfood
an HTML-on build, CI that keeps the markdown product honest,
artifact for reviewers. **No** `.html` open gates, **no** iframe,
**no** `frame-src`, **no** landing copy, **no** `html` feature
modules.

After this PR is on `main`, create the `html` integration
branch from that tip and push it. Sessions 01+ are PRs into
`html`.

## Preconditions

- Read the [staging spec](2026-08-25-spec-html-staging.md) in
  full.
- Unique identifiers (`htmlDocumentsEnabled`,
  `htmlDocumentsEnabledFlag`, …) — eval harness collisions.
- Do not add `#document-stage` or `#html-frame`.
- Do not change `VALID_EXTENSIONS`, `accept=`, desktop filters,
  iOS UTIs, or parent CSP in this session.
- Do not set `VITE_HTML_DOCUMENTS` in `static.yml` or
  `desktop.yml`.

## Tasks

### 1. Flag helper (renderer + desktop main)

- [ ] `markdown-viewer/src/core/html-flag.js` (`// @ts-check`):
      `htmlDocumentsEnabled()` is true only when the Vite HTML
      mode (or `define`) compiled it on. Default false.
      Eval-harness safe (boolean literal / `process.env`, not
      a lone `import.meta.env` that throws under `loadApp`).
- [ ] `desktop/main.js` reads `process.env.VITE_HTML_DOCUMENTS
      === 'true'` (same name). Session 01 will AND this with
      `isOpenableDocument`; this session only exposes the
      helper or inlines the check behind a named function
      `htmlDocumentsEnabledMain` so tests can stub it.
- [ ] `.env.html` with `VITE_HTML_DOCUMENTS=true`.
- [ ] Vite `define` or equivalent so HTML-on and HTML-off
      builds cannot drift from a forgotten env var in one
      process only. Document in a short comment on the helper.

### 2. npm scripts

- [ ] `dev:html` → `vite --mode html`
- [ ] `build:html` → `vite build --mode html && node scripts/copy-static.js`
- [ ] `preview:html` → `build:html` then `vite preview --mode html`
      (keep port 4179)
- [ ] `desktop:html` → `build:html` then
      `VITE_HTML_DOCUMENTS=true electron .`
      (renderer and main both on)
- [ ] Default `dev` / `build` / `desktop` remain flag **off**

### 3. Tests (flag off is the product)

- [ ] `tests/unit/html-flag.test.js` — off by default; on when
      the test stubs the compiled flag.
- [ ] Flag **off** golden path (must stay on `main` CI):
      file-loading still rejects `.html` / `.htm`;
      `desktop-main.test.js` still rejects `.html`;
      static grep: `index.html` `accept` has no `html`;
      static grep: CSP has no `frame-src`;
      document body fixture / `index.html` has no
      `html-frame` / `document-stage`.
- [ ] Do not invert the `.html` rejection tests in this PR.

### 4. CI

- [ ] `.github/workflows/ci.yml` — also run on push to `html`.
- [ ] New workflow `.github/workflows/html-staging.yml`:
      on push/PR to `html` (and `workflow_dispatch`);
      `npm ci`; lint; typecheck; `test:ci` (flag off);
      `npm run build:html`; upload artifact
      `html-staging-web` from `markdown-viewer/dist`.
      **Do not** call `desktop.yml`, version-bump, or
      production Pages.
- [ ] Optional: add `html` to `ios.yml` `push.branches` so
      simulator CI runs on the integration branch.
- [ ] Confirm `static.yml` / `version-bump.yml` /
      `desktop.yml` still only ship from `main` / tags /
      dispatch on `main`.

### 5. Docs in the same PR

- [ ] AGENTS.md or `package.json` description is **not**
      required. A 10-line note at the top of
      [project-html README](README.md) “how to dogfood” is
      enough if the scripts exist.
- [ ] Do not rewrite landing or Press B.

## Manual smoke

1. `npm run build` then `npm run preview` — drop a `.md`,
   Mermaid still works; drop `.html` still rejected; landing
   unchanged.
2. `npm run build:html` — `htmlDocumentsEnabled()` is true in
   the bundle (grep `dist` or a tiny console check). Still no
   open-gate change, so dropping `.html` is still rejected
   until Session 01. That is correct.
3. `npm run desktop` (if a display): unchanged markdown app.
4. Do **not** run `desktop:build` / notarize from this PR.

## After merge to `main`

```bash
git fetch origin
git checkout main
git pull origin main
git checkout -b html
git push -u origin html
```

Protect `html` only as a normal branch (no version-bump). Do
not open Session 01 against `main`.

## Done when

- Production-shaped build is byte-behavior identical for
  users (gates, CSP source, DOM).
- HTML-on *build* exists as a script + CI artifact pipeline,
  ready for Session 01 to hang gates on.
- `html` branch is pushed.
- One commit, one PR, into **`main`**.
