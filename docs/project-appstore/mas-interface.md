# MAS interface: sandbox file-access contract (AS-021)

**Date:** 2026-10-12. **Status:** Spike complete; contract accepted for AS-022..026.
**Build under test:** Electron 44.0.0 MAS runtime (`electron-v44.0.0-mas-arm64.zip`,
SHA-256 `5df0d1fc…f5e6de4`, matches the release `SHASUMS256.txt`), hand-assembled
and signed with `Apple Development: CHRISTOPHER MANSFIELD BREMER (24XCA869SC)`,
macOS 27.0.1 (26A434) on an M1 (`Mac13,1`). Spike bundle ID
`com.mosaicpando.specdown.masspike` (kept separate so it never pollutes the real
container). Raw log and harness: shared session notes
`mas-spike-2026-10-12/` (`results.log`, `main.js`, `bookmarks.mm`, plists).

The spike app ran under App Sandbox (`process.mas === true`,
`APP_SANDBOX_CONTAINER_ID` set, `home`/`userData`/`temp` inside
`~/Library/Containers/<id>/Data`), and a read of `~/Documents` failed with
`EPERM`. Everything below was observed in that sandboxed process unless marked
**(manual QA pending)**.

## What was proven

| #   | Mechanism                                                                                                      | Result                                                                                                                                                                                 |
| --- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Network client (main `fetch` + renderer `fetch`) with `network.client`                                         | ✅ 200 from both processes                                                                                                                                                             |
| 2   | Ungranted file / folder read                                                                                   | ✅ fails fast with `EPERM` (sandbox enforces; no data leak)                                                                                                                            |
| 3   | Finder / LaunchServices open (`open -a App file.md` → `open-file`)                                             | ✅ that file becomes readable; its **parent folder and siblings stay `EPERM`**                                                                                                         |
| 4   | Finder open of a **folder** (also the drag-to-Dock / folder-drop path)                                         | ✅ recursive read of the whole tree (`ws/sub/b.md`)                                                                                                                                    |
| 5   | Grant lifetime                                                                                                 | ✅ ends at quit: after relaunch the same path is `EPERM` again → persistence needs bookmarks                                                                                           |
| 6   | Native security-scoped bookmark (`NSURL bookmarkDataWithOptions:WithSecurityScope`) via a ~40-line N-API addon | ✅ created only while a grant is live (fails with "Could not open() the item" otherwise — cannot be used to escalate)                                                                  |
| 7   | Bookmark → relaunch → `app.startAccessingSecurityScopedResource(b64)`                                          | ✅ file and folder readable; calling the returned `stop()` revokes access immediately (`EPERM`)                                                                                        |
| 8   | Moved/renamed file (app closed)                                                                                | ✅ native resolve returns the **new path** and `stale: true`                                                                                                                           |
| 9   | ⚠️ Electron `startAccessingSecurityScopedResource` with a **stale** bookmark                                   | Returns a function and **throws nothing**, but grants nothing (read stays `EPERM`). Never treat its return value as success.                                                           |
| 10  | Parent-directory chokidar watch (today's direct-channel mechanism) on a file grant                             | ❌ `EPERM: watch '<dir>'` → live reload silently dead                                                                                                                                  |
| 11  | `fs.watch(file)`                                                                                               | ⚠️ survives in-place saves, dies after the first atomic rename                                                                                                                         |
| 12  | chokidar single-file watch                                                                                     | ⚠️ survives atomic saves, but after delete it tries the parent dir (`EPERM`) and never sees a re-create                                                                                |
| 13  | `fs.watchFile` (stat polling) on the granted path                                                              | ✅ in-place save, atomic save ×2 (inode change), delete (ENOENT) and re-create at the same path all observed and re-read; the grant is path-based so the replaced inode stays readable |
| 14  | chokidar dir watch **inside a held folder grant**                                                              | ✅ incl. atomic save; after `stop()` the watcher reports a false `unlink` → access must be held for as long as a watch exists                                                          |
| 15  | Offscreen `BrowserWindow` + temp HTML in container `tmp/` + `printToPDF`                                       | ✅ valid `%PDF-` written                                                                                                                                                               |
| 16  | `app.addRecentDocument`                                                                                        | ✅ no error                                                                                                                                                                            |
| 17  | Touching the parent folder of a granted file inside **`~/Documents`**                                          | ❌ **hangs the main thread** inside `open()` (TCC privacy wait) instead of failing. Never probe paths without a grant.                                                                 |

**Manual QA pending** (needs a human at the Mac; computer control was declined
for this session): `dialog.showOpenDialog({ securityScopedBookmarks: true })`
bookmarks, `showSaveDialog` write + `shell.showItemInFolder`, the visible print
sheet (needs `com.apple.security.print`), drag-and-drop (drop grants an
extension to the main process, same class as row 3), system Open Recent, and the
same checks in the electron-builder `mas-dev` build. These are listed in the
QA checklist at the end of the tasks file for this session.

## Contract

### Channels

`desktop/distribution.js` decides the channel once: `mas` when
`process.mas === true`, otherwise `direct`. Everything below applies only to
`mas`; the direct (Developer ID DMG/ZIP) channel keeps raw paths, chokidar
parent-dir watching and electron-updater exactly as before.

### Access service (`desktop/mas-access.js`)

One object with the same interface on both channels, so `main.js` calls it
unconditionally:

| Method                                        | Direct channel  | MAS channel                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `noteUserIntent(path, kind, dialogBookmark?)` | no-op           | Called only on user-intent routes (open/folder/CSS picker results, `open-file`, dropped paths, paths from `webUtils.getPathForFile`). Marks the path as granted for this session and persists a bookmark (dialog bookmark if given, else native `createBookmark`).                                                                                                                               |
| `withAccess(path, fn)`                        | runs `fn(path)` | Finds the exact file grant or the nearest granted ancestor folder; starts access, runs `fn(resolvedPath)`, stops access (balanced, `finally`). If the bookmark resolved elsewhere (moved file) it re-keys the grant and refreshes the bookmark. Session-only grants (no bookmark) run `fn` directly. **No grant → returns `{ ok: false, reason: 'no-grant' }` without touching the filesystem.** |
| `hold(path)`                                  | no-op release   | Same lookup, but keeps access started until `release()` — used by watchers. Ref-counted per grant.                                                                                                                                                                                                                                                                                               |
| `forget(path)`                                | no-op           | Drops a grant (e.g. Clear Custom Theme).                                                                                                                                                                                                                                                                                                                                                         |

Access start/stop prefers the native module (`startAccess(b64) → { id, path,
stale, ok }`, `stopAccess(id)`), because it reports the resolved path and works
with stale bookmarks. If the native module fails to load, the service falls
back to Electron's `startAccessingSecurityScopedResource` for dialog bookmarks
and verifies access with an `fs.access` check (row 9).

### Native module (`desktop/native/mas-bookmarks/`)

Objective-C++ N-API addon, Foundation only, no third-party code:
`createBookmark(path)`, `startAccess(b64)`, `stopAccess(id)`. Built only for MAS
packaging by `scripts/build-mas-native.js` (arm64 + x64 via node-gyp, then
`lipo` → one universal `.node`), unpacked from asar (`**/*.node` is already in
`asarUnpack`). The direct channel never loads it. Node-API is ABI-stable, so it
does not need rebuilding per Electron patch release.

### Storage and migration

`specdown-state.json` (inside the container) gains:

```json
"masGrants": {
  "version": 1,
  "entries": {
    "/Users/me/notes/plan.md": { "kind": "file", "bookmark": "<base64>", "savedAt": 1791854598167 },
    "/Users/me/notes/wiki":    { "kind": "folder", "bookmark": "<base64>", "savedAt": 1791854598167 }
  }
}
```

Raw paths elsewhere in state (recents, session tabs, custom CSS path, renderer
bookmarks/recents in localStorage) stay as **identifiers only** — they never
authorize access. Access is authorized solely by a matching `masGrants` entry.

Migration: a MAS install cannot read the direct-download app's state at all (a
different, unsandboxed `~/Library/Application Support/Specdown Desktop/`), so
there is no cross-channel import and nothing to leak. Within the container, any
raw path without a grant (older MAS state, a corrupt grant store, a grant whose
bookmark no longer resolves) is treated as **needs access**: it is shown, never
probed. Unknown `masGrants.version` or malformed entries are ignored (not
deleted) so a downgrade cannot destroy grants. Grants are capped (200 most
recent) so the store cannot grow without bound.

### Watching (MAS)

`watch-file` holds access for the file's grant and polls it with
`fs.watchFile` (1 s interval); a change in `mtimeMs`, `size` or `ino` re-reads
and sends `file-changed`. `unwatch-file` stops polling and releases the hold.
No parent-directory watch, ever (rows 10, 17).

### Workspaces, relative links, custom CSS

- Open Folder uses `openDirectory` + `securityScopedBookmarks: true` and records
  a **folder** grant; the scan runs inside `withAccess(root)`.
- Relative-link navigation keeps the existing workspace containment check, then
  opens through `withAccess`, which finds the folder grant. A link outside every
  granted folder is blocked twice (containment + sandbox).
- Custom CSS: the picker records a file grant; restore at launch reads through
  `withAccess`; Clear Custom Theme forgets the grant.

### Print and PDF

Unchanged code paths: print stays in the visible window (CLAUDE.md gotcha);
PDF export stages HTML in `app.getPath('temp')` (the container `tmp/`, proven)
and writes to the path the save panel returns (the panel grants write access).
Requires the `com.apple.security.print` entitlement for the print sheet.

### Updates and network

MAS: electron-updater is never required, no update check, no
"Check for Updates…" menu item, `restart-to-update` is ignored, and the renderer
GitHub release poll is skipped (bridge exposes `distribution: 'mas'`). The only
network traffic is what a document asks for (remote images, URL/GitHub opens the
user initiates), consistent with the "Data Not Collected" label.

### Recovery UX

When a by-path open (recents, session restore, menu Open Recent, bookmarks)
has no usable grant, main sends `file-access-needed { filePath, filename }`.
The renderer shows a warning toast "SpecDown needs permission to open
“plan.md”." with a **Locate…** action → `requestGrantAccess(filePath)` → an open
panel pre-pointed at the old location with the message "Select “plan.md” to
give SpecDown access again." The chosen file is granted and opened. A moved
file with a valid bookmark opens from its new location without any prompt.
Renderer bookmarks keep their existing "Locate file" flow; the path it returns
comes from `webUtils.getPathForFile`, which the preload reports as user intent so
the new location is granted too.

## Entitlements (justification)

Parent (`build/entitlements.mas.plist`):

| Entitlement                                                                     | Why                                                                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `com.apple.security.app-sandbox`                                                | Required for the Mac App Store.                                                                                                       |
| `com.apple.security.files.user-selected.read-write`                             | Open/Save panels, drag-and-drop, Finder opens; write is needed for Export as PDF.                                                     |
| `com.apple.security.files.bookmarks.app-scope`                                  | Persist grants across launches (rows 6–8).                                                                                            |
| `com.apple.security.network.client`                                             | Remote images and documents the user opens by URL/GitHub.                                                                             |
| `com.apple.security.print`                                                      | Native print sheet.                                                                                                                   |
| `com.apple.security.application-groups` = `582YQWPT9G.com.mosaicpando.specdown` | Required by Electron's MAS runtime for Chromium's shared-memory/Mach-port names (`ElectronTeamID`); inserted by `@electron/osx-sign`. |

No hardened-runtime (`com.apple.security.cs.*`) entitlements: MAS builds are not hardened-runtime signed, and the spike ran V8/JIT without them.

Helpers (`build/entitlements.mas.inherit.plist`): `app-sandbox` + `inherit`
only. Not requested: camera, microphone, location, contacts, downloads folder,
network server, Apple Events, and every `files.*` entitlement beyond
user-selected.

## Alternatives considered

- **Electron-only (no native module):** dialog bookmarks work, but files opened
  from Finder or by drag-and-drop could not be persisted (Electron has no API to
  bookmark a path) and moved files could not be followed (row 9). Session
  restore and recents would prompt for every Finder-opened file after each
  relaunch. Rejected: double-click in Finder is the main way people open `.md`
  files.
- **Watch the parent folder after asking for it:** would prompt for folder
  access on every single-file open and can hang on TCC folders (row 17).
  Rejected in favour of polling the granted path.
- **`com.apple.security.temporary-exception.files.home-relative-path.read-only`:**
  App Review routinely rejects broad temporary exceptions. Not used.
