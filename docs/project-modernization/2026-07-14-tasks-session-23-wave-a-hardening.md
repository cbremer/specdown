# Tasks — Session 23: Wave A (Security & Trust Hardening)

**Date:** 2026-07-14
**Scope:** Wave A of the
[Evaluation v2](2026-07-14-brainstorm-evaluation-v2-post-modernization.md)
"Consolidate & Harden" plan — the security/trust findings (E1–E3, E5–E8).

## Checklist

- [x] **E1 — Gate auto-update to signed platforms.** electron-updater does no
      signature verification for unsigned apps, so Win/Linux auto-download +
      install-on-quit was silent RCE-on-feed-compromise.
      `isSignedUpdatePlatform()` (darwin-only today) now gates
      `initAutoUpdater`; on unsigned packaged builds, Help → Check for Updates
      offers the GitHub Releases page via `shell.openExternal` instead.
- [x] **E2 — `npm ci` in release lanes.** All three `desktop.yml` jobs built
      shipped artifacts with `npm install` (untested dep trees possible);
      switched to `npm ci`.
- [x] **E3 (partial) — version-bump credential.** Documented in
      `version-bump.yml` that `ADMIN_PAT` should become a GitHub App
      installation token / fine-grained PAT. **User action required** — this
      is an account/settings change that can't be made from the repo.
- [x] **E5 — Service worker: only cache `response.ok` navigations** so a
      transient 4xx/5xx can't become the persistent offline fallback. Guarded
      by a static test in `pwa.test.js`.
- [x] **E6 — Workspace-root containment.** `openRelativeFromFile` now rejects
      resolved targets outside every opened workspace root
      (`path.relative`-based, so sibling-prefix dirs don't false-positive).
      The renderer only sends `request-open-relative` while a workspace is
      active, so nothing legitimate breaks. New unit tests cover root/nested
      accept, escape reject, prefix-collision reject, and no-workspace reject.
- [x] **E7 — Drop the redundant desktop version poll on macOS.** The preload
      now exposes `platform`; `bridgeDesktopPlatform()` was added to the
      bridge seam; the renderer skips the unauthenticated GitHub-API check on
      macOS desktop where electron-updater owns updates. Win/Linux keep the
      poll — it is their only update signal.
- [x] **E8 — Pin all GitHub Actions to commit SHAs** (with `# vN` comments)
      across all six workflows, resolved via `git ls-remote` against the
      upstream tags.
- [x] **Coverage thresholds (v0.0.82 leftover, honest version).** Coverage
      collection turned out to be ~0% for renderer modules because
      `tests/helpers/loadApp.js` inlines + evals the module graph outside
      Jest's instrumentation. Blanket thresholds would be theater, so the
      enforced `coverageThreshold` covers `desktop/main.js` only (the one
      directly-required file, ~30% real coverage; floors set just below).
      CLAUDE.md updated to describe the actual situation. Making renderer
      coverage measurable (import modules through Jest) is a Wave C item.

## Not in this session (Wave A leftovers → user / later)

- Replace `ADMIN_PAT` with a GitHub App token (user/settings action, see E3).
- Windows Authenticode signing (would let Win rejoin auto-update; needs a
  cert purchase decision).
- Renderer coverage instrumentation fix (Wave C, tracked above).

## Verification

- `npm run lint` — 0 errors
- `npm run typecheck` — clean
- `npm test` — full suite green including 9 new tests
- `npm run test:coverage` — `desktop/main.js` threshold enforced and passing
