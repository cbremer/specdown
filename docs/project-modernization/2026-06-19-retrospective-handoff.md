# Retrospective & Handoff — Cross-Platform Modernization

**Date:** 2026-06-19
**Type:** retrospective (learnings, process, what's next)
**Scope:** the modernization arc (v0.0.82 → v0.0.141), Phases 0–4 + the post-roadmap bug/UX/iOS work.

This is the closing document for the modernization thread. The phased roadmap is
**done**; this captures what we learned doing it so the next person (human or
agent) starts ahead, not from scratch.

---

## 1. Where we ended up

**Phases 0–4 complete.** Vite/ESM build, the `main.js` monolith split into
`core`/`features`/`platform`, lazy-loaded Mermaid, **100% gradual TypeScript**
(`checkJs`), design tokens + accessibility, command palette, PWA, **signed +
notarized universal macOS DMG** + Windows/Linux lanes, an automated
changelog/release pipeline, and the Phase-4 differentiators (presentation mode,
recent files, session restore, **annotations 2.0**, **workspace/folder mode**).
Test suite grew from ~297 → **448+**; all four gates (`build`/`lint`/`typecheck`/
`test`) green and enforced in CI.

**The one genuinely unbuilt item:** **iOS/iPadOS public distribution**
(TestFlight/App Store). It's fully scoped in
[`2026-06-16-spec-ios-distribution.md`](2026-06-16-spec-ios-distribution.md) —
that's the obvious next project.

---

## 2. Hard-won learnings (the ones that bit us)

### Process — the **stranded-commit** trap (our #1 recurring pain)
A two-commit PR merged with **"Squash and merge"** — or merged *before* the
second commit finished pushing — strands the trailing commit: it never reaches
`main`. This happened **4+ times** this arc (universal build, annotations
editor+panel, the comments iOS wiring, …) and each cost a recovery cycle
(re-PR'ing the orphan). **Rules that prevent it:**
- **One logical change = one commit** per PR where practical.
- If multiple commits, **"Rebase and merge"** (or "Create a merge commit"), never
  squash, and **wait for "all checks passed" before merging**.
- Don't push follow-up commits to a branch whose PR is about to be / already
  merged — open a fresh PR off `main` instead.

### Tests can hide production bugs — **mocks that are too forgiving**
The harness's **DOMPurify mock is a passthrough that strips nothing**, so it
*masked* the real bug where production DOMPurify drops HTML comments before the
"reveal comments" code runs. Lesson: when a feature depends on a library's
*sanitizing/transforming* behavior, a passthrough mock gives false confidence —
test the real behavior (or at least don't trust green tests as proof the
production path works).

### One shared app, but **surfacing is per-surface**
`markdown-viewer/` is loaded by web, desktop, and iOS, so a fix to shared code
reaches all three automatically. **But** the iPhone layout hides the desktop
toolbar (`.content-header-actions`) in favor of the bottom action sheet, so any
new toolbar control must be **explicitly wired into the iOS sheet** to be
reachable on iPhone (iPad keeps the toolbar). "It works everywhere" ≠ "it's
reachable everywhere."

### Native shells don't implement web dialogs
**Both Electron and iOS WKWebView ignore `window.prompt()`** (and `alert`) by
default — desktop annotation editing silently did nothing for this reason. Use
**in-app modals**, never native `prompt`/`alert`, for any cross-surface UI.

### The agent's blind spots are real
From the repo + CI I can see **source and build output**, so code-level issues
(e.g. the iPad `UIPrintInteractionController` bug) are findable by reading. I
**cannot** see **Xcode IDE prompts** ("validate settings") or **device runtime
logs** ("could not create a sandbox extension") — those are local-only. Also our
iOS CI pipes through `xcpretty` and **doesn't surface Swift warnings**, so even
CI hid that one. Implication: the user must surface IDE/device-only signals, and
we should consider making CI louder (see §3).

### Platform packaging gotchas (now encoded in the workflows/docs)
- macOS signing needs a **Developer ID Application** cert (not *Installer*, not
  *Apple Development*); `mac.notarize` is a **boolean**; notarization queue time
  is **Apple-side and variable** (5–40 min) — a long wait is usually *not* a
  failure.
- A **universal** mac build needs the `--universal` **CLI flag** in the workflow;
  an `arch` in `package.json` is overridden by the workflow's `--mac dmg`.
- iOS has **no auto-update channel** — fixes reach the app only on a fresh
  from-source Xcode build.

### The portability seam paid off
Consolidating every renderer→shell call behind **`window.specdown`**
(`platform/bridge.js`) made desktop features easy to reason about and is what
keeps a future Tauri/web-FS swap a one-module change. Keep it the *only* shell
coupling.

---

## 3. Skills / tooling worth building

These are the repetitive, mechanical things that ate time and are good
candidates for a Claude Code **skill** or a CI tweak:

1. **`rebase-open-prs`** — detect branches behind `main`, rebase, re-run the
   gate, force-push, and update the PR. We did this by hand many times.
2. **`ship-feature-pr`** — run the full gate (`build`/`lint`/`typecheck`/`test`),
   create the branch off `main`, commit with the required footer, open the PR
   with the standard body template. Encodes the project's commit/PR conventions.
3. **Recover a stranded commit** — given a merged PR that dropped a trailing
   commit, branch off `main`, cherry-pick the orphan, re-PR. (We ran this play
   ~4 times; it's mechanical.)
4. **CI: surface Swift warnings** — drop `| xcpretty` on the iOS build step (or
   add a warnings summary / `-warnings-as-errors` selectively) so issues like the
   `presenter` unused-binding are caught in CI, not in the user's Xcode.
5. **Adopt Conventional-Commit subjects** — the changelog generator already
   groups by `feat:`/`fix:`/… but we write descriptive subjects, so it always
   falls back to a flat list. A commit-lint hook (or just discipline) would light
   up the grouped changelog/release notes for free.

---

## 4. Features that come next (by value)

- **iOS TestFlight release lane** — the headline gap; fully scoped. Needs an App
  Store Connect record + API key + a tag-triggered `ios-release.yml`. Highest
  value because it unblocks real iOS distribution.
- **Desktop auto-update** — `electron-updater` against the GitHub Releases we
  already publish; turns the signed DMG into a self-updating app.
- **Annotation robustness** — annotations anchor by **positional block index**,
  which drifts if the document is edited/reordered. Anchoring by heading-path or
  content hash would make them durable. (Plus optional cloud sync.)
- **"Open in SpecDown" from the OS share sheet / Open-With** — register the app
  as a handler for `.md`/`.markdown` (and `text/markdown`) so a markdown file in
  another app can be opened straight into SpecDown.
  - **iOS/iPadOS:** declare a document type / `CFBundleDocumentTypes` (+ UTI) and
    a Share Extension (or `LSSupportsOpeningDocumentsInPlace`) in the app target;
    the native shell hands the file to the web app via the existing
    `window.specdown`-style bridge / `loadFileContent`. Pairs naturally with the
    iOS distribution work (the app has to be installed to appear in the sheet).
  - **macOS (desktop):** the Electron app already handles Finder `open-file`;
    declaring `.md` document types in `electron-builder` (`mac.extendInfo`
    `CFBundleDocumentTypes` / `fileAssociations`) makes "Open With → SpecDown"
    and double-click-to-open work.
  - **Web:** a PWA `share_target` in the manifest lets an installed PWA receive
    shared files on supported platforms (Android/Chromium).
- **Workspace polish** — persist/reopen the last workspace; search across a
  folder; drag-a-folder-to-open on the web.
- **Conventional-commit changelog** — see §3.5; small, unlocks nicer release
  notes.

---

## 5. Doc changes made alongside this retrospective

- **`CLAUDE.md`** — added a **"Hard-won learnings & gotchas"** section (the §2
  items distilled) and a **merge-discipline** note under Git conventions.
- **`AGENTS.md`** — added the merge-discipline pointer + a link to the gotchas so
  any agent reads them before opening PRs.
- **`docs/project-modernization/README.md`** — status flipped to **complete**;
  this doc added to the timeline.
- The user-facing **root `README.md`** was already rewritten earlier in the arc.

> Convention reminder kept current: per-session task docs live under
> `docs/project-modernization/YYYY-MM-DD-tasks-session-NN-*.md`; this file is the
> durable resume point alongside `2026-06-14-handoff-next-wave.md`.
