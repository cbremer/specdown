# docs/

This folder contains all project documentation for SpecDown — AI-generated and human-edited.

Each project gets its own subdirectory:

| Folder | Description |
|---|---|
| [project-desktop/](project-desktop/) | Electron desktop app — brainstorms, specs, session task checklists |
| [project-ios/](project-ios/) | iOS & iPad app — brainstorms, specs, session task checklists |
| [project-url/](project-url/) | URL-based file opening — load markdown from GitHub or any web URL |

## Naming Conventions

Files inside each project folder follow this pattern:

```
YYYY-MM-DD-<type>-<detail>.md
```

**Types:**
- `brainstorm` — pre-code exploration, problem framing, framework comparisons
- `spec` — technical specification (version new files for major revisions, e.g. `spec-desktop-v2.md`)
- `tasks` — session-level implementation checklists (one file per working session, numbered)
