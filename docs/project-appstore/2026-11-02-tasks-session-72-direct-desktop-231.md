# Session 72 — direct desktop 0.0.231 candidate

The owner requested shipping the regular desktop app with the latest reviewed fixes, including Close Folder. The public direct-download release remains **0.0.229**, published November 1, 2026; its update feed does not contain the accumulated weekend fixes. This session prepares the next direct release without changing production Store **1.0.1 (230)** or the canonical owner checkout.

## Source and review

The reviewed candidate for [#383](https://github.com/cbremer/specdown/pull/383), `codex/direct-desktop-231`, was one four-file version-only commit **66a805bb88071471f1a788890b09ea21c371d1fd** atop reviewed main **a339b80556343b7c8f8aa9984b9c39cd1ae404d2**. Package and viewer versions advance from 0.0.230 to 0.0.231; dependencies, native iOS configuration, MAS configuration, identities and Store build numbers are unchanged. The current release policy requires one patch increment and creates tags only after the reviewed version PR merges. There is no v0.0.230 tag. No tag was manually created.

The generated changelog initially failed the exact release classifier: the generator placed the new section after its preamble, splitting the previous body, while the classifier requires the previous body as one contiguous preserved block. The candidate puts the new section before the entire unchanged historical preamble/body. The release classifier now returns `action=release`; no policy was weakened. The generator/classifier disagreement is a separate automation follow-up and must be corrected before relying on the next generated proposal.

Independent exact-head source review, 1,371 tests across 78 suites, lint, typecheck, web build and whitespace checks pass. Exact-head GitHub runs pass: CI 41488871657, iOS 41488871866, version check 41488871588, and desktop package validation 41488871736 (macOS universal, Windows NSIS, Linux AppImage and real watcher tests). These checks do not establish signed distribution or broad physical Windows/Linux acceptance.

## Unsigned local package evidence

The isolated in-repository worktree contains an unsigned universal Mac app, DMG and ZIP. Official Electron 45.1.0 Darwin arm64/x64 archives match the release checksums. Physical dependencies avoid the earlier symlink collector omission; the collector finds all 138 production packages.

Verification checks 127 application/web source files, all 110 web files, 8,625 packaged dependency files against the current physical tree and reviewed dependency inventory, 14 universal native binaries, 270 outer files and 14 safe internal links. The direct bundle remains `com.specdown.desktop`, version/build 0.0.231, macOS 13 minimum. Electron Updater 6.8.11 and its direct feed remain present; the top-level signature and provisioning profile are absent. No QA document is packaged. DMG checksum verification and full ZIP integrity checks pass.

Thirteen isolated real Electron 45 checks pass: sanitized native document admission, rejected-input preservation, scoped read/receipt denial, accepted folder opening, Close Folder preserving the document and its grant while removing folder navigation, live reload after Close, reload/session delivery, stale/replayed/wrong-frame receipt rejection, wrong-page bridge denial and clean window destruction. The harness uses fresh synthetic state, intercepts OS recent-document/dialog/external actions and disables updates. It does not install, replace or quit the owner's apps.

The first package attempt could not download public builder tools under restricted DNS; it is retained separately. The initial runtime invocation aborted before harness execution under the host sandbox; the identical isolated harness passed with scoped local execution. A pre-completion archive inventory is labeled historical and is superseded by the final verification after packaging exited successfully.

## Initial release gate

At initial preparation, an admin-readable provider inventory showed only `copilot` and `github-pages` environments; `desktop-release` was absent. Five existing signing-secret names were present at repository scope; their values were not read, exported or used. Source merge authorization is separate from the protected signing/publication environment.

The owner clarified that he is the sole maintainer, and a separate owner-release mode was proposed. This initial preparation did not change protection rules or bypass the independent-approval policy. Its configuration gate is superseded by the completed owner-approved setup in Session 74. Actual human deployment approval, signing/notarization and complete all-platform publication remain separate gates. Signed local packaging is not used to route around them.

The canonical checkout remains clean at 9d27fc1a6961e29c86def43cee17c6fbb7d66db1, with every tracked byte matching its HEAD. Existing signed Store230 apps and submissions are unchanged.

Local evidence: `.claude/worktrees/specdown-direct-desktop-231-20261102/ios/DerivedData/direct-desktop-231-20261102/`. Source review, final package hashes, runtime result, integrity logs, provider gate snapshots and root preservation remain separate evidence surfaces. No signing, notarization, installation, public release, Apple account action or credential use occurred.

## Merge checkpoint

Root rebase-merged PR383 on November 2 at 17:18 UTC to `df3701c0ce2d9a4651caa7a62b04512bb789b07d`. The version workflow created `v0.0.231` at that exact commit and a draft release. Both reviewed `66a805b` and merged `df3701c` have tree `7982356de084ee04da54c5292293de9da405df78`; the complete source bytes match. Local artifacts remain recorded under their actual built commit, with explicit tree-equivalence provenance. No repeated build or public release is implied.

## Independent artifact audit

A second reviewer independently checked all 8,753 ASAR entries, 127 source files, 270 outer files, 14 safe internal links, 14 universal native binaries and both final artifact hashes. Updater6.8.11 is present; top-level signature and profile are absent. No findings. The retained report `independent-artifact-review.json` binds final manifest SHA256 `8ec13af67c1e1fd045f71120b32bb575169a7d994393a29b58aed0411b951db8`.

A further independent audit checked all 28 native architecture slices against
the verified official Electron archives, all 270 ZIP file hashes and 14 ZIP
link targets against the app, and independently verified the DMG checksum.
The tag was read from GitHub and the merged commit fetched for a direct tree
comparison. The remote release remained a draft with zero assets and no
publication timestamp. Local `latest-mac.yml` exists because electron-builder
generates it even with `--publish never`; that unsigned feed and its installers
must not be published. This is not a claim that the direct app lacks its normal
embedded updater configuration. The additional report is canonical
`ios/DerivedData/release-followup-20261102/independent-direct-231.json`, SHA-256
`d3769e6eca858872cafadc15237a932aff2b1c587282231180c7501094bf3904`.

The following [Session 74 checkpoint](2026-11-02-tasks-session-74-release-checkpoint.md)
records the merged owner-release policy, verified live environment and dispatched
release run waiting for actual human approval. This session's initial missing
environment observation is historical; it is not a claim about the later setup.
