# Agent instructions

This project keeps its primary agent instructions in `CLAUDE.md`.
When working with this repo, read and follow `CLAUDE.md` for:
- Project overview and goals
- Commands and scripts
- Coding, testing, and documentation conventions

## Cursor Cloud specific instructions

### Services

| Service | How to run | Notes |
|---------|-----------|-------|
| Web app | `cd markdown-viewer && python3 -m http.server 8000` | Static files; no build step needed |
| Tests | `npm test` | Jest with jsdom; all 285 tests run in ~2s |
| Desktop (Electron) | `npm run desktop` | Requires display server; not available headless |

### Key notes

- **No linter configured.** There is no ESLint/Prettier setup; skip lint steps.
- **No lockfile.** The repo has no `package-lock.json`; `npm install` generates one fresh each time.
- **Node.js >=22.12 required** (specified in `package.json` engines).
- **Web app is pure static files** — serve `markdown-viewer/` with any HTTP server (e.g. `python3 -m http.server 8000`). No bundler or build step.
- **Electron desktop app** cannot run in headless Cloud Agent environments (needs a display). Test the shared `markdown-viewer/` code via Jest or the static HTTP server instead.
- **Coverage thresholds** are not enforced via config, but `npm run test:coverage` will show coverage percentages.
- To test markdown rendering interactively, inject markdown via JS in the browser console (simulate drag-and-drop with `DragEvent` + `DataTransfer` on `#drop-zone`).
