# Tasks — Session 28: Live-Reload UX + macOS Release Guard

**Date:** 2026-07-15
**Scope:** Owner feedback: "the watch feature isn't intuitive — when it's
watching, when I want to stop, how to refresh." Root cause: the Wave B
toolbar consolidation moved the Watch button into the hidden `overflow-only`
set, so the only state indicator AND the reload pulse lived on an invisible
button; the only reachable control was a stateless menu item. There was no
manual refresh at all.

## Design principle

**Live reload is status, not a setting.** State belongs next to the thing it
describes (the document), always visible, with pause/resume on the indicator
itself — not an action buried in a toolbar menu.

## Checklist

- [x] **"Live" chip beside the filename** (`#watch-toggle`, restyled) —
      green dot + "Live" while auto-reloading, grey "Paused" when stopped;
      the chip itself is the pause/resume toggle, with explanatory tooltips.
      Hidden for tabs without a file path and off-desktop.
- [x] **Visible reload feedback** — the chip flashes and swaps to "Updated"
      for ~1.2s when a disk change lands (the old pulse, relocated from the
      hidden button to visible DOM).
- [x] **Manual "Reload from disk"** — new `refresh-file` IPC (main process
      re-reads and replies over the existing `file-changed` channel, so the
      tab updates in place with scroll preserved). Surfaced in the ⋮ overflow
      menu and the command palette; both gated on a desktop file-backed tab.
- [x] **Palette: "Pause / resume live reload"** — keyboard-first control of
      the chip's toggle.
- [x] **Overflow menu learns run-entries** — actions with `run` +
      `isAvailable` callbacks alongside the existing button proxies (first
      consumer: Reload from disk).
- [x] **Auto-watch remains the default** for desktop file tabs — matches
      modern editor expectations; the chip makes the default legible.
- [x] **macOS release-lane guard** (`desktop.yml`) — on `failure()`, a
      pinned github-script step files (or comments on) a
      `macos-release-failure` issue with the run link and the
      agreement-expiry playbook, so the next notarization outage is visible
      without reading Actions logs. Job granted `issues: write`.

## Verification

`npm test` — **495 passing** (+7: chip states ×3, refresh ×2, overflow
gating/no-watch-entry ×2). Lint 0/0 (enforced), typecheck clean, build green.
