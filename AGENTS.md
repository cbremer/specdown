# Agent instructions

This project keeps its primary agent instructions in `CLAUDE.md`.
When working with this repo, read and follow `CLAUDE.md` for:
- Project overview and goals
- Commands and scripts
- Coding, testing, and documentation conventions
- **Merge discipline** and the **"Hard-won learnings & gotchas"** section — read
  these before opening PRs or touching the render path / tests / native shells.
  (One logical change = one commit per PR; "Rebase and merge", not squash, to
  avoid stranding trailing commits.) Deeper context:
  `docs/project-modernization/2026-06-19-retrospective-handoff.md`.

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
  `npm run lint` runs with `--max-warnings=0` in CI (`.github/workflows/ci.yml`),
  so warnings fail the build — keep it at zero. A whole-file Prettier reformat
  of `markdown-viewer/styles.css` (still not Prettier-conforming) is
  intentionally avoided: it would bury real changes in ~1,700 lines of
  formatting noise. Format only the files you touch.
- **Lockfile committed.** `package-lock.json` is committed; CI uses `npm ci`.
  Use `npm install` locally when adding/upgrading dependencies.
- **Node.js >=22.12 required** (specified in `package.json` engines).
- **Electron desktop app** cannot run in headless Cloud Agent environments (needs a display). Test the shared viewer code via Jest, or `npm run dev` / `npm run preview` in a browser.
- **Coverage thresholds**: a hard `coverageThreshold` is enforced for
  `desktop/main.js` — the only file the tests both instrument and actually
  exercise (other globs in `collectCoverageFrom`, like `desktop/preload.js`,
  are collected but never required by tests). Renderer modules
  under `markdown-viewer/src/` report ~0% because `tests/helpers/loadApp.js`
  evals the module graph outside Jest's instrumentation — don't trust those
  numbers or add renderer thresholds (see CLAUDE.md).
- To test markdown rendering interactively, inject markdown via JS in the browser console (simulate drag-and-drop with `DragEvent` + `DataTransfer` on `#drop-zone`).
