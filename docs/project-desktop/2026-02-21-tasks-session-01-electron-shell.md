# Session 1 Tasks: Electron Shell + Dev Loop

## Current State
- Working web app in `markdown-viewer/` (app.js, index.html, styles.css, vendor/)
- Existing Jest test suite (unit + integration) in `tests/`
- No desktop code exists — no Electron, no `desktop/` directory
- Development progression: **Environment setup** — proving Electron works with the existing code

## Goal
Get the existing Specdown web app running inside an Electron window with a working dev loop (`npm run desktop` to launch, `npm test` still passes). No new features yet — just prove the shell works.

---

## Tasks

### 1. Install Electron and tooling
**Who:** AI coding agent
- `npm install --save-dev electron`
- `npm install --save-dev electron-builder` (for future DMG packaging)
- `npm install electron-store` (will need soon for persistence)
- Add npm scripts to `package.json`:
  - `"desktop"` — launches the Electron app in dev mode
  - `"desktop:build"` — placeholder for future packaging (can be a no-op for now)
- Verify `npm test` still passes after dependency changes

### 2. Create `desktop/main.js` — minimal Electron main process
**Who:** AI coding agent
- Create `desktop/` directory
- Write `main.js` with:
  - `BrowserWindow` that loads `markdown-viewer/index.html`
  - Sensible default window size (1200x800)
  - Window title: "Specdown Desktop"
  - Basic app lifecycle (ready, window-all-closed, activate)
  - DevTools disabled by default (can enable with flag later)
- Keep it minimal — no menus, no IPC, no persistence yet

### 3. Create `desktop/preload.js` — empty bridge
**Who:** AI coding agent
- Create a stub `preload.js` that will later expose IPC APIs to the renderer
- For now, it just exists so the main process can reference it and the architecture is in place
- Wire it into `BrowserWindow` webPreferences

### 4. Set up DMG packaging and GitHub Releases distribution
**Who:** AI coding agent
- Configure `electron-builder` in `package.json` for macOS DMG packaging:
  - App name: "Specdown Desktop"
  - Bundle ID (e.g. `com.specdown.desktop`)
  - Set `markdown-viewer/` and `desktop/` as included files
  - Target: `dmg` for macOS
  - No code signing or notarization (internal use — users bypass Gatekeeper via right-click > Open)
- Wire the `"desktop:build"` npm script to `electron-builder` (currently a no-op placeholder)
- Create `.github/workflows/desktop.yml` GitHub Actions workflow:
  - Trigger: tag push (e.g. `v*`) or manual `workflow_dispatch`
  - Runs on `macos-latest`
  - Steps: checkout, `npm install`, `npm run desktop:build`, upload `.dmg` to GitHub Release
  - Attach the built `.dmg` as a release asset
- Update README with download instructions:
  - "Download the latest `.dmg` from GitHub Releases"
  - Note: unsigned app — right-click > Open on first launch
- Verify the workflow file is valid YAML and references correct paths

**Definition of done:**
- `npm run desktop:build` produces a `.dmg` file (requires macOS runner)
- `.github/workflows/desktop.yml` exists and is valid
- README documents how to download and install the desktop app

### 5. Verify the desktop app works on macOS
**Who:** Human developer (on a Mac)
- **Prerequisite:** Task 4 must be complete — a `.dmg` must be available from GitHub Releases
- Download the `.dmg` from the GitHub Releases page
- Open the `.dmg` and drag Specdown Desktop to Applications
- First launch: right-click > Open to bypass Gatekeeper (unsigned app)
- Manual verification checklist:
  - [ ] App launches and window opens with "Specdown Desktop" title
  - [ ] Drop zone / file picker UI appears
  - [ ] Drag-and-drop a `.md` file — renders correctly
  - [ ] Mermaid diagrams render with zoom/pan/fullscreen controls
  - [ ] Light/dark theme toggle works
  - [ ] Raw/preview toggle works
  - [ ] Syntax highlighting works in code blocks
- Report any rendering differences vs. the browser version

### 6. Verify existing tests still pass
**Who:** AI coding agent
- Run `npm test` — all existing Jest tests must pass
- Run `npm run test:coverage` — coverage thresholds must still be met
- No test modifications should be needed (Electron deps shouldn't affect jsdom tests)

### 7. Fix SPEC.md repo layout
**Who:** AI coding agent
- The SPEC.md currently shows `index.html`, `app.js`, `styles.css` at the repo root, but they actually live in `markdown-viewer/`
- Update the repo layout diagram and any references to match reality:
  ```
  specdown/
  ├── markdown-viewer/       ← existing web app
  │   ├── index.html
  │   ├── app.js
  │   ├── styles.css
  │   └── vendor/
  ├── desktop/               ← NEW: Electron-specific
  │   ├── main.js
  │   ├── preload.js
  │   └── icons/
  ├── tests/
  ├── package.json
  └── ...
  ```
- Also update any architecture text that says "shared `index.html`, `app.js`, `styles.css`" to reference `markdown-viewer/` paths

### 8. Update SPEC.md and README based on session results
**Who:** AI coding agent
- Add a "Development" section to README with:
  - `npm run desktop` — how to launch the desktop app
  - `npm test` — how to run tests (already documented, just confirm)
- Update SPEC.md "Current Spec" timestamp
- Note in SPEC.md which features are now implemented (Electron shell, dev loop) vs. pending

---

## Definition of Done
- `desktop/main.js` and `desktop/preload.js` exist
- `npm run desktop:build` produces a `.dmg` via `electron-builder`
- `.github/workflows/desktop.yml` publishes the `.dmg` to GitHub Releases
- Human developer can download the `.dmg`, install, and launch Specdown Desktop
- All existing `npm test` tests pass with no modifications
- SPEC.md repo layout matches the actual directory structure
- README has instructions for both downloading the app and running from source

## What This Unblocks
- Session 2 can build on a working Electron shell to add native file open (`Cmd+O`), IPC bridge, and basic menus
- Human developer can start manually testing with real markdown files on macOS

---

## Notes
- **Important:** Development happens in Claude Code cloud (Linux, no GUI). The AI agent handles tasks 1–4, 6–8. Task 5 (manual verification) requires a human on macOS with the `.dmg` from GitHub Releases.
- The AI agent should not modify `markdown-viewer/app.js`, `styles.css`, or `index.html` in this session. The goal is to wrap the existing code, not change it.
- If Electron's content security policy blocks loading vendored libraries from local files, the main process may need to configure appropriate CSP headers. Flag this if it happens rather than making sweeping changes.
