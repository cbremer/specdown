# Session 26 — Integrated viewer review baseline

Date: 2026-10-31. Branch: `codex/integrated-viewer-review`. Source worktree:
`<repo>/.claude/worktrees/specdown-integrated-review-20261031`.

## Provenance and scope

This integration combines already-reviewed changes without adding application
behavior. The exact inputs are:

| Input                          | Revision                                   | Relationship                                          |
| ------------------------------ | ------------------------------------------ | ----------------------------------------------------- |
| Desktop acceptance, draft #337 | `c44a1f8cc9886222b8c44a38a6ff4feed2a9377f` | Base; directly includes refresh fix `f2715df` (#333). |
| Fullscreen focus, draft #335   | `91d03967a4a4d94d56e4cc1409c9862435dac7cd` | Based on frozen mobile `e7b842b`.                     |
| Presentation focus, draft #336 | `49dd1cc4a5677cc59893ff43847f09d05d2da988` | Direct child of #335.                                 |

The aggregate reviewed focus delta from `e7b842b` through `49dd1cc` was applied
to the desktop base, excluding only the shared project index. The index retains
the union of Sessions 19, 23, 24 and 25, and adds this handoff. Sessions 23 and 24
are copied unchanged as historical evidence for their original reviewed source.
There were no application patch conflicts or manual behavioral resolutions.

Every resulting focus application/test file must match `49dd1cc` byte for byte.
All other inherited tracked files must match `c44a1f8`, apart from the deliberate
index union and this new document. In particular, desktop receipt handling,
refresh acceptance, native Swift, dependencies, version/build declarations,
signing configuration and release workflows retain the desktop base's bytes.

## Validation and exact baseline handoff

Validation passes:

- Direct byte/mode comparison verifies **424 files**: 10 focus files (six
  application files, two test files and two historical documents) match
  `49dd1cc`; 414 inherited files match `c44a1f8`. The deliberately combined
  project index and this new handoff are outside that byte-equivalence claim.
- Independent review repeats the file comparisons against Git objects and
  confirms the exact index union, with no missing or extra application changes.
- CI-style `npm run test:coverage -- --runInBand --roots ./tests` passes
  **1,089 tests / 66 suites**, including the required desktop coverage gates.
  Lint, typecheck and diff checks pass.
- The production web build completes with **110 generated files**. This is a
  shared viewer build, not refreshed native packages or runtime acceptance.

The complete evidence directory is
`<repo>/ios/DerivedData/integrated-review-20261031/`.
It retains the applied `reviewed-focus.patch`, a machine-readable per-file origin
and hash report (`source-provenance.json`), `validation.json`, full command logs
and generated-output hashes (`web-build-manifest.json`). The source report's
SHA-256 is `47116b2ef730cf978b3b288cecbc820a610a9bc03c231920f1444571dc050a40`;
the generated manifest's SHA-256 is
`97d74db8d650cc86d46aee8e20d5afc30e847ddc996bccdd66a8e35ac76f8753`.
Existing harness listener warnings, negative Git-revision stderr and Vite's
large-chunk warning remain in the logs.

The integration baseline is identified by `COMMIT.json` in the evidence
directory, written after creating its single reviewed commit. That manifest
records the exact combined SHA; the input branch tips are not substitutes for
it. The subsequent lifecycle correction starts in a second in-repository
worktree from that recorded SHA and forms one separate logical commit/PR. Its
negative controls execute against this committed combined baseline.

Real production-browser negative controls confirm the inherited lifecycle gap:
the bundled showcase opened in fullscreen remains over Raw after the palette's
Toggle raw / preview command; presentation likewise remains on slide 1 of 10
over Raw. Each overlay retains focus. These are expected baseline failures,
not passing teardown checks. Evidence is retained in
`<repo>/ios/DerivedData/accepted-overlay-lifecycle-20261031/browser-baseline.json`
and the matching `.jpg`.

## Preserved boundaries and remaining work

Accepted document/view replacement still does not automatically close an
existing fullscreen or presentation clone. This integration adds no lifecycle
hook, teardown helper or detached-control guard. The later correction must run
synchronously only after accepted view invalidation, preserve overlays on
rejected/tab-limit/background-only changes, prevent stale asynchronous work or
detached old controls from affecting a new instance, and preserve newer dialog
focus. That behavior requires its own negative controls, review and validation.

The canonical owner phone checkout remains `codex/local-ios-1-0-1` at
`e7b842b`, iOS **1.0.1 (228)**. Its source, generated Xcode project, owner signing
settings and retained packets are not replaced by this integration. No native
application launch, simulator/device action, signing, Apple/account operation,
artifact repackaging, upload, submission or public deployment is included.
Existing runtime/package evidence remains tied to its original source revision.
