# Modernization — Handoff / Next-Wave Brief

**Date:** 2026-06-14 → 15
**Type:** handoff (durable resume point for a fresh session)
**Repo state at writing:** `main` @ **v0.0.109**, working tree clean, all gates green.

This file is the single place to re-orient after a break. It captures what's
done, what's left, the exact next steps, and the project's hard-won gotchas so a
new session can act without re-deriving context. Per-slice detail lives in the
`tasks-session-0X-*.md` docs; this is the index + forward plan.

---

## 1. Where we are

**Gates (run before every commit; all green now):**
`npm run build` · `npm run lint` · `npm run typecheck` · `npm test` (**345 tests**).
All four run in CI (`.github/workflows/ci.yml`) on every PR.

**Phase 0 — hygiene:** ✅ merged (pre-handoff).

**Phase 1 — architecture:** ✅ **complete.**
- Vite + ESM build; `vendor/` gone; all 3 surfaces load `markdown-viewer/dist/`.
- `src/main.js` split 2,814 → ~590 lines across `core/` / `features/` / `platform/`.
- Mermaid lazy-loaded (~2 MB deferred); highlight.js trimmed (app-shell 1.07 MB → 261 kB).
- Gradual TypeScript via `checkJs` + per-file `// @ts-check`; **25 / 25 modules checked**,
  `checkJs: true` now global (PR #127, merged). **TypeScript migration done.**

**Phase 2 — design system & UX:** ✅ **complete (4 slices).**
- Slice 1 ✅ accessible toasts (killed `alert()`) + a11y pass (skip link, aria-labels, reduced-motion).
- Slice 2 ✅ auto/system theme (light→dark→auto, `prefers-color-scheme` live) + global reduced-motion.
- Slice 3 ✅ command palette (Cmd/Ctrl+K) + keyboard shortcut sheet (`?`).
- Slice 4 ✅ design-token system (radius/spacing/motion/type scales + semantic status palette,
  value-preserving) + global `:focus-visible` rings + toolbar overflow "⋮" menu (PR #128).

> **This doc's original backlog (sections A/B below) is now DONE.** A = TypeScript ✅ (#127),
> B = Phase 2 slice 4 ✅ (#128). The live remaining work is **Phase 3** and **Phase 4** —
> see section C and §5.

**Phase 3 — distribution:** ⬜ not started (macOS signing/notarization — the desktop
Gatekeeper "damaged" fix; Windows/Linux lanes; PWA; Electron-vs-Tauri spike).

**Phase 4 — differentiators:** ⬜ not started (workspace mode, presentation mode,
annotations 2.0, web persistence).

---

## 2. The immediate backlog (pick up here)

> **Status update (session 10–11):** sections **A and B are DONE.** TypeScript is
> 100% complete (#127) and Phase 2 slice 4 shipped (#128). **Start at section C
> (Phase 3) — or §6 below for the genuinely remaining options.** A/B are kept for
> the record.

### A. Finish gradual TypeScript — the last 4 modules  ✅ DONE (#127)
Fully test/typecheck-gated, **zero visual risk**, ideal unattended work. Remaining:
- `markdown-viewer/src/features/diagrams.js` — the ~547-line panzoom/fullscreen/mermaid
  engine. Heaviest; expect Panzoom-instance typing + lots of nullable DOM. Do it FIRST
  of the four and on its own so it's reviewable.
- `markdown-viewer/src/platform/desktop.js` — Electron IPC; the `window.specdown` bridge
  is already typed in `globals.d.ts`, so this should be light.
- `markdown-viewer/src/platform/ios-chrome.js` — `window.webkit`/`iosNative` already in
  `globals.d.ts`; medium.
- `markdown-viewer/src/main.js` — the wiring hub. Do LAST (it imports everything). Mostly
  null-guards on the `getElementById` consts + event-handler param types.
- After all four: flip `checkJs: true` in `tsconfig.json` and drop the per-file pragmas
  (optional cleanup).
- **Pattern reminder:** see `tasks-session-09` — annotate the `el()` helper param; cast
  `getElementById`/`querySelector` at call sites; give DI callback vars explicit
  function-type JSDoc; type module-level DOM-node arrays; `import('../core/state.js').Tab`
  pulls the shared typedef.

### B. Phase 2 slice 4 — toolbar + tokens  ✅ DONE (#128)
Done value-preservingly (light/dark unchanged); the design-token consolidation of the
*remaining* scattered colors (annotation hexes, GitHub code-block theme) was deliberately
left for a visual pass. Original notes:
- **Design-token overhaul:** retire the ~50 stray hard-coded hex colors in `styles.css`
  into the existing `:root` / `[data-theme="dark"]` token system; add spacing / radius /
  typography scales. Keep it **provably value-preserving** (map each hex to a token equal
  to its current value) so the first pass is a no-visual-change refactor.
- **Toolbar consolidation + overflow menu:** the content-header actions already hide their
  labels on narrow screens (`styles.css` media query ~line 1919); a real overflow "⋯"
  menu would be the upgrade. Net-new interactive surface.
- **Why deferred:** not unit-testable; must be eyeballed in **light + dark** on web +
  desktop. Do this WITH the user available.

### C. Phase 3 — macOS signing/notarization (NEEDS USER CREDENTIALS)
This is the real fix for the desktop "app is damaged / can't be opened" Gatekeeper issue
the user hit early on (unsigned arm64 builds on current macOS). Blocked on:
- Apple Developer Program membership + a Developer ID Application cert.
- CI secrets (cert `.p12` + password, notarization Apple ID / app-specific password or
  API key) added to the repo's GitHub Actions secrets.
- Then wire `electron-builder` signing + `notarize` into the desktop build workflow.
Do NOT attempt unattended — it can't be tested without the certs and a real macOS run.

---

## 3. Hard-won gotchas (do not relearn these)

- **Eval test harness** (`tests/helpers/loadApp.js`): inlines the relative-import module
  graph and evals at global scope. Consequences:
  - A module-top `let`/`const` whose name matches another module's global silently
    shadows it. Name DI vars uniquely (e.g. `openTab`, `renderDoc` vs `reloadDoc`).
  - Any identifier from a *stripped bare import* that you then *reference* throws
    `ReferenceError`. `core/highlight.js` is therefore skipped by the harness (see the
    explicit carve-out in `loadApp.js`) and a global `hljs`/`mermaid` mock stands in.
  - Document-level `keydown` dispatch in tests is order-dependent (listeners accumulate
    across `loadApp` calls) — test the handlers' targets directly instead.
- **Shared mutable state** lives in `core/state.js` as object fields (ESM forbids
  reassigning imported bindings but allows mutating fields). The Vite/Rollup build is the
  guard against cross-module reassignment; the 345 tests guard behavior.
- **DI pattern:** coupled features take render-core/desktop callbacks via `configureX({…})`
  wired lazily in `init()` so deps resolve at call time (matters for tests that swap globals).
- **tabs ↔ desktop** cycle is broken one-way: `desktop.js` imports `tabs.js`; `tabs.js`
  gets desktop callbacks via `configureTabs` DI.
- **Native bridge contract** is declared in `markdown-viewer/src/types/globals.d.ts`
  (`window.specdown` desktop, `window.webkit`/`iosNative` iOS, app-set callbacks).
- **iOS** can't run ES modules over `file://` — it loads via a `WKURLSchemeHandler`
  serving `specdown://app/` (see `ios/SpecDown/WebView.swift`). Don't "fix" the CSP back.
- **Mermaid 11** needs `htmlLabels:false` (DOMPurify strips `<foreignObject>`); marked 18
  passes a token object to `renderer.code`.

---

## 4. Workflow / environment notes

- **Branch per slice:** `claude/<desc>` off `main`; PR to `main`; **never push to main
  directly**; let the release pipeline bump the version + build the DMG on merge.
- Each commit message ends with the session URL footer (see existing commits).
- **GitHub is via the `mcp__github__*` MCP tools** (no `gh` CLI). They occasionally drop
  and need a moment / re-auth; just retry.
- The remote **blocks branch deletion** (403) and force operations — delete stale branches
  from the GitHub UI. (There are ~70 stale `claude/*`,`copilot/*`,`codex/*` branches; a
  cleanup list could be generated but deletions must be done by the user.)
- Docs convention: add a `docs/project-modernization/YYYY-MM-DD-tasks-session-NN-*.md` per
  session and update that folder's `README.md` timeline + status.

## 5. Recommended first move next wave

~~Start with A → TypeScript…~~ **Done.** Phase 1 and Phase 2 are both complete.

## 6. What's actually left (Phase 3 + 4)

**Phase 3 — distribution.** Mixed: some needs the user, some is unattended-safe.
- **macOS signing/notarization** (the Gatekeeper "damaged" fix) — *needs the user*: Apple
  Developer membership, a Developer ID cert, and CI secrets. Can't be tested without them.
  This is the highest-value item but is fully user-gated. (Section C.)
- **Windows / Linux release lanes** — config-only (electron-builder `win`/`linux` targets +
  a CI workflow). Safe to write unattended, but real builds need CI runners to verify.
- **PWA** — a *manifest* alone is low-risk and makes the web app installable, **but it needs
  real icon PNG assets** (the repo only has the header logos + iOS icons — check
  `markdown-viewer/` and `ios/` for reusable sizes). A **service worker is risky** (a bad
  cache serves stale/broken assets to live users) — only add one with the user able to test.
- **Conventional-commit changelog pipeline** — low-risk CI/tooling.

**Phase 4 — differentiators** (all net-new features; pick by value):
- Web persistence: **recent files** + session restore. Note the platform nuance — browser
  local files can't be re-read by path (security), so "recent/restore" works cleanly only for
  **URLs** (re-fetch) and **desktop file paths** (re-read via IPC), not browser-picked files.
- Workspace/folder mode + working relative links; diagram presentation mode; annotations 2.0.

**Suggested next unattended pick:** the **Windows/Linux release lanes** (config-only, safe)
or **recent-files for URLs/desktop** (testable, real value). Hold **macOS signing** and any
**service worker** for when the user is available.
