# Session 27 — Accepted-view diagram overlay lifecycle

Date: 2026-10-31. Base: `1392e517f888feb91300e58a072b3334d45b1477`
(integrated review, draft #338). Branch: `codex/accepted-view-overlay-lifecycle`.
Source worktree:
`/Users/chrisbremer/code/specdown/.claude/worktrees/specdown-accepted-overlay-20261031`.

## Acceptance boundary and correction

The integrated baseline includes desktop refresh prevalidation and both diagram
focus corrections. Accepted document/view replacement could nevertheless leave
the old fullscreen or presentation clone above the replacement content.
Closing and reopening presentation also left detached old button/wheel
callbacks able to operate on the new instance.

The existing document-context invalidation boundary now invokes a configured
synchronous cleanup callback immediately after advancing its generation. Main
configures the callback; the core module imports no features. The six existing
invalidation call sites and their context semantics remain unchanged:

- Preview rendering, after document preparation succeeds.
- Preview to Raw.
- Switching to a raw tab.
- Closing the active tab and selecting a raw replacement.
- Empty/drop-zone reset.
- Active raw desktop refresh, after the integrated desktop preflight.

Preview opens, switches, closes and refreshes share the first path. Cleanup
closes both diagram surfaces with opener restoration disabled. It snapshots
focus ownership before closing either surface and blurs only a still-active
owned focus target. A newer palette/sheet retains its focus and draft. The
redundant fullscreen close in drop-zone cleanup is removed.

Rejected preparation, tab-cap refusal, background-only refresh, inactive tab
close and no-op same-tab selection never reach this cleanup. Resize and
theme-only rerender retain their existing behavior. Cleanup does not run after
an asynchronous render finishes, so late old work cannot close a new instance.

Presentation button and wheel callbacks now belong to their creating overlay
instance. Independent review also found a desktop/web minimap callback that
could repaint a reused canvas after its fullscreen had closed. Each minimap
raster request now returns a disposer wired into fullscreen cleanup. Disposal
clears image handlers and revokes its object URL once; retained success/error
callbacks become inert. Normal raster drawing and pan/zoom geometry are
unchanged. This is why the fix also touches the minimap/fullscreen modules.

## Validation

- Author negative control on exact `1392e51`: **25 failures / 14 passing
  preservation controls**, across 39 cases. The baseline stayed clean; an
  evidence copy changes only the test's helper import to the exact baseline
  helper path. Its command and hashes are recorded in
  `author-negative-provenance.json`.
- Corrected author-focused run: **121 tests pass**. The fixture uses normal
  desktop detection and explicitly synthetic post-sanitization Mermaid output;
  it does not stand in for native iOS behavior.
- Separate reviewer suite: **49 cases pass** on the candidate, versus
  **34 failures / 15 passing controls** on the same committed baseline. It
  exercises public transitions, rejection/background preservation, stale
  render completion, newer dialog drafts, detached controls and deferred
  minimap success/error after replacement or ordinary close/reopen.
- Full CI-style coverage run: **1,128 tests / 67 suites pass**, including
  required desktop coverage gates. Lint, typecheck and diff checks pass; the
  production web build completes with 110 output files.
- Independent source review found no blocking issue in all six changed
  production files, including cleanup order, focus ownership, context return
  semantics, per-instance handlers and URL release.
- Production-browser baseline confirms both old diagram surfaces remain over
  Raw after the palette's Toggle raw / preview command. On the exact frozen
  candidate build, the same fullscreen and presentation transitions close both
  surfaces, display Raw and release focus to the body; no old fullscreen SVG
  remains.
- From presentation, the palette's Open file command rejects an **8 MiB + 1
  byte** synthetic file while preserving the original showcase, slide 1 of 10,
  presentation focus and a visible warning. The same flow with `accepted-b.md`
  replaces the title and content with Accepted B, closes both old surfaces and
  releases focus to the body.
- Reopening B's fullscreen at a **440 × 956 browser viewport** and pressing zoom
  in keeps the SVG centered (measured center deltas: x `0.000006` px,
  y `-0.097626` px). Normal exit restores the diagram-expand button and retains
  B's content. These are production-browser checks, not a native phone run.

Complete logs, source/build hashes and reviewer evidence live under
`/Users/chrisbremer/code/specdown/ios/DerivedData/accepted-overlay-lifecycle-20261031/`.
The initial author fixture failure is retained separately and is not counted
as a product-negative result. Existing harness listener warnings, negative
Git-revision stderr and Vite's large-chunk warning remain visible in logs.
`browser-candidate.json`, `browser-accepted-document.jpg` and
`browser-phone-centered.jpg` record the corrected browser checks. The temporary
dependency symlink was removed after validation; the shared dependency directory
was not changed.

## Candidate and release boundaries

This is one lifecycle correction atop the exact committed integration baseline.
It does not change native Swift/Electron code, dependency versions, document
identity/storage policy, pan/zoom geometry, version/build declarations, signing
configuration or release workflows. Existing desktop acceptance receipts and
rejected-refresh preservation remain in place.

The canonical owner phone checkout remains `codex/local-ios-1-0-1` at
`e7b842b`, iOS **1.0.1 (228)**. Its source, owner signing settings and retained
native packets are unchanged. No native application launch, simulator/device
action, Apple/account operation, signing, packaging, upload, submission or
public release is part of this correction. Browser and synthetic checks do not
establish a cause for the native keyboard conversion warnings. Owner signing,
physical TestFlight acceptance and App Review remain separate gates.
