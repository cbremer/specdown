# Brainstorm — Evaluation v2: SpecDown After the Modernization Wave

**Date:** 2026-07-14
**Type:** brainstorm (post-modernization re-evaluation)
**Baseline:** v0.0.154 (`main`), evaluated against the v0.0.82 evaluation of
2026-06-13 and the claims in the project README / retrospective.

Method: independent toolchain verification (lint, typecheck, full test suite,
production build) plus two parallel deep-dive code reviews — one
engineering/security, one UX/product — with every docs claim checked against
actual code. Nothing below is taken from the project's own docs on faith.

---

## 1. Executive Verdict

**The modernization was real — and lopsided.** In four weeks the app went from
a 2,781-line vanilla-JS monolith to a Vite/ESM codebase of 33 modules with
100% TypeScript checking, 461 passing tests (was 297), per-diagram lazy
chunking (app shell 282 kB / 92 kB gzip), a signed + notarized universal macOS
DMG, Windows/Linux lanes, auto-update, PWA, changelog automation, and a dozen
new features. Architecture grade: **B+**. Renderer security: **clean — no
injection sink found** across every dynamic-HTML path.

But the two halves shipped unevenly:

- **Plumbing (Phases 0/1/3): ~90% real.** Every v0.0.82 engineering finding
  except one is verifiably fixed (§3).
- **Design/UX layer (Phase 2) + feature coherence (Phase 4): ~50% real.**
  Tokens were declared but not adopted, the emoji icons and harsh dark theme
  survived untouched, and ten features landed in two weeks without a
  consolidation pass — the app now has three adjacent toolbar buttons whose
  names all mean "notes" (§4).

**The recommended next cycle is consolidation, not addition** — plus one
genuinely urgent engineering item: the Windows/Linux auto-update path ships
unsigned binaries with auto-install enabled (§5, finding E1).

---

## 2. Independently Verified State

| Check                                             | Result                                                                                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                            | 0 errors, 49 warnings (all unused-vars / stale imports / stale disable-directives)                                                          |
| TypeScript (`tsc --noEmit`, `strict` + `checkJs`) | Clean                                                                                                                                       |
| Jest                                              | **461/461 pass**, 30 suites, ~8s                                                                                                            |
| Production build                                  | Succeeds in <1s; Mermaid split into ~20 lazy per-diagram chunks; entry 282.6 kB (92.5 kB gzip); dist 3.6 MB total                           |
| Module split                                      | 33 modules, 6,399 lines. Largest: `src/main.js` **943** lines, `features/annotations.js` 797 — both above the roadmap's own 500-line target |
| Minimap regression check                          | False alarm — wired in `features/diagrams.js:389`; the lint warning is a stale import in `main.js`                                          |

## 3. v0.0.82 Findings — Scorecard

| 2026-06-13 finding                     | Status        | Evidence                                                                                                                                                                                    |
| -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| External links dead on desktop         | **FIXED**     | `desktop/main.js:304-332` — `will-navigate` + `setWindowOpenHandler` route http/https to `shell.openExternal`, deny otherwise                                                               |
| iOS CI `\|\| true` swallows failures   | **FIXED**     | `ios.yml:59-97` — `set -o pipefail` + `tee`, warning surfacing, raw rerun on failure                                                                                                        |
| No lockfile / lint / CSP               | **FIXED**     | `package-lock.json`; ESLint+Prettier+typecheck gating in `ci.yml`; CSP meta in `index.html:15` (no `unsafe-inline` scripts, `object-src 'none'`)                                            |
| Vendored-lib drift                     | **FIXED**     | `vendor/` deleted; real npm deps bundled by Vite                                                                                                                                            |
| `alert()` for tab limit                | **FIXED**     | Accessible toast system (`features/toast.js`)                                                                                                                                               |
| No system theme / reduced motion       | **FIXED**     | 3-way theme cycle with live `matchMedia` (`theme.js:44-105`); global reduced-motion (`styles.css:81-90`)                                                                                    |
| Unsigned macOS app                     | **FIXED**     | Signed + notarized universal DMG lane (`desktop.yml:56-62`)                                                                                                                                 |
| Coverage thresholds claimed but absent | **NOT FIXED** | Still no `coverageThreshold` in `package.json`; `test:ci` collects coverage but nothing gates on it. **CLAUDE.md and the retrospective still claim enforcement — the claim remains false.** |
| Emoji-as-icons                         | **NOT FIXED** | See §4                                                                                                                                                                                      |
| Harsh dark theme (`#fff` on `#1a1a1a`) | **NOT FIXED** | See §4                                                                                                                                                                                      |

## 4. UX/Product Evaluation (v2)

### 4.1 What's real

Command palette (Cmd/Ctrl+K, proper combobox/listbox ARIA, fuzzy filter, 16
commands), auto/system theme, toasts, code-copy, focus-visible rings, skip
link, reduced motion, durable annotation anchoring (fingerprint, heading-path,
ordinal, fallback), presentation mode, workspace mode, recents, session
restore. All verified in code.

### 4.2 The design system is a veneer

| Claim                  | Reality                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Spacing scale          | `--space-1..6` defined (`styles.css:39-44`) — **zero usages**; padding/gap remain raw rem literals       |
| Type scale             | Doesn't exist — only font-family tokens; **79** raw `font-size` literals                                 |
| Semantic colors        | Defined, but **64** raw hex values remain                                                                |
| Radius scale           | Genuinely adopted (59 usages)                                                                            |
| Emoji → SVG icons      | **Never happened**: toolbar is still `⟳ 🗂 ☰ ⊟ 💬 ✎ 🗒 ⎙ ▶ </> ⋮`, theme is `🌙/☀️/🌗`, file icon `📄`  |
| Dark theme fix         | Untouched: `#ffffff` text on `#1a1a1a` (~17:1 halation); white-on-accent CTAs ≈ **3.3:1, below WCAG AA** |
| Kill `transition: all` | The antipattern was _tokenized_, not removed — `--transition: all 0.3s ease` used 17×                    |

### 4.3 Coherence debt (the new problem class)

1. **Comments 💬 vs Annotate ✎ vs Notes 🗒 — three adjacent controls with
   colliding vocabulary.** "Comments" merely toggles visibility of authored
   `<!-- HTML comments -->`; "Annotate" creates user notes; "Notes" lists
   them. Illegible to any user; the differentiating feature is buried beside
   an unrelated toggle that shares its name.
2. **Desktop toolbar is ~9–11 buttons.** The overflow "⋮" menu only exists
   below 768px, and it _duplicates_ core buttons rather than holding a long
   tail. The mobile problem got solved; the desktop one didn't.
3. **No focus traps on any modal** (palette, shortcuts, presentation, iOS
   sheets set `aria-modal` but Tab escapes) — WCAG 2.4.3 violation.
4. **Search still has no visible affordance** (Cmd+F or palette only; iOS has
   no search at all). No loading states anywhere for URL fetch / folder scan.
5. **Shortcut sheet lists only 5 shortcuts**, omitting presentation nav,
   annotate double-click, diagram zoom keys, workspace.
6. **First-run drop zone now competes with itself**: Browse + Open Folder +
   samples + URL input + Recents, no visual hierarchy.
7. **Palette is not yet the universal entry it claims**: no commands for
   workspace sidebar toggle, watch toggle, tab close/switch, share-link copy,
   clear recents.

### 4.4 Platform parity (from actual platform branches)

Web and desktop are near-parity (desktop adds native open, folder workspace,
watch, path-recents; web-only: PWA/session-restore-by-URL). **iOS is now the
laggard**: no palette, no search, no workspace, no recents (samples instead),
2-way theme instead of 3-way, no swipe-to-dismiss on sheets, no Dynamic Type.
Safe-area handling is correct. iOS distribution (TestFlight lane) remains
scaffolded-but-inert pending App Store Connect secrets.

## 5. Engineering/Security Evaluation (v2)

Renderer security is clean: DOMPurify on every markdown/SVG path, Mermaid at
`securityLevel: 'strict'` + `htmlLabels: false`, `escapeHtml` or
`textContent` on every dynamic-HTML build site. The `platform/bridge.js` seam
is the best structural asset — one null-guarded funnel for all shell calls.

Ranked new findings:

| #   | Sev       | Finding                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **Major** | **Win/Linux auto-update ships unsigned binaries with `autoDownload` + `autoInstallOnAppQuit`** (`desktop/main.js:103-104`; no signing in `win`/`linux` build config). electron-updater performs no signature verification for unsigned apps → a compromised release asset or upload token silently installs on next quit. macOS is safe (signed + notarized). |
| E2  | **Major** | **Release artifacts built with `npm install`, not `npm ci`** (`desktop.yml:50,124,173`) — the shipped binaries can embed a dependency tree that was never tested against the lockfile.                                                                                                                                                                        |
| E3  | **Major** | **`version-bump.yml` pushes to `main` with an admin PAT that bypasses branch protection** — a standing broad-scope credential; and with no `coverageThreshold`, the "enforced gates" story is weaker than documented.                                                                                                                                         |
| E4  | Minor     | Tab-switch race: `renderMarkdown`/`switchTab` are async with no render-generation token; fast A→B→C switching leaks panzoom instances into shared state and can interleave `mermaid.initialize()` with in-flight renders (mixed-theme diagrams).                                                                                                              |
| E5  | Minor     | Service worker caches _any-status_ navigation responses (`sw.js:50-57`) — a transient 5xx page can become the offline fallback until the next successful navigation.                                                                                                                                                                                          |
| E6  | Minor     | Workspace relative-link navigation doesn't constrain to the workspace root (`desktop/main.js:484-500`) — `../../../` escapes are click-gated and `.md`-only, but containment is one `startsWith` check away.                                                                                                                                                  |
| E7  | Minor     | Redundant unauthenticated GitHub API version check on every desktop launch, alongside electron-updater (60 req/hr/IP shared-NAT risk).                                                                                                                                                                                                                        |
| E8  | Minor     | All Actions pinned to mutable major tags (incl. the release/signing lane), defeating Dependabot's `github-actions` coverage. Pin to SHAs.                                                                                                                                                                                                                     |
| E9  | Minor     | Annotation anchoring: FNV-1a-32 fingerprint collision or repeated identical blocks can silently re-attach a note to a sibling block _and persist the drift_. Data-move, not data-loss; low probability.                                                                                                                                                       |
| E10 | Minor     | Window bounds saved on `resize` only (never `move`), no display validation → off-screen restore after monitor changes.                                                                                                                                                                                                                                        |

Remaining structural debt: `main.js` (943 lines) never got decomposed;
`core/state.js` is one shared-mutable object with no encapsulation; diagram
state rides on DOM expando properties.

## 6. Recommended Next Cycle — "Consolidate & Harden" (session-sized)

**Wave A — Security/trust (do first):**

1. Gate auto-update to signed platforms (or sign Windows via Authenticode);
   until then set `autoInstallOnAppQuit=false` on Win/Linux. (E1)
2. `npm ci` in all release lanes; add real `coverageThreshold` (make the
   docs' claim true); pin Actions to SHAs; scope down the version-bump
   credential. (E2/E3/E8)
3. SW: cache only `response.ok` navigations; workspace-root containment;
   drop the redundant desktop version check. (E5/E6/E7)

**Wave B — UX consolidation (the visible payoff):** 4. Resolve the Comments/Annotate/Notes collision: one **Annotate** primary
control; "Show author comments" demoted to overflow/palette. 5. Ship the SVG icon set (Lucide, inlined) + finish the token pass (adopt
`--space-*`, add a type scale, kill `transition: all`) + soften dark
theme (`#e8e8e8`-class text, ≥4.5:1 CTAs). 6. Make the overflow menu real at all widths (~4 visible buttons: Contents,
Split, Annotate, Present); add a visible search affordance. 7. Focus traps for all modals; complete the shortcut sheet; loading states
for URL/folder; simplify the first-run drop zone to one primary action.

**Wave C — Engineering hygiene:** 8. Render-generation token to kill the tab-switch race (E4); decompose
`main.js` (<500 lines); encapsulate `core/state.js` behind accessors;
fix the 49 lint warnings and stale eslint ignores.

**Wave D — The one unbuilt platform:** 9. iOS: TestFlight secrets + first external build, then parity pass
(search, palette-equivalent, 3-way theme, swipe-to-dismiss, Dynamic
Type). Apple Developer account is confirmed available.

**Deliberate non-goals for this cycle:** no new top-level features. The
diagram-depth ideas (node search within a diagram, deep-link to a node,
diagram-only TOC) are the _right next differentiators_ but should start only
after Waves A–B land, so they build on a coherent surface.

## 7. Scoreboard vs. the v0.0.82 North Star

| Pillar (June vision)   | Grade now                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Document-first chrome  | C — palette real; toolbar denser than ever                                           |
| Real design system     | C− — tokens declared, not adopted; icons/dark theme untouched                        |
| Workspace reading      | B — folder mode + relative links on desktop; web partial; iOS absent                 |
| Diagram superpowers L2 | B+ — presentation + lazy Mermaid; node-level nav still open                          |
| Review workflows       | B — durable anchors + export/import; naming collision undermines it                  |
| Platform citizenship   | B+ — signed macOS, win/linux lanes, PWA; iOS undistributed; Win update-integrity gap |
