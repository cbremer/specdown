# project-bugfix-wave

A rolling wave of post-modernization bug fixes and small UX polish across the
three SpecDown surfaces (web, desktop, iOS). The phased modernization roadmap is
complete (see [`../project-modernization/`](../project-modernization/)); this
folder tracks the smaller fixes that follow.

## Timeline

| Date | Doc | Summary |
|---|---|---|
| 2026-06-21 | [tasks-session-01](2026-06-21-tasks-session-01-diagram-controls-overlap.md) | Diagram control toolbar overlapped/covered the diagram on phones (iOS + mobile web) |
| 2026-06-21 | [tasks-session-02](2026-06-21-tasks-session-02-diagram-double-tap-zoom.md) | Double-tap on a diagram zoom button zoomed the whole page instead of the diagram |
| 2026-06-21 | [tasks-session-03](2026-06-21-tasks-session-03-jsyaml-dos-advisory.md) | Cleared the js-yaml DoS Dependabot advisory (dev-only transitive) via a scoped override |
| 2026-06-22 | [tasks-session-04](2026-06-22-tasks-session-04-ios-present-action-sheet.md) | Presentation mode was unreachable on iPhone — added a Present entry to the iOS action sheet |
| 2026-07-22 | [brainstorm-diagram-inline-static-ux](2026-07-22-brainstorm-diagram-inline-static-ux.md) | Diagrams read like control panels — options + decision to render them as static document content |
| 2026-07-22 | [tasks-session-05](2026-07-22-tasks-session-05-diagram-inline-static-ux.md) | Static inline diagrams: fixed 500px card + 8-button toolbar + always-armed panzoom replaced by natural-size rendering with an on-demand fullscreen explore mode |

## Status

Active.

## Naming Conventions

Files follow the repo-wide pattern `YYYY-MM-DD-<type>-<detail>.md` with types
`brainstorm` / `spec` / `tasks` (numbered, one per working session). See
[`../README.md`](../README.md).
