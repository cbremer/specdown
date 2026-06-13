# Tasks — Session 01: Phase 0 (Foundation & Hygiene)

**Date:** 2026-06-13
**Type:** tasks (session-level implementation checklist)
**Phase:** 0 — Foundation & hygiene (no user-visible risk)
**Source plan:** [2026-06-13-brainstorm-modernization-evaluation.md](2026-06-13-brainstorm-modernization-evaluation.md) §6

This session implements Phase 0 of the cross-platform modernization roadmap:
the no-user-visible-risk hygiene fixes that unblock the later architecture and
UX work.

---

## Checklist

### Defect fixes

- [x] **Desktop external links no longer dead.** `desktop/main.js` previously
  blocked all non-`file:` navigation and denied all popups, but never called
  `shell.openExternal` — so clicking any `https://` link did nothing. Both the
  `will-navigate` guard and `setWindowOpenHandler` now route `http(s)` URLs to
  the system browser via `shell.openExternal`, while still denying in-shell
  navigation and any non-web protocol.
- [x] **iOS CI can fail again.** Removed `|| true` from the `xcodebuild | xcpretty`
  step in `.github/workflows/ios.yml`. GitHub Actions' default shell is
  `bash -eo pipefail`, so the build's exit status now propagates and a broken
  iOS build turns the lane red (the existing "raw output on failure" step is now
  reachable).

### Tooling & supply chain

- [x] **Lockfile committed.** Added `package-lock.json`; CI uses `npm ci` for
  reproducible installs. Reverses the prior "no lockfile" convention (updated in
  `AGENTS.md`).
- [x] **ESLint flat config** (`eslint.config.js`) + **Prettier**
  (`.prettierrc.json`, `.prettierignore`). Pragmatic rule set: production code
  (`app.js`, `desktop/main.js`) is clean (0 errors); browser/library/test
  globals declared; `no-undef` is off for the jsdom-based test suite until
  Phase 1 modularizes the app. Scripts: `lint`, `lint:fix`, `format`,
  `format:check`.
- [x] **CI lane** (`.github/workflows/ci.yml`): runs `npm ci` → `npm run lint`
  → `npm run test:ci` on every PR and on pushes to `main` / `claude/**`. This is
  the first time the 297-test suite is enforced in CI rather than by local
  convention.
- [x] **Dependabot** (`.github/dependabot.yml`): weekly npm + github-actions
  updates, dev-dependency bumps grouped to cut noise.
- [x] **CSP meta tag** in `markdown-viewer/index.html`: defense-in-depth on top
  of DOMPurify. `script-src 'self' 'unsafe-eval'` (Mermaid needs eval),
  `style-src 'self' 'unsafe-inline'`, permissive `connect-src`/`img-src`
  (https/http) because the viewer intentionally fetches user-supplied URLs and
  the GitHub API/raw hosts.

### Docs reconciliation

- [x] **README**: replaced the obsolete "Core Libraries (CDN)" / "Why CDN?"
  narrative with the vendored-locally reality; fixed the syntax-highlighting
  "add a language" example (was a `cdn.jsdelivr.net` script tag); corrected the
  Node version (v18+ → v22.12+); reframed "Version History" (the patch number is
  a build counter, not a changelog) pointing at Releases; documented
  `lint`/`format` and the CI gate.
- [x] **CLAUDE.md**: repo map now includes `ios/`, the docs subprojects,
  `vendor/`, the lockfile, lint/format config, and `.github/workflows/`;
  corrected the false "coverage thresholds are enforced" claim; added lint to
  the dev commands and pre-commit expectations.
- [x] **AGENTS.md**: updated the now-wrong "No linter configured" and
  "No lockfile" notes; added lint/format service rows.

---

## Deferred / intentionally out of scope this session

- **Repo-wide Prettier reformat.** `prettier --check` flags ~48 legacy files,
  almost all of which Phase 1 will rewrite when `app.js` is split into ES
  modules. Reformatting the 2,800-line monolith now would create large churn for
  no benefit and conflict with the version-sync `git add`. CI gates on **ESLint
  + tests** (both green); the full Prettier pass lands with the Phase 1 split.
  Rationale matches the roadmap's own sequencing note (§6) that restyling the
  monolith pre-split doubles cost.
- **`coverageThreshold` config.** Coverage is reported but not yet gated; can be
  added once Phase 1 stabilizes module boundaries.

## Verification needed before merge (cannot run headless here)

- **CSP**: the Jest/jsdom suite does not exercise the meta CSP. Manually confirm
  in (a) a desktop browser on the web build and (b) the Electron desktop app
  that markdown renders, Mermaid diagrams render/pan/zoom, syntax highlighting
  works, URL/GitHub-repo opening still fetches, and PNG/SVG export still works.
  If Mermaid or a vendored lib trips the policy, relax the specific directive.
- **Desktop external links**: confirm an `https://` link in a rendered document
  opens in the system browser (needs a display; not runnable in headless CI).

## Local verification done

- `npm run lint` → 0 errors (20 warnings, all pre-existing `no-unused-vars` in
  tests).
- `npm test` → 297 passed, 17 suites.

---

## Next session

Phase 1 — Architecture: introduce Vite + ES modules, split `app.js` into
`core/` / `features/` / `platform/`, delete `vendor/`, lazy-load Mermaid +
highlight languages, and begin gradual TypeScript (`checkJs`). Add the next
tasks file (`...-tasks-session-02-phase1-...`) and update the timeline below.
