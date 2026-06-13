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
├── eslint.config.js             # ESLint flat config
├── .prettierrc.json             # Prettier config
├── docs/                        # All project documentation (AI-generated and human-edited)
│   ├── README.md                # Index of all project doc folders
│   ├── project-desktop/         # Electron desktop project — brainstorms, specs, tasks
│   ├── project-ios/             # iOS/iPadOS WKWebView shell project
│   ├── project-url/             # URL-opening / GitHub repo browser project
│   └── project-modernization/   # Cross-platform modernization roadmap (current)
├── markdown-viewer/             # Shared web app (used by web, desktop, and iOS)
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   └── vendor/                  # Vendored libraries (marked, mermaid, panzoom, hljs, DOMPurify)
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
npm test                  # run full Jest suite (required before committing)
npm run test:coverage     # coverage report
npm run lint              # ESLint (flat config) — must be clean before committing
npm run format            # Prettier — write
npm run desktop           # launch Electron app from source (macOS)
npm run desktop:build     # build .dmg locally (macOS only)
```

Tests and lint must pass before committing; both run in CI on every PR
(`.github/workflows/ci.yml`). Coverage is reported by `npm run test:coverage`
but no hard `coverageThreshold` is configured in `package.json` yet.

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
