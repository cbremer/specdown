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
| 2026-06-22 | [tasks-session-05](2026-06-22-tasks-session-05-presentation-swipe.md) | Swipe left/right to change slides in diagram presentation mode (touch) |

## Status

Active.

## Naming Conventions

Files follow the repo-wide pattern `YYYY-MM-DD-<type>-<detail>.md` with types
`brainstorm` / `spec` / `tasks` (numbered, one per working session). See
[`../README.md`](../README.md).
