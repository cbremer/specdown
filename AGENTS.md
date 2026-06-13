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
| Tests | `npm test` | Jest with jsdom; full suite runs in ~4s |
| Lint | `npm run lint` | ESLint flat config (`eslint.config.js`); must be clean |
| Format | `npm run format` / `npm run format:check` | Prettier |
| Desktop (Electron) | `npm run desktop` | Requires display server; not available headless |

### Key notes

- **ESLint + Prettier are configured** (`eslint.config.js`, `.prettierrc.json`).
  `npm run lint` must be clean; it runs in CI alongside the tests
  (`.github/workflows/ci.yml`). A repo-wide Prettier reformat of the legacy
  `app.js`/`styles.css` monolith is intentionally deferred to the Phase 1 module
  split to avoid churn — see `docs/project-modernization/`.
- **Lockfile committed.** `package-lock.json` is committed; CI uses `npm ci`.
  Use `npm install` locally when adding/upgrading dependencies.
- **Node.js >=22.12 required** (specified in `package.json` engines).
- **Web app is pure static files** — serve `markdown-viewer/` with any HTTP server (e.g. `python3 -m http.server 8000`). No bundler or build step.
- **Electron desktop app** cannot run in headless Cloud Agent environments (needs a display). Test the shared `markdown-viewer/` code via Jest or the static HTTP server instead.
- **Coverage thresholds** are not enforced via config, but `npm run test:coverage` will show coverage percentages.
- To test markdown rendering interactively, inject markdown via JS in the browser console (simulate drag-and-drop with `DragEvent` + `DataTransfer` on `#drop-zone`).
