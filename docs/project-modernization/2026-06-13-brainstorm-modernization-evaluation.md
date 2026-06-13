# Brainstorm — SpecDown Cross-Platform Modernization Evaluation

**Date:** 2026-06-13
**Type:** brainstorm (pre-code evaluation + vision)
**Scope:** All surfaces — web (GitHub Pages), desktop (Electron), iOS/iPadOS (WKWebView shell)

This document is a three-lens evaluation of SpecDown as it exists at v0.0.82,
written from the perspective of a product manager, a UX designer, and a
distinguished engineer, followed by a north-star vision and a phased,
session-sized roadmap for modernizing the app across all platforms.

---

## 1. Product Snapshot (What Exists Today)

SpecDown is a markdown *viewer* — deliberately not an editor — whose
differentiator is deep interactive navigation of Mermaid diagrams: per-diagram
pan/zoom, fullscreen with minimap, zoom slider, SVG/PNG export, and shareable
diagram deep links.

| Surface | Status | Distribution |
|---|---|---|
| Web | Live | GitHub Pages (`cbremer.github.io/specdown`) |
| Desktop (Electron 40) | Shipping | Unsigned macOS `.dmg` via GitHub Releases; Windows/Linux targets configured in `package.json` but never built in CI |
| iOS/iPadOS (WKWebView + Swift shell) | Built in CI (simulator only) | Not distributed (no TestFlight/App Store) |

Feature inventory in the shared `markdown-viewer/` core: GFM rendering
(marked + DOMPurify), syntax highlighting (highlight.js, 22 languages), tabs
(max 10), TOC sidebar with scroll-spy, in-document search (Cmd+F), split
preview/raw view, print/PDF export, light/dark theme, custom CSS themes
(desktop), file watching with auto-reload (desktop, chokidar), URL opening
incl. a GitHub repo browser, localStorage annotations, diagram share links,
update check against GitHub Releases, session restore + recent files (desktop).

That is a genuinely impressive breadth for a no-build vanilla-JS app — and
breadth is now the core tension: ~2,800 lines of `app.js` in one global scope
serving three platforms with `if (isDesktop)` / `if (isIOSNative)` branches.

---

## 2. Product Management Evaluation

### 2.1 Positioning — strong niche, undersold

The honest one-liner today is buried: **"The reader for specs with serious
diagrams."** Nothing else in the space treats diagram *reading* as the primary
job:

- **GitHub/GitLab rendering** — static Mermaid, no pan/zoom, no fullscreen.
- **Typora / MarkText / Obsidian** — editor-first; diagram interaction is an
  afterthought.
- **VS Code preview** — developer-context only, weak diagram ergonomics.
- **Mermaid Live Editor** — single diagram, not a document.

SpecDown should lean into the *review/reading* workflow: architects sharing
specs, engineers reviewing design docs, teams reading AI-generated
documentation (a fast-growing category in 2026 — long markdown specs with
many Mermaid diagrams are exactly what agentic coding tools emit).

### 2.2 Adoption blockers (ranked by severity)

1. **Unsigned macOS app.** The README instructs users to bypass Gatekeeper
   with `xattr -cr`. For the target audience (engineers at companies with
   managed Macs) this is frequently *impossible*, not just scary. Signing +
   notarization is the single highest-leverage distribution fix.
2. **No Windows/Linux builds** despite `electron-builder` config already
   declaring `nsis` and `AppImage` targets — shipping these is nearly free.
3. **iOS app exists but is not obtainable.** CI builds it for the simulator;
   no human can install it. Either ship to TestFlight or pause investment.
4. **Web app has no persistence.** No recent files, no session restore, no
   re-open of local files (the File System Access API would enable all three
   in Chromium browsers). Every visit starts from zero.
5. **Discoverability.** Search exists only behind Cmd+F (no visible
   affordance on web), annotations only behind an unexplained double-click,
   and there is no keyboard-shortcut reference anywhere in the product.

### 2.3 Product debt / drift

- README claims "CDN" loading and "Why CDN?" benefits, but all libraries are
  vendored locally — two sources of truth (`vendor/` files vs `package.json`
  versions) that have already diverged.
- README's "Version History" says "v0.0.82 — Initial release"; the version
  bumps on *every* merge to main, so the history section is meaningless.
  There is no changelog a user could actually read.
- `CLAUDE.md`'s repo map omits the entire `ios/` project and the four GitHub
  workflows; it also says "Coverage thresholds are enforced (see
  `package.json`)" but no `coverageThreshold` exists there.
- "alpha" label is hardcoded in `app.js` (`APP_VERSION_LABEL`) with no
  definition of what graduates it to beta.

### 2.4 Opportunities (not currently on any roadmap)

- **Folder/workspace mode** — open a docs directory, get a file tree, follow
  relative links between documents. This is the single biggest functional gap
  for the "reading a spec repository" job. (Relative links between local
  files currently go nowhere on every platform.)
- **Annotations 2.0** — current notes live in localStorage keyed by filename
  (collisions across same-named files, lost on browser data clear, no
  export). Reviewer workflows need export/import (front-matter sidecar or
  JSON) before annotations can be a headline feature.
- **Diagram-first sharing** — the share-link + export foundation is in
  place; a "presentation mode" (step through diagrams fullscreen) is a cheap,
  demo-able differentiator.
- **PWA** — installable web app with offline support would give Windows and
  Linux users a path *today*, ahead of native builds.

---

## 3. UX Design Evaluation

### 3.1 Visual design — functional, but reads as a 2018 side project

- **Emoji as iconography** (🌙 ⎙ ✎ ⊟ ☰ ⟳ 📄) renders differently on every
  OS, can't be styled/recolored, has inconsistent optical weight, and is the
  loudest "not a polished product" signal in the UI. Replace with a single
  SVG icon set (e.g. Lucide, inlined — keeps the no-CDN stance).
- **Token system is thin** (`styles.css:4-31`): seven raw-hex colors, no
  typographic scale, no spacing scale, no radius tokens. The dark theme is
  pure `#ffffff` text on `#1a1a1a` — harsh; modern dark themes use
  desaturated near-blacks and off-white text.
- **`transition: all 0.3s ease`** as a global token causes sluggish,
  unintentional animation (e.g. theme switches animate every property of
  every element). Modern feel = 120–200ms targeted transitions +
  `prefers-reduced-motion` support (currently absent).
- **Chrome is heavy**: a full-height header with logo, version label, alpha
  badge, update link, and "Source" link is dev-tool framing, not reader
  framing. A reader app should give the document the screen; the header
  should collapse to a slim bar (and auto-hide in a future focus mode).
- **System theme is ignored** — theme defaults to light and never consults
  `prefers-color-scheme`. Auto/light/dark tri-state is table stakes.

### 3.2 Interaction & information architecture

- **Six labeled buttons in the content header** (Watch/Contents/Split/
  Annotate/Print/Raw) form a flat, growing toolbar. This pattern won't
  survive two more features. Modern answer: keep the 2–3 highest-frequency
  actions visible, move the rest behind an overflow + a **command palette
  (Cmd+K)** — which also solves shortcut discoverability and search
  visibility in one stroke.
- **Native-feeling reading affordances are missing**: no reading-width
  control, no font-size control, no estimated reading position beyond the
  scroll bar.
- **`alert()` for the 10-tab limit** is jarring and blocks the renderer; the
  toast pattern already exists (`#share-toast`) and should be generalized
  into a small notification system.
- **Empty/error states**: the drop zone is decent; URL errors are a bare red
  line; there are no loading skeletons for URL/repo fetches (a repo browse of
  a large repository feels frozen).

### 3.3 Accessibility (gaps are systematic, not incidental)

- Icon-only and emoji-labeled buttons lack `aria-label`s in several places;
  the visually-hidden `<h1>` is an inline-style hack rather than a `.sr-only`
  utility.
- No visible focus styles audit; keyboard-only operation of the diagram
  controls and fullscreen overlay is untested (panzoom is pointer-centric —
  keyboard zoom/pan bindings exist only as global shortcuts in fullscreen).
- No `prefers-reduced-motion`, no contrast verification of the accent
  (`#4a90e2` on white fails WCAG AA for text), no skip-to-content link.
- An accessibility pass should be a named workstream, not a cleanup chore —
  enterprise adoption (the audience that reads specs) increasingly requires
  it.

### 3.4 Per-platform UX notes

- **Web**: fine on desktop browsers; the mobile *web* experience is untested
  territory between "desktop layout" and the iOS-native chrome.
- **Desktop**: feels like the web app in a frame. No native traffic-light
  inset/vibrancy on macOS, no drag-region styling, and — see §4.3 —
  **external links do nothing at all**, which users will read as "broken."
- **iOS/iPadOS**: the action-bar + sheet pattern is a reasonable adaptive
  approach, but the iOS chrome lives as hidden DOM in the same `index.html`
  and `ios-*` branches in shared code. UX-wise it lacks platform
  conventions: no swipe-to-dismiss on sheets, no haptics, no Dynamic Type
  response, no pull-to-refresh on watched files.

---

## 4. Engineering Evaluation (Distinguished Engineer Lens)

### 4.1 What is genuinely good

- **Security posture of the renderer**: all markdown HTML and Mermaid SVG
  pass through DOMPurify (`app.js:1005`, `1139`, `1640`); dynamic HTML
  (tab bar, repo browser) consistently uses `escapeHtml`. This is better
  hygiene than most hobby viewers.
- **Electron hardening basics are right**: `contextIsolation: true`,
  `nodeIntegration: false`, a `will-navigate` guard, `setWindowOpenHandler`
  deny, dev-tools stripped from packaged builds.
- **Operational maturity in `desktop/main.js`** is unusually high: a
  user-accessible log file with a Help-menu entry, atomic temp-file+rename
  state writes, a well-reasoned directory-level chokidar strategy that
  survives atomic editor saves, an env-var escape hatch for network
  filesystems. The inline rationale comments are exemplary.
- **Test culture**: 285 Jest tests across 16 suites with sensible mocks and
  a shared `loadApp` helper; tests run in ~2s.

### 4.2 Structural debt — the monolith has hit its ceiling

- `markdown-viewer/app.js` is **2,781 lines in one file, one global scope,
  zero modules**, with ~45 top-level `let/const` mutable globals and
  platform branches woven through every feature. `styles.css` is 1,824
  lines. The "no build step" philosophy was the right call at 500 lines; at
  this size it costs more than it saves:
  - 20+ blocking `<script>` tags in `<head>` (including a multi-MB
    `mermaid.min.js`) gate first paint on the web.
  - Features cannot be tested in isolation — every unit test boots the whole
    app via jsdom.
  - Vendored minified libraries are committed to git and drift from
    `package.json` (which declares `marked`/`mermaid` as *runtime* deps that
    nothing imports).
- **Recommended target architecture**: native ES modules + Vite. Split into
  `core/` (render pipeline, sanitization), `features/` (tabs, toc, search,
  split, annotations, diagrams, repo-browser), and `platform/`
  (web/desktop/ios adapters behind one interface instead of scattered
  `isDesktop`/`isIOSNative` checks). Vite preserves the fast dev loop,
  eliminates the vendored-file drift, enables code-splitting (lazy-load
  Mermaid and highlight languages on first use), and unlocks gradual
  TypeScript via `checkJs` → per-module `.ts` migration.

### 4.3 Defects found during this review

1. **External links are dead in the desktop app.** `desktop/main.js:188-201`
   blocks non-`file:` navigation and denies popups; the comment says
   external links are "expected to open in the system browser via
   `shell.openExternal`" — but no such call exists anywhere. Clicking any
   `https://` link in a document silently does nothing.
2. **iOS CI cannot fail.** `.github/workflows/ios.yml:41` pipes
   `xcodebuild ... | xcpretty || true`. The `|| true` guarantees a green
   step, so the "raw output on failure" fallback step is unreachable and a
   broken iOS build merges silently.
3. **No `package-lock.json`** (deliberate per `AGENTS.md`, but wrong for an
   app that ships binaries): builds are non-reproducible and the desktop
   pipeline is exposed to supply-chain drift on every CI run.
4. **No CSP.** `index.html` has no Content-Security-Policy meta tag. With
   DOMPurify in place the risk is mitigated, but defense-in-depth costs one
   line and matters for an app that renders arbitrary remote markdown.
5. **Docs/config drift**: coverage thresholds claimed in `CLAUDE.md` are not
   configured; `engines` says Node ≥22.12 while README says ≥18; README's
   CDN narrative is obsolete.

### 4.4 Dependency & toolchain currency

| Item | Current | State of the art (mid-2026) |
|---|---|---|
| Mermaid | ^10.6.1 (vendored 10.x) | v11.x — better layouts (ELK), bug fixes, smaller builds |
| marked | ^11.1.1 | v16+ — notable parser/security fixes since v11 |
| Electron | ^40 | Current ✅ |
| Lint/format | none | ESLint flat config + Prettier, enforced in CI |
| Types | none | TypeScript (gradual) |
| Lockfile / Dependabot | none | lockfile + Renovate/Dependabot |
| Electron alternative | — | Evaluate **Tauri 2** for the shell: ~10MB vs ~150MB installers, lower RAM; viable because the renderer is plain web code. Decision, not assumption — Electron is fine if file-watching/IPC parity is costly to port. |

### 4.5 CI/CD & release pipeline

- Patch-bump-on-every-merge produces meaningless version history and no
  changelog. Adopt conventional commits + automated changelog, with
  minor/major bumps available.
- Add CI lanes: lint + typecheck + tests on PR (currently tests only run
  locally by convention); Windows/Linux electron-builder lanes; signed +
  notarized macOS lane (needs an Apple Developer cert — the one real cost).
- Pin actions, add `npm ci` with the new lockfile, add Dependabot.

---

## 5. North-Star Vision — "The reading surface for technical specs"

A focused, beautiful, fast reader that makes dense technical documents — and
especially their diagrams — feel *explorable*, on every screen the reader
owns. Not an editor. Not a wiki. The PDF-reader-grade experience markdown
never had.

**Pillars:**

1. **Document-first chrome.** Slim header, overflow menu, command palette
   (Cmd+K) as the universal entry point; focus mode that hides everything
   but the prose. Typography controls (width, size) like a modern reader.
2. **A real design system.** Token-based color/type/spacing/radius scales,
   SVG iconography, refined light/dark/auto themes, 150ms micro-interactions,
   `prefers-reduced-motion`, WCAG AA as a release gate.
3. **Workspace reading.** Open a folder (File System Access API on web,
   native on desktop/iOS), file tree sidebar, relative links that work,
   cross-document search, restored sessions on every platform.
4. **Diagram superpowers, level 2.** Mermaid 11 + ELK layouts, presentation
   mode (step through diagrams), copy-to-clipboard export, diagram outline
   panel; keep share links and minimap as the foundation.
5. **Review workflows.** Annotations with export/import and stable document
   identity (content hash, not filename); a "share annotated view" artifact.
6. **Honest platform citizenship.** Signed/notarized macOS, Windows/Linux
   installers, installable PWA, TestFlight for iOS with sheets/haptics/
   Dynamic Type done properly — one shared core, thin idiomatic shells.

---

## 6. Phased Roadmap (session-sized, per repo conventions)

### Phase 0 — Foundation & hygiene (1–2 sessions, no user-visible risk)
- Fix desktop external links (`will-navigate` → `shell.openExternal`).
- Remove `|| true` from iOS CI; make the workflow honest.
- Commit `package-lock.json`; add ESLint + Prettier + CI lane; add CSP meta
  tag; add Dependabot.
- Reconcile docs: README CDN narrative, version history, `CLAUDE.md` repo
  map + coverage claim, Node version.

### Phase 1 — Architecture (2–3 sessions)
- Introduce Vite + ES modules; split `app.js` into core/features/platform
  modules with a single platform-adapter interface; delete `vendor/`.
- Lazy-load Mermaid + highlight languages; measure first-paint win.
- Adopt TypeScript gradually (`checkJs` first). Keep all 285 tests green;
  migrate them per-module as files split.

### Phase 2 — Design system & UX modernization (2–3 sessions)
- Token overhaul + SVG icon set + auto/light/dark theme + motion polish.
- Slim header, toolbar consolidation + overflow, command palette (Cmd+K),
  toast/notification system (kill `alert()`), keyboard-shortcut sheet.
- Accessibility pass: labels, focus, contrast, reduced motion, skip links.

### Phase 3 — Platform parity & distribution (2–3 sessions)
- macOS signing + notarization; Windows + Linux release lanes; PWA manifest
  + service worker; conventional-commit changelog pipeline.
- Decision spike: Electron vs Tauri 2 for the v2 shell (timeboxed, written
  up as a brainstorm doc).
- iOS: TestFlight lane; native sheet/haptics/Dynamic Type polish.

### Phase 4 — Differentiating features (ongoing)
- Workspace/folder mode + working relative links + file tree.
- Mermaid 11 upgrade + presentation mode + diagram outline.
- Annotations 2.0 (stable identity, export/import, annotated-view sharing).
- Web persistence: recent files + session restore via File System Access
  API + IndexedDB.

**Sequencing rationale:** Phase 1 before Phase 2 — restyling a 2,781-line
monolith would double the cost of the split that has to happen anyway.
Distribution (Phase 3) can proceed in parallel with Phase 2 since it touches
CI, not the renderer.

---

## 7. Success Metrics

- **Adoption:** installs per release (GitHub release download counts), web
  sessions; target: Windows+Linux ≥ 30% of desktop downloads within two
  releases of shipping them.
- **Performance:** web first contentful paint < 1.0s on a cold load (today:
  gated on ~20 synchronous scripts); time-to-render for a 500KB doc with 20
  diagrams < 3s.
- **Quality:** zero `alert()`s; WCAG AA on automated audit; CI red when iOS
  build breaks (currently impossible).
- **Engineering velocity:** no source file > 500 lines after Phase 1; new
  feature touches ≤ 2 modules + 1 platform adapter on average.

## 8. Open Questions

1. Is iOS a real target (ship to TestFlight) or an experiment to pause?
   Investment decisions in Phases 2–4 change materially either way.
2. Apple Developer Program membership ($99/yr) for signing — acceptable?
   It is the prerequisite for both macOS notarization and TestFlight.
3. Electron vs Tauri: is full IPC/file-watching parity worth porting for a
   ~140MB installer reduction? (Phase 3 spike answers this with data.)
4. Does "viewer, not editor" hold? Light annotation is in-scope; anything
   resembling editing changes the competitive set entirely.
