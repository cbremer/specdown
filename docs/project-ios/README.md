# Project: Specdown for iOS & iPad

An iOS and iPad application bringing the Specdown markdown viewer to Apple's mobile platforms. This document is the entry point for understanding the project's goals, status, and history.

---

## What It Is

Specdown for iOS & iPad would be a native mobile app that renders markdown files with the same capabilities as the web and desktop versions:
- GitHub Flavored Markdown rendering
- Interactive Mermaid diagrams with touch-friendly zoom/pan
- Syntax-highlighted code blocks
- Light/dark theme (with system appearance support)

The goal is to bring the Specdown viewing experience to iPhone and iPad, taking advantage of mobile-specific capabilities like Share Sheet integration, Files app support, and iPad multitasking.

---

## Why iOS & iPad

The web version works in mobile Safari but isn't optimized for touch. The desktop version is macOS-only. An iOS/iPad app would:
1. Let users view markdown files on the go
2. Integrate with the iOS/iPadOS Files app and Share Sheet
3. Support iPad multitasking (Split View, Slide Over)
4. Provide a touch-optimized experience for Mermaid diagram interaction

---

## Timeline

| Date | Type | Document | Summary |
|---|---|---|---|
| Feb 23, 2026 | Brainstorm | [2026-02-23-brainstorm-ios.md](2026-02-23-brainstorm-ios.md) | Problem framing, framework options, touch considerations, code sharing strategy, MVP scope |
| Mar 16, 2026 | Spec | [2026-03-16-spec-ios-v1.md](2026-03-16-spec-ios-v1.md) | Full technical specification: Swift + WKWebView architecture, IPC contract, 4-session feature scope, touch interaction plan |
| Mar 16, 2026 | Tasks | [2026-03-16-tasks-session-01-project-setup.md](2026-03-16-tasks-session-01-project-setup.md) | Session 1 checklist — Xcode project, WKWebView shell, web assets bundled, JS bridge skeleton, CI workflow |

---

## Current Status (as of Mar 16, 2026)

**Phase: Spec complete, ready for Session 1** — Architecture decided (Swift + WKWebView). Spec written. Session 1 tasks defined. No code yet.

---

## Documentation Conventions

Files in this folder follow the naming pattern:

```
YYYY-MM-DD-<type>-<detail>.md
```

**Types:**
- `brainstorm` — pre-code exploration, problem framing, framework comparisons
- `spec` — technical specification (create a new versioned file for major revisions)
- `tasks` — session-level implementation checklists (one file per working session)

**Examples:**
```
2026-02-23-brainstorm-ios.md
2026-03-01-spec-ios-v1.md                          ← future
2026-03-05-tasks-session-01-project-setup.md       ← future
```

New sessions: add a tasks file with the next session number and a short topic slug. Update the timeline table in this README.
