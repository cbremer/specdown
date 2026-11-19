# Design system

SpecDown's shared visual language across web/PWA, Electron desktop (direct download, Mac App Store, Windows, Linux), iPadOS and iOS. The live system is in [`design-system/`](../../design-system/README.md). This folder holds its history and plans.

- [Linear project: SpecDown Design System](https://linear.app/zilla151/project/specdown-design-system-663e12a0f863)

| Date       | Document                                                                           | Summary                                                                                                |
| ---------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 2026-11-19 | [Session 01](2026-11-19-tasks-session-01-codify-design-system.md)                  | Audit the shipped UI, codify tokens/components/native/themes, commit as the source of truth            |
| 2026-11-19 | [Session 02](2026-11-19-tasks-session-02-toast-layer-and-save-contrast.md)         | Fix toasts hidden under dialogs (ZIL-220) and dark-theme Save contrast (ZIL-219)                       |
| 2026-11-19 | [Session 03](2026-11-19-tasks-session-03-search-highlights-and-logo-correction.md) | Fix search highlight contrast (ZIL-222); correct the dark-logo finding (ZIL-221 was not a bug)         |
| 2026-11-19 | [Session 04](2026-11-19-tasks-session-04-shared-modal-and-dialog-a11y.md)          | Shared Modal in the app for Shortcuts, About, File info (ZIL-230); dialog accessibility gaps (ZIL-223) |
| 2026-11-19 | [Spec: C+ brand moments](2026-11-19-spec-brand-moments-cplus.md)                   | Chosen direction, gate, tokens and rollout (ZIL-226)                                                   |
| 2026-11-19 | [Session 05](2026-11-19-tasks-session-05-cplus-dev-preview.md)                     | C+ in Dev builds behind a Dev-only gate (ZIL-235)                                                      |
| 2026-11-19 | [Session 06](2026-11-19-tasks-session-06-beta-256.md) | Promote the reviewed Dev 255 design to Beta 256 |

## Status

The system describes the UI **as it ships**. Values are copied from `markdown-viewer/styles.css`, the logos, `src/core/icons.js`, the visual-theme catalog, the iOS SwiftUI views and the Electron menu. Proposals (shared Modal, named scales, brand direction) are in [`design-system/evolving.md`](../../design-system/evolving.md) and the Linear project. They are not adopted yet.

## Naming conventions

`YYYY-MM-DD-<type>-<detail>.md`, with types `brainstorm`, `spec` and `tasks` (one numbered file per working session), as in [docs/README.md](../README.md).
