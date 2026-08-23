# docs/

This folder contains all project documentation for SpecDown — AI-generated and human-edited.

Each project gets its own subdirectory:

| Folder | Description |
|---|---|
| [project-desktop/](project-desktop/) | Electron desktop app — brainstorms, specs, session task checklists |
| [project-ios/](project-ios/) | iOS & iPad app — brainstorms, specs, session task checklists |
| [project-url/](project-url/) | URL-based file opening — load markdown from GitHub or any web URL |
| [project-modernization/](project-modernization/) | Cross-platform modernization — product/UX/engineering evaluation, vision, phased roadmap |
| [project-bugfix-wave/](project-bugfix-wave/) | Post-modernization bug fixes & UX polish across web, desktop, and iOS |
| [project-sharing/](project-sharing/) | Product sharing kit — LinkedIn copy, article outlines, web showcase homepage |
| [project-html/](project-html/) | HTML documents — forked viewing runtime next to markdown (planning, council-amended) |

## Naming Conventions

Files inside each project folder follow this pattern:

```
YYYY-MM-DD-<type>-<detail>.md
```

**Types:**
- `brainstorm` — pre-code exploration, problem framing, framework comparisons
- `spec` — technical specification (version new files for major revisions, e.g. `spec-desktop-v2.md`)
- `tasks` — session-level implementation checklists (one file per working session, numbered)

## Not Built Yet (Current Cross-Project Snapshot)

- **Desktop (`project-desktop`)**: No remaining features in the current Session 1–4 scope.
- **URL opening (`project-url`)**: Inline reviewer comments (Google Docs-style) are still unimplemented and intentionally deferred from Session 01.
- **iOS/iPad (`project-ios`)**: Shell is implemented; latest work adds an adaptive iPadOS split layout while keeping the shared viewer architecture intact.
- **HTML documents (`project-html`)**: Planning complete and [council-amended](project-html/2026-08-23-council-html-plan-review.md). Implementation starts at Session 01 (kind + open + sandboxed preview). Do not convert HTML to markdown and do not inject it into the app origin — fork the document runtime. See [project-html/README.md](project-html/README.md).
