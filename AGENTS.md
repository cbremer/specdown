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
| Web app (dev) | `npm run dev` | Vite dev server with hot reload |
| Web app (build) | `npm run build` | Vite build → `markdown-viewer/dist/`; `npm run preview` serves it |
| Tests | `npm test` | Jest with jsdom; full suite runs in ~4s |
| Lint | `npm run lint` | ESLint flat config (`eslint.config.js`); must be clean |
| Format | `npm run format` / `npm run format:check` | Prettier |
| Desktop (Electron) | `npm run desktop` | Builds web app then launches Electron; needs a display |

### Key notes

- **Vite + ES-module build.** The shared web app's source is ESM under
  `markdown-viewer/src/`; libraries (marked, mermaid, panzoom, highlight.js,
  DOMPurify) are real npm imports bundled by Vite. All three surfaces load the
  build output in `markdown-viewer/dist/`, so `npm run build` must run before
  packaging desktop or iOS. `dist/` is git-ignored and built in CI.
- **ESLint + Prettier are configured** (`eslint.config.js`, `.prettierrc.json`).
  `npm run lint` must be clean; it runs in CI alongside the tests
  (`.github/workflows/ci.yml`). A repo-wide Prettier reformat of the legacy
  `main.js`/`styles.css` is intentionally deferred to the upcoming internal
  module split to avoid churn — see `docs/project-modernization/`.
- **Lockfile committed.** `package-lock.json` is committed; CI uses `npm ci`.
  Use `npm install` locally when adding/upgrading dependencies.
- **Node.js >=22.12 required** (specified in `package.json` engines).
- **Electron desktop app** cannot run in headless Cloud Agent environments (needs a display). Test the shared viewer code via Jest, or `npm run dev` / `npm run preview` in a browser.
- **Coverage thresholds** are not enforced via config, but `npm run test:coverage` will show coverage percentages.
- To test markdown rendering interactively, inject markdown via JS in the browser console (simulate drag-and-drop with `DragEvent` + `DataTransfer` on `#drop-zone`).
