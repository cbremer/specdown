# Project: Specdown Desktop

A macOS native desktop application wrapping the existing Specdown web viewer in an Electron shell. This document is the entry point for anyone trying to understand what was built, why, and how the project unfolded.

---

## What It Is

Specdown Desktop is a macOS `.app` (distributed as a `.dmg`) that loads the same vanilla JavaScript markdown viewer used by the web version, adding native desktop capabilities:
- Open any `.md` file directly from Finder (double-click, drag-to-dock)
- Multi-file tabbed interface (up to 10 tabs)
- Persistent state across sessions (open files, scroll positions, theme)
- File watching — auto-reload when a file changes on disk
- Native macOS menus, keyboard shortcuts (`Cmd+O`, `Cmd+W`, `Cmd+1`–`9`, `Cmd+P`)
- Print and PDF export

The web version (`cbremer.github.io/specdown`) is completely unaffected — both share the same `markdown-viewer/` codebase.

---

## Why Desktop

The web version had four hard limitations that the browser could not solve:
1. **Single file at a time** — loading a new file replaced the old one
2. **No persistence** — state was lost on reload
3. **Requires a web server** — even locally, `python3 -m http.server` was needed
4. **No native file system** — couldn't integrate with Finder, file associations, or OS-level drag-and-drop

Three frameworks were evaluated (Tauri, Electron, Swift + WKWebView). Electron was chosen for its JavaScript runtime (reuse all existing code without rewriting), ecosystem maturity, and speed of implementation. See [2026-02-20-brainstorm-desktop-electron.md](2026-02-20-brainstorm-desktop-electron.md) for the full comparison.

---

## Timeline

| Date | Type | Document | Summary |
|---|---|---|---|
| Feb 20, 2026 | Brainstorm | [2026-02-20-brainstorm-desktop-electron.md](2026-02-20-brainstorm-desktop-electron.md) | Problem framing, framework comparison (Tauri vs Electron vs Swift + WKWebView), MVP scope, same-repo strategy |
| Feb 21, 2026 | Spec | [2026-02-21-spec-desktop-v1.md](2026-02-21-spec-desktop-v1.md) | Full technical specification: feature list, architecture, IPC contract, testing strategy, implementation status |
| Feb 21, 2026 | Tasks | [2026-02-21-tasks-session-01-electron-shell.md](2026-02-21-tasks-session-01-electron-shell.md) | Session 1 implementation checklist — Electron shell, DMG CI, dev loop |

---

## Current Status (as of Feb 21, 2026)

| Feature | Status |
|---|---|
| Electron shell (`desktop/main.js`, `desktop/preload.js`) | Implemented |
| Dev loop (`npm run desktop`) | Implemented |
| DMG packaging (`electron-builder`) | Configured (awaiting macOS build) |
| Existing Jest test suite passing | Verified |
| Multi-file tabs | Pending |
| Native file open (`Cmd+O`) | Pending |
| File watching | Pending |
| Persistent state | Pending |
| Recent files & favorites | Pending |
| Print & PDF export | Pending |
| Native macOS menus | Pending |

Session 2 will pick up with native file open, IPC bridge, and basic menus.

---

## Documentation Conventions

Files in this folder follow the naming pattern:

```
YYYY-MM-DD-<type>-<detail>.md
```

**Types:**
- `brainstorm` — pre-code exploration, problem framing, framework comparisons
- `spec` — technical specification (create a new versioned file for major revisions, e.g. `spec-desktop-v2-tabs.md`)
- `tasks` — session-level implementation checklists (one file per working session)

**Examples:**
```
2026-02-20-brainstorm-desktop-electron.md
2026-02-21-spec-desktop-v1.md
2026-02-21-tasks-session-01-electron-shell.md
2026-02-28-tasks-session-02-native-file-open.md    ← future
2026-03-10-spec-desktop-v2-tabs.md                 ← future major spec revision
```

New sessions: add a tasks file with the next session number and a short topic slug. Update the timeline table in this README.
