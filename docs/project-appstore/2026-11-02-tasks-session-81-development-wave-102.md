# Session 81 — Store 1.0.2 development wave

Development implementation and review, November 2, 2026. This session does not
merge, sign, install on physical devices, deliver Beta builds, submit to Apple,
release publicly or deploy the website. The owner supplied the six-workstream
implementation brief and explicitly requested implementation through draft PRs.

## Plan and isolation

1. Inspect main, existing implementations, open PRs and other active SpecDown work.
2. Develop native document authority/export, transactional annotation recovery,
   approved icon parity and public repository browsing in separate worktrees.
3. Review independently, reproduce findings with meaningful regressions, integrate
   shared document-context changes and verify real libraries/runtime behavior.
4. Publish draft feature PRs and a combined review candidate, retain evidence,
   proposed notes and an owner acceptance checklist. Do not merge automatically.

Canonical checkout remains clean on `codex/local-reviewed-main-230` at
`9d27fc1a6961e29c86def43cee17c6fbb7d66db1`. It was never switched, reset or updated.
Feature worktrees are inside this repository's `.claude/worktrees/`. Only this
Mac and connected project services were used. All documents, notes, stores and
profiles used for this wave were disposable synthetic fixtures.

The starting main was freshly verified as `63c2e8a`; the candidate incorporates
main `6f2747af4949540854152206f9d04d9f5da2192d`. The other relevant chat,
“Update SpecDown security and releases”, owned advisory/runbook housekeeping and
Sessions 79–80. Its changes are retained in the baseline; its checkout/files were
not edited. Session 81 avoids its documentation allocation. That chat was idle
at the final collision check; no unrelated chat history was opened.

## Source and draft PRs

| Workstream | Immutable feature source | Draft review |
| --- | --- | --- |
| iOS accepted bookmark recents | `3826a90e970fc17b269c04847b3bd8cc88bb848a` native stack | [#401](https://github.com/cbremer/specdown/pull/401) |
| iOS explicit relative raster images | Same coordinated native stack | [#401](https://github.com/cbremer/specdown/pull/401) |
| iOS PNG/SVG native Files and Share | Same coordinated native stack | [#401](https://github.com/cbremer/specdown/pull/401) |
| Approved desktop Light icon | `5c71dbf765333b232c6c928cbb0d558f57771884` | [#396](https://github.com/cbremer/specdown/pull/396) |
| Public GitHub browsing | `068f199bd7f3cf337a6ea13031e64c1dc1e7d7c3` | [#395](https://github.com/cbremer/specdown/pull/395) |
| Complete annotation identity/recovery | `f6aef0d296db993ecd2c190940c59daf98db1866` (tree of `0e7b501`) | [#402](https://github.com/cbremer/specdown/pull/402) |

The native publication head is `25d4d0e778050a8f92072207ce0a9afda5069fb5`, one
coherent commit with exactly the tree of the development stack's `3826a90`.
All eight checks passed on that exact public head. GitHub #395 has eight green
checks; icons #396 has eleven green CI/package checks. No PR was merged.

Combined development branch: `codex/wave-102-integration`, worktree
`specdown-wave-102-20261102`. The final single-commit publication is `codex/wave-102-candidate`; its draft PR records the exact head and CI.
A publication snapshot must not be merged in addition to its constituent feature
PRs; review it as the integration candidate, then choose one merge sequence.
Repository merge discipline remains one logical commit per PR, Rebase and merge.

## Implementation and independent review

- Native document acceptance owns transient view generations. Bookmarks/source
  registries cannot authorize a different view. Provider work and delivery queues
  are bounded; coordinator accessor URLs are carried through acceptance.
  Folder scopes/resources and staged diagram files have separate explicit
  authority, numerical bounds, cancellation and lifecycle ownership.
- Native review fixed dispatch/ack ordering, cold opens, full same-name hints,
  folder callback ownership, canonical-root races, bookmark/source-map bounds,
  SVG namespace/CSS external references, stale export chooser actions, older-A
  acceptance before newer-B completion, expired owned messages and moved-recent
  image bases. All ten actual bundled diagram types now stage through the native
  SVG policy. [Native evidence](../project-ios/2026-11-02-tasks-native-documents-export-evidence.md).
- Public browsing replaces unauthenticated Code Search (real HTTP 401) with
  metadata/commit/Git Trees. A truncated recursive tree receives bounded subtree
  traversal; no partial listing is called complete. Deep-URL fallthrough and
  selected-file stale-fetch races were independently found, reproduced and fixed.
  [Behavior and limits](../project-url/2026-11-02-public-repository-browsing.md).
- Icons reuse the approved Light master and preserve existing artwork, user
  selections, channel defaults and identities. Independent source/asset review
  is clean. Running Dock/window choices do not replace installed Finder/shortcut
  artwork. Existing non-Light artwork was byte-compared.
- Recovery uses IndexedDB transactions, durable operation intents/outcomes/acks,
  exact raw/container transport, explicit association/reconnect and edit-preserving
  undo. Independent review resolved legacy inference, lost-ack retries, imported
  history, compound budgets, original containers, repeated replacement, verified
  protective lineage, complete history paging and owned session-grant polling.
  [Decisions](2026-11-02-annotation-recovery-decisions.md) and
  [all 36 individually mapped rows](2026-11-02-annotation-recovery-evidence.md)
  separate local verification from remaining platform/capacity acceptance. Native
  iOS annotation editing remains disabled.

## Runtime and test evidence

Workstream counts are source-specific, not interchangeable with final integration.
Renderer Jest coverage remains the repository's known eval-harness limitation;
only configured desktop-main thresholds are claimed.

- GitHub: 80 suites / 1,459 tests with coverage, lint, types and production build;
  actual public API and real-library browser folder/filter/README flow.
- Icons: 80 suites / 1,450 tests with coverage, lint, types/build, fourteen image
  tests and all 24 native channel/artwork mappings. Official stock Electron
  45.1.0 actual main/menu/controller/atomic state passed three fresh-profile
  processes: Light persisted, relaunch restored Light, reset Original, relaunch
  restored Original with renderer ready. ZIP SHA256:
  `002b71efcf90e247317d3da486f2d4e51860e9c2889d49f33e229ab2268b0f3b`.
- Native final source: 82 suites / 1,450 tests, coverage gates, lint/types/build,
  portable Swift security cases, 23 strict channel-verifier cases and unsigned
  generic simulator build. Eight actual hosted tests passed on both task-created
  Phone and iPad simulators, with all ten bundled SVG types and real canvas PNG.
- Root native/asset replay: portable Swift security suite, 23 channel-verifier
  cases, fourteen image tests and asset verification passed on unchanged native
  and artwork source. Pillow used existing `/opt/homebrew/bin/python3.12`.
- Root real-browser reading smoke: a real encoded slash-branch folder URL listed
  five files; README filtering and keyboard Tab/Enter rendered `project-url`.
  Find focused its input, reported five matches, Enter advanced 1→2, Escape
  closed it, and split preview/raw rendered. Actual showcase zoom 76→93 percent
  retained center `(639.998, 360.000)` within 0.001 px; reset returned 62 percent,
  Escape exited. Browser warning/error log was empty.
- Final combined coverage: **86 suites / 1,478 tests passed**, configured thresholds
  passed; full lint/types and production build passed. A fixed-5ms context-test
  wait was replaced with bounded accepted-context readiness after it flaked under
  coverage. Logs `/tmp/specdown-final-acceptance-{coverage,lint,types}.log` and
  `/tmp/specdown-capacity-final-combined-build.log`.
- Actual configured Electron 45 combined runtime passed IDB CAS/retry/undo,
  production file-origin editor/private download/reselection and two-window
  operations. Three real process-kill cases cover prepared, committed-before-ack
  and explicit prepared-request discard cleanup. Nine mutation-fault phases plus
  five protective replacement/concurrent-write cases preserve authoritative state.
  All 36 real filesystem checks passed (native, polling and MAS session polling).
  Three separate actual-app processes passed accepted source identity and Light
  persistence/reset. Synthetic profiles are retained separately from owner data.
- Production preview browser at fresh origin `127.0.0.1:5185` saved one synthetic
  note, downloaded and reselected its actual private file, staged two immutable
  archives without importing a binding/permission, previewed the occurrence,
  explicitly associated it (two notes), then undid that operation (one original
  note retained; both archives retained). Browser warning/error log was empty.
- Combined unsigned native input head `b181cc313834ed01ceecdfba4c3d3b1d40c70d5d`:
  all eight named tests passed on both task-created Phone and iPad, all ten actual
  SVG types passed, `.dev` 1.0.2/230 and 110 bundled web files verified. Native and
  renderer source manifests stayed identical before/after. Subsequent changes are
  tests/docs only; publication source is checked against that manifest. Evidence:
  `ios/DerivedData/wave-102-final-native-b181cc313834-20261103T015806Z/summary.json`,
  source manifests, both xcresults and compiled-app verification. Both own test
  simulators and the earlier Duo simulator are Shutdown; existing devices were
  not erased/deleted or modified.

## Final hardening and capacity closure

- Windows CI exposed live SQLite handles in test cleanup and host/MAS path fixture
  differences. The application now closes its identity registry on `will-quit`;
  platform fixtures and lifecycle assertions were corrected. All eleven recovery
  checks passed at intermediate `9aa9ef6`; the final source head has fresh CI.
- Shared annotation test readiness observes accepted contexts and transaction
  outcomes rather than fixed five-millisecond waits, including the rejected-file draft
  regression exposed by final Windows CI. Actual deferred-commit and
  stale-view assertions remain intact.
- Maximum-size recovery originally double-charged hypothetical manifest space;
  complete future recovery could also need more state/projection capacity than
  capture alone. Verified imports now use exact manifest sizing. New admissions
  prove a complete future fresh stage plus protected activation before commit.
  Requests reference retained archives, preserving raw evidence without duplicating
  incoming state JSON. Internal byte projections use owned object identities;
  unknown metadata such as `capacityBytes` cannot reduce their accounting.
- Final actual combined capacity results: 33,290,194 original opaque bytes →
  33,292,780-byte file → actual download/reselection/reopened prepared request →
  exact 33,301,453-byte next backup. The next payload byte and forged flags reject
  without mutation. Observed heap sample 473,117,069 bytes is not a proved peak.
- 20,000 active plus 20,000 archived occurrences stage as 40,000 and activate as
  60,000, with a complete 27,090,576-byte next backup. Pure 60,000-archive recovery
  also passes. A new 20,000-active/40,000-archive admission rejects unchanged because
  it leaves insufficient recovery capacity. Independent ceilings cannot be
  combined arbitrarily; finite retained history can eventually exhaust capacity.
  Hard 32 MiB transport, 96 MiB representation and 60,000 actual occurrences remain.
- Original raw data, unsupported inputs and drafts are preserved on failure.
  Logs: `/tmp/specdown-final-capacity-{max,inventory,file-origin}.log`.

CodeQL automated review also flagged fixture data embedded in executable test
programs. Disposable browser probes now use structured CDP arguments; Electron
probes use a static profile-local preload and sender-scoped IPC data. All affected
real helper replays and independent review pass. Production main/preload and the
118-file native replay manifest are unchanged; final alert states are checked on
the exact PR head refs rather than inferred from a successful job.

## Versions, acceptance and handoff

The integration source targets Store marketing **1.0.2** in iOS and MAS metadata.
Build **230** remains a non-upload placeholder, not a newly allocated build; frozen
1.0.1 (230) artifacts were not overwritten. Direct desktop remains **0.0.232**.
Dev/Beta/production identities, signing material and existing apps remain intact.
No certificate, key, profile, Apple account or live annotation store was changed.

Simulator bridge reconstruction is not an actual iOS process-restart test. The
hosted iPad test uses the phone-layout WebView: actual tablet picker/popover
lifecycle is covered, full adaptive navigation is pending. Signed MAS/provider
movement, real iCloud/Dropbox/OneDrive offline/revocation/restart, actual user
Files/recipient transfers, physical devices, VoiceOver and owner visual acceptance
remain named gaps. Unsigned Windows/Linux packaging CI does not establish native
Windows/Linux runtime acceptance. No Store/public release readiness is claimed.

[Proposed 1.0.2 notes and owner checklist](2026-11-02-spec-1-0-2-candidate-review.md)
cover acceptance before separately authorized build-number selection, signing,
physical installation or Dev/Beta delivery. Apple upload, submission, manual
release and production deployment remain separate actions.
