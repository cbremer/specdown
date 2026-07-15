# CLAUDE.md — AI Working Instructions for SpecDown

This file is read automatically by Claude Code at the start of every session.
It captures project conventions so any AI assistant can pick up context quickly.

<!-- test: verify version-bump pipeline -->

---

## Project Overview

**SpecDown** is a lightweight markdown viewer with interactive Mermaid diagram support.
It has two surfaces that share the same `markdown-viewer/` codebase:

- **Web app** — deployed to GitHub Pages (`cbremer.github.io/specdown`)
- **Desktop app** — Electron wrapper distributed as a macOS `.dmg`

---

## Repository Structure

```
specdown/
├── CLAUDE.md                    # You are here
├── AGENTS.md                    # Pointer to CLAUDE.md + cloud-agent notes
├── README.md                    # User-facing project overview
├── package.json                 # npm scripts, Jest config, electron-builder config
├── package-lock.json            # Pinned dependency tree (used by `npm ci`)
├── vite.config.js               # Vite build config for the shared web app
├── eslint.config.js             # ESLint flat config
├── .prettierrc.json             # Prettier config
├── docs/                        # All project documentation (AI-generated and human-edited)
│   ├── README.md                # Index of all project doc folders
│   ├── project-desktop/         # Electron desktop project — brainstorms, specs, tasks
│   ├── project-ios/             # iOS/iPadOS WKWebView shell project
│   ├── project-url/             # URL-opening / GitHub repo browser project
│   └── project-modernization/   # Cross-platform modernization roadmap (current)
├── markdown-viewer/             # Shared web app (used by web, desktop, and iOS)
│   ├── index.html               # Vite entry (loads src/main.js as a module)
│   ├── styles.css
│   ├── samples/                 # Bundled sample docs (shipped in the iOS app)
│   ├── src/
│   │   └── main.js              # Viewer entry module (imports marked/mermaid/…)
│   └── dist/                    # Vite build output (git-ignored; built in CI)
├── desktop/                     # Electron shell
│   ├── main.js                  # Main process
│   └── preload.js               # IPC bridge
├── ios/                         # iOS/iPadOS Swift + WKWebView shell (XcodeGen project)
├── tests/                       # Jest test suite
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   ├── helpers/
│   ├── mocks/
│   └── setup.js
├── scripts/
│   └── sync-version.js          # Keeps version in sync across files on npm version
└── .github/workflows/           # CI (ci.yml), desktop build, iOS build, Pages deploy, version bump
```

---

## Docs Conventions

All documentation lives under `docs/`. Each project gets its own subdirectory:

```
docs/
├── project-desktop/       ← current
└── project-desktop-v2/    ← future example
```

Files inside a project folder follow this naming pattern:

```
YYYY-MM-DD-<type>-<detail>.md
```

**Types:**
- `brainstorm` — pre-code exploration, problem framing, framework comparisons
- `spec` — technical specification (version new files for major revisions, e.g. `spec-desktop-v2.md`)
- `tasks` — session-level implementation checklists (one file per working session, numbered)

**Examples:**
```
2026-02-20-brainstorm-desktop-electron.md
2026-02-21-spec-desktop-v1.md
2026-02-21-tasks-session-01-electron-shell.md
2026-02-28-tasks-session-02-native-file-open.md   ← next session would look like this
```

Each project folder has a `README.md` that serves as the entry point with:
- What the project is
- A timeline table linking all docs
- Current status
- The naming conventions for that project

When starting a new session, **add a tasks file** with the next session number and update the timeline table in the project's `README.md`.

---

## Development Commands

```bash
npm run dev               # Vite dev server for the web app (hot reload)
npm run build             # Vite production build → markdown-viewer/dist/
npm run preview           # serve the production build locally
npm test                  # run full Jest suite (required before committing)
npm run test:coverage     # coverage report
npm run lint              # ESLint (flat config) — must be clean before committing
npm run typecheck         # tsc --noEmit (checkJs) — must be clean before committing
npm run format            # Prettier — write
npm run desktop           # build the web app, then launch Electron (macOS)
npm run desktop:build     # build the web app + .dmg locally (macOS only)
```

The shared web app is a Vite + ES-module build. All three surfaces (web, desktop,
iOS) load the build output in `markdown-viewer/dist/`, so `npm run build` must
run before packaging the desktop or iOS app (the `desktop`/`desktop:build`
scripts and the CI workflows do this for you).

Tests, lint, and typecheck must pass before committing; all three run in CI on
every PR (`.github/workflows/ci.yml`). Coverage is reported by
`npm run test:coverage`. A hard `coverageThreshold` is enforced for
`desktop/main.js` — the only file the tests both instrument and actually
exercise, so the only one a threshold can honestly gate. Renderer modules
under `markdown-viewer/src/` show ~0% in coverage reports because the test
helper (`tests/helpers/loadApp.js`) inlines and evals the module graph outside
Jest's instrumentation — don't trust those numbers, and don't add renderer
thresholds until tests import modules through Jest.

**Gradual TypeScript:** the viewer is plain ESM JS, type-checked via
`checkJs`. `tsconfig.json` keeps `checkJs` off globally; modules opt in one at a
time with a `// @ts-check` pragma at the top (leaf modules first) plus JSDoc
types. `npm run typecheck` only checks opted-in files, so the gate stays green
while coverage grows. Native-bridge globals (`window.specdown`, `window.webkit`,
…) are declared in `markdown-viewer/src/types/globals.d.ts`.

---

## Release Pipeline

Merging to `main` triggers an automated sequence:

1. **Version bump** — `npm version patch` creates a commit + git tag (e.g. `v0.0.48`)
2. **DMG build** — macOS GitHub Actions runner builds and packages the `.dmg`
3. **GitHub Release** — DMG attached to a release matching the new tag
4. **Web deploy** — GitHub Pages updated simultaneously

Do not manually push version tags. Let the pipeline handle it.

---

## Git & Branch Conventions

- Feature branches: `claude/<short-description>-<session-id>`
- Always push with `git push -u origin <branch-name>`
- Write clear, descriptive commit messages
- Never push directly to `main` or `master`
- Never use `--no-verify` to skip hooks

**Merge discipline (learned the hard way):** a multi-commit PR merged with
**"Squash and merge"** — or merged before a follow-up commit finishes pushing —
**strands the trailing commit** (it never lands on `main`). Prefer **one logical
change = one commit per PR**; if a PR has multiple commits, use **"Rebase and
merge"** and **wait for "all checks passed" before merging**. Don't push new
commits to a branch whose PR is already merged — open a fresh PR off `main` and
cherry-pick the orphan.

## Hard-won learnings & gotchas

Read these before touching the render path, tests, or the native shells. Full
context: `docs/project-modernization/2026-06-19-retrospective-handoff.md` and the
`2026-06-14-handoff-next-wave.md` brief.

- **Eval test harness** (`tests/helpers/loadApp.js`) inlines the relative-import
  module graph and evals at global scope. A module-top `let`/`const`/`function`
  whose name matches another module's silently collides — **name module-private
  identifiers uniquely**. Bare imports (marked, mermaid, panzoom, hljs,
  DOMPurify) are stripped and provided as global mocks.
- **The DOMPurify + marked test mocks are passthroughs** — they strip/transform
  nothing. So green tests do **not** prove the production sanitize path works
  (this masked the bug where real DOMPurify drops HTML comments; the fix was
  `DOMPurify.sanitize(html, { ADD_TAGS: ['#comment'] })`). Verify
  library-behavior-dependent features against the real library.
- **Native shells ignore `window.prompt()`/`alert()`** — both Electron and iOS
  WKWebView. Use in-app modals/toasts for any cross-surface UI, never native
  dialogs.
- **One shared app, per-surface surfacing.** `markdown-viewer/` loads on web,
  desktop, and iOS, so shared fixes reach all three — but the **iPhone layout
  hides the desktop toolbar** (`.content-header-actions`), so new toolbar
  controls must also be wired into the **iOS action sheet** to be reachable on
  iPhone (iPad keeps the toolbar).
- **iOS has no auto-update channel** (build-from-source only) and **no
  distribution lane yet** (TestFlight/App Store is scoped but unbuilt). Agents
  can see source + CI output but **not** Xcode IDE prompts or device runtime
  logs; CI also pipes the iOS build through `xcpretty`, which hides Swift
  warnings.
- **The `window.specdown` bridge (`platform/bridge.js`) is the only shell
  coupling** — keep new desktop integration behind it (the portability seam).
- **Packaging:** macOS needs a **Developer ID Application** cert; `mac.notarize`
  is a boolean; the notarization wait is Apple-side/variable (a long wait isn't a
  failure); a universal mac build needs the `--universal` CLI flag in
  `desktop.yml` (a config `arch` alone is overridden).
