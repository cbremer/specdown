# Session 57: Chokidar 6 compatibility

Date: November 1, 2026

## Scope

Validate dependency PR #317 on the reviewed source after #354. The isolated
`codex/deps-chokidar6-validation` branch starts at `8cb1f243`, immediately above
`67d5db7`. Keep the canonical Store candidate and all retained build 230 artifacts
unchanged. No signing, native app launch, Apple account work or release is part
of this dependency change.

## Compatibility changes

Chokidar 6 rewrites the watcher implementation, requires Node 22.22 or later,
introduces `backend` and `pollingInterval`, and retains the previous option names
as deprecated aliases. Closed watcher instances cannot be reopened. See the
[official 6.0.0 release notes](https://github.com/paulmillr/chokidar/releases/tag/6.0.0).

- Set the declared Node floor to `>=22.22.0` in package metadata and current
  contributor instructions. All nine existing workflow setup steps now require
  `>=22.22.0 <23`; workflow permissions, event types and release behavior are preserved.
- Express the existing direct-desktop polling escape hatch using supported v6
  options. Parent-directory sharing, depth zero, write stabilization, grants and
  basename routing remain unchanged. Closing the last tab already discards the
  old watcher; reopening creates a new instance.
- Keep the MAS `fs.watchFile` implementation unchanged. It polls an authorized
  file, rather than requiring parent-directory sandbox access.
- Add `npm run test:watchers` to the existing unsigned desktop validation matrix
  before packaging; changes to the new helper also trigger that validation.
  This checks the real filesystem on macOS, Windows and Linux
  CI runners without giving that workflow signing or publishing authority.

The only lockfile package changes relative to `67d5db7` are the root metadata,
Chokidar 5.0.0 → 6.0.0 and readdirp 5.0.0 → 5.1.1. No app version changes.

## Validation

- Fresh `npm ci` installed physical, worktree-owned dependencies.
- Full coverage: **1,341 tests in 77 suites passed**, including the required
  desktop main-process coverage thresholds. Lint, typecheck and web build pass.
- The **110 generated web files match the canonical build 230 bytes**.
- Pinned Electron **44.10.1** reports embedded Node **24.22.1** and successfully
  imports Chokidar 6 in `ELECTRON_RUN_AS_NODE` mode. This dependency does not rely
  on a later Electron upgrade to meet its Node requirement.
- Real macOS filesystem checks pass in three modes: native Chokidar, explicit
  Chokidar polling and MAS-style host `fs.watchFile`. Twelve scenarios per mode
  cover grant denial, backend configuration, initial silence, in-place edits,
  three consecutive atomic replacements, deletion/recreation, moves, Close
  Folder preserving session/notes/watchers, unrelated/nested paths, shared
  subscriptions, immediate close/reopen and final cleanup. Actual native watcher
  errors fail the check. The test loads production main-process logic, grants
  and reads; Electron UI and native bookmark loading are replaced with inert
  test surfaces and only fresh synthetic files are accessed.

An initial sandboxed native watcher run failed with `EMFILE`; the unchanged
host-executed test passed. Both logs are retained. The Electron Node-mode probe
also emitted a macOS `task_name_for_pid` diagnostic, with exit zero and successful
module import. Neither observation establishes signed-app acceptance or a
provisioned MAS sandbox result.

Local evidence is retained under
`ios/DerivedData/dependency-validation-20261101/chokidar/`, including the input
provenance, full check logs, real watcher reports and independent review.
Windows/Linux matrix results and fresh exact-head GitHub checks remain merge
gates; local macOS success does not substitute for them. Store build 230 remains
frozen and its signing/TestFlight/owner-proof gates remain separate.
