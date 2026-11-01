# Session 24 — Presentation focus ownership

Date: 2026-10-31. Base: `91d03967a4a4d94d56e4cc1409c9862435dac7cd`
(draft #335). Review branch: `codex/presentation-focus-ownership`.
Working source remains under
`/Users/chrisbremer/code/specdown/.claude/worktrees/specdown-presentation-focus-20261031`.

## Problem and correction

Session 23 left presentation-only Find outside its fullscreen correction. Find
could focus the document's hidden search field while presentation covered it.
Shift+Tab from the presentation container could escape into the background.
Closing presentation could refocus an old text field or steal focus from a newer
dialog. The presentation keyboard handler also consumed Space on a focused
button as "next slide", preventing the Exit button's normal keyboard activation.

The shared Find action now refuses all entry points while presentation is open,
including toolbar, shortcut, native menu and command-palette calls. Presentation
takes focus without scrolling. Tab and Shift+Tab enter through currently enabled
controls, and the existing focus trap handles wrapping as navigation buttons
become enabled or disabled. Space on a button keeps its native activation.

Closing removes the presentation's key listener and focus trap. It returns focus
only when presentation still owns it, using an available non-editable opener or
document content. It preserves focus in newer dialogs and does not reopen an
old text keyboard. The eligibility predicate is extracted unchanged from
Session 23's fullscreen implementation so both surfaces use the same rule.

No document-replacement lifecycle hook is introduced. Native Swift, viewport
settings, pan/zoom geometry, dependencies, version/build declarations, signing
and release workflows are unchanged.

## Verification

- Negative control on unchanged #335: **20 of 23 new cases fail**; three
  existing-behavior controls pass. Corrected focused suites pass **77 tests**.
- Full suite: **1,037 tests / 61 suites pass**, using `--roots ./tests` to
  exclude nested worktrees. Lint, typecheck and the production web build pass.
- Independent source/test review found no actionable issue. It covered the
  shared predicate's equivalence, local/shared Tab-handler order, disabled
  navigation, nested focus/Escape, restoration and listener cleanup.
- Real production-browser baseline at localhost:5210, exact #335: sample →
  presentation → Cmd+F focuses `search-input` while presentation remains open;
  Shift+Tab from the presentation container escapes to a background Copy code
  button. Space on focused Exit presentation advances to slide 2 of 10 and
  leaves the overlay open.
- Corrected production-browser verification passes: ordinary Find before/after
  presentation; focus transfer on opening; Cmd+F and palette Find remain inside
  presentation; initial Tab skips disabled Previous to Next; Shift+Tab enters
  Exit; wrapping works in both directions. Palette typing `+0-` preserves the
  exact SVG transform and slide counter. Palette/shortcuts Escape closes only
  the top surface. Space on Exit closes presentation and restores the Present
  button; Space on Next advances exactly one slide to 2 of 10. Find → palette
  Present → exit restores document content, not the input. Fullscreen still
  focuses its overlay on open and the diagram expand button on close.
  Screenshot: `browser-presentation.jpg` in the evidence directory below.

Complete local logs are retained at
`/Users/chrisbremer/code/specdown/ios/DerivedData/presentation-focus-20261031/`:
`negative.log`, `focused.log`, `full.log`, `lint.log`, `typecheck.log`, and
`build.log`. Existing harness listener warnings and negative Git-revision stderr
remain visible in the successful full-suite log. Build output retains its
existing large-chunk warning. These are not native device acceptance results.

## Separate candidates and remaining acceptance

The canonical owner phone checkout remains at `e7b842b`, iOS **1.0.1 (228)**.
This isolated correction has not been installed on that phone, added to the
retained archive packets, signed, uploaded or released. Browser and synthetic
DOM evidence does not identify the cause of the native keyboard coordinate
conversion warnings from Session 22.

Accepted document replacement can still retain an existing fullscreen or
presentation clone. That lifecycle correction remains a separate task requiring
the desktop refresh acceptance fix from #333 and review of preview/raw/empty
transitions, rejected inputs, stale async work and teardown focus ownership.
This session neither adds an inactive teardown helper nor claims that gap fixed.

Promoting a correction into the phone/TestFlight candidate requires review of
its exact head and checks. Owner signing, physical TestFlight acceptance, App
Review submission and public release remain separate gates. No native/device
actions, Apple account operations, signing, installation, upload, submission,
public deployment or release-authority merge occurred in this session.
