# Session 76: direct desktop 232 release recovery

Checkpoint: November 2, 2026. This session follows the historical preparation
and owner-approval checkpoints in Sessions 72 and 74; those records remain
unchanged. Production iOS and Mac App Store **1.0.1 (230)** and their manual
release settings are outside this direct-desktop recovery.

## Why 231 was not published

Chris personally approved the protected deployment for
[run 41496140750](https://github.com/cbremer/specdown/actions/runs/41496140750).
The provenance check and Linux build passed. The Mac job completed signing,
notarization, strict signature/Gatekeeper checks, icon/association verification
and artifact storage. These are recorded CI outcomes, not a new local installation
or independent downloaded-artifact inspection.

Windows failed eleven tests before packaging: three synthetic Mac bookmark cases
used host-dependent paths, and eight embedded-profile cases assumed POSIX
permission behavior on Windows. The all-platform publish job correctly skipped.
No 231 release was published. Its draft is labeled superseded, its artifacts
remain historical, and immutable tag `v0.0.231` still points to
`df3701c0ce2d9a4651caa7a62b04512bb789b07d`.

## Windows correction and reviewed 232 source

[PR #388](https://github.com/cbremer/specdown/pull/388) was reviewed at
`c9ab703ff73c41747eb8f1141915c39c199c51da` and rebase-merged to
`9019fd07c0c8c659479537e4a0617af71ffe6997` after its exact-head checks passed.
[Session 75](2026-11-02-tasks-session-75-windows-test-portability.md) describes the
portable POSIX test model, shared security contract and new real Windows CI job.
Application code, security guards, dependencies and signing authority did not
change.

Actual Windows CI passed **1,419 tests**, with **10 additional real-POSIX
integration cases skipped only on Windows**; the same contract still runs there
against the portable model. Real Windows file-watcher checks also passed.
Linux passed **1,429 tests across 79 suites**. These results close the observed
fixture portability failure, not the broader hands-on Windows/Linux testing gap.

The obsolete version proposal [#387](https://github.com/cbremer/specdown/pull/387)
was closed because its source base omitted that correction. The replacement
[PR #389](https://github.com/cbremer/specdown/pull/389) contains one version-only
commit directly atop the merged fix. Independent review verified all four allowed
files: `package.json`, `package-lock.json`, `markdown-viewer/src/main.js` and
`CHANGELOG.md`. Only the direct version advances from **0.0.231 to 0.0.232**;
package dependencies and native Store configuration are unchanged. The complete
previous changelog body is preserved and the release classifier returns
`action=release`. Unlike the earlier preamble-first 231 input, the current
changelog starts with its version section, so the existing generator preserves
history without a policy exception or generator change.

All seven exact-head checks passed before rebase merge. Reviewed
`2795622ab55ec2cfc2c6905adf3cfd98a48e3152` and merged
`cc7024d7008cbd6be4e3f29eefe2f0a41ec44824` share the complete Git tree
`497a697944c7df847bc05a46b7f7eeefc0662a87`. The reviewed version workflow created
immutable tag **v0.0.232** at that exact merged commit and a draft release.
Neither tag was manually moved. Release notes cover Close Folder, safer document
handling, diagram/Find improvements and the reviewed security/dependency updates;
they retain the explicit Windows/Linux hands-on testing limitation.

## Protected release checkpoint

A fresh independent pre-dispatch check verified the exact tag/source/version and
the live `desktop-release` environment. The sole reviewer is repository owner
`cbremer` (numeric ID 4009517), administrator bypass is disabled, and only exact
branch `main` is allowed. The reviewed owner-policy verifier passed on the live
API responses. The explicit `repository-owner` mode still requires Chris to
approve this release's pending deployment himself; an agent cannot do that.

The protected workflow was dispatched from exact main
`cc7024d7008cbd6be4e3f29eefe2f0a41ec44824` for immutable **v0.0.232**:
[run 41503767953](https://github.com/cbremer/specdown/actions/runs/41503767953).
At the saved readback, **provenance passed** and **all three build jobs were
waiting for the required owner deployment approval**. The pending
`desktop-release` reviewer is `cbremer` (4009517). Chris was asked to approve the
new 232 deployment directly in GitHub; the agent did not approve it. No 232 build
or signing step had started at this checkpoint. The saved
`desktop-232-owner-approval-waiting.jpg` and `.txt` record the gate.

A dispatch, draft/tag or passed source check does not establish signed artifacts,
successful publication or a working public update feed. After owner approval,
all platform jobs and publication must pass, followed by verification of the
actual release assets and update feeds. Existing successful 231 Mac/Linux jobs
are not relabeled as 232 evidence.

## Remaining channels and retained evidence

The artwork placement, Duo order and production Apple submission evidence remain
as recorded in [Session 74](2026-11-02-tasks-session-74-release-checkpoint.md).
This recovery made no Apple listing, submission, profile or account changes.
The separate Dev/Beta candidates in [draft #384](https://github.com/cbremer/specdown/pull/384)
remain unsigned, source-specific inspection artifacts; Mac Beta association and
matching profiles, authorized signing, installation and physical acceptance
remain separate gates. No live user data was migrated.

Canonical evidence under `ios/DerivedData/release-followup-20261102/` includes
`direct-231-final-run.json`, `direct-231-mac-release-result.json`,
`direct-232-source-review.json`, `direct-232-independent-predispatch.json` and
`direct-232-release-notes.md`. The pre-dispatch report SHA-256 is
`34b6203daf7e8f9176572920c29b15a984d17eaca09fa5ad4a620ca8e9d83253`.
Raw logs, account captures and credentials are not copied into this public
handoff. The owner checkout remains clean at
`9d27fc1a6961e29c86def43cee17c6fbb7d66db1`; the canonical Xcode project and installed
apps are unchanged.
