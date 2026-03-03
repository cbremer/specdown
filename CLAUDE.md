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
├── README.md                    # User-facing project overview
├── package.json                 # npm scripts, Jest config, electron-builder config
├── docs/                        # All project documentation (AI-generated and human-edited)
│   ├── README.md                # Index of all project doc folders
│   └── project-desktop/         # Desktop project — brainstorms, specs, session tasks
│       ├── README.md            # Entry point: overview, timeline, naming conventions
│       ├── 2026-02-20-brainstorm-desktop-electron.md
│       ├── 2026-02-21-spec-desktop-v1.md
│       └── 2026-02-21-tasks-session-01-electron-shell.md
├── markdown-viewer/             # Shared web app (used by both web and desktop)
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── desktop/                     # Electron shell
│   ├── main.js                  # Main process
│   └── preload.js               # IPC bridge
├── tests/                       # Jest test suite
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── setup.js
└── scripts/
    └── sync-version.js          # Keeps version in sync across files on npm version
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
npm run desktop           # launch Electron app from source (macOS)
npm run desktop:build     # build .dmg locally (macOS only)
```

Tests must pass before committing. Coverage thresholds are enforced (see `package.json`).

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
