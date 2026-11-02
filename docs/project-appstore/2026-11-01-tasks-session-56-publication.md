# Session 56 — publish reviewed source and public release proof

November 1, 2026. The owner authorized checking in and publishing the reviewed source, release documentation and artwork to the existing GitHub repository. This is source publication, not permission to sign, upload, submit or publicly release an Apple build. The owner subsequently requested merging only after the requested Copilot/independent reviews and required checks; this session does not claim those merges completed.

## Exact current release source

The frozen application source remains **`28848a25b837c022918ccc1625b17af0fa9c80e1`**, marketing version **1.0.1**, build **230**. The following eight source commits were pushed on their review branches. All eight PRs are now marked ready for review, and all 21 source workflows passed at this dated checkpoint. No merge is claimed. Copilot commented “approval recommended” on #352 with no inline findings; review of #345–351 remains pending. That comment does not satisfy GitHub’s required approval by itself. Read the exact current PR state before merging.

| PR | Exact source commit | Logical change |
| --- | --- | --- |
| [#345](https://github.com/cbremer/specdown/pull/345) | `b512db3` | Align Mac Store version with iOS |
| [#346](https://github.com/cbremer/specdown/pull/346) | `eed62c9` | Trusted viewer startup delivery |
| [#347](https://github.com/cbremer/specdown/pull/347) | `00da12e` | Installer profile and payload permission guards |
| [#348](https://github.com/cbremer/specdown/pull/348) | `0370329` | Explicit missing startup-file recovery |
| [#349](https://github.com/cbremer/specdown/pull/349) | `bb59e16` | Aligned build 229 source stamp |
| [#350](https://github.com/cbremer/specdown/pull/350) | `b9e5472` | Remove unsupported diagram share-link action |
| [#351](https://github.com/cbremer/specdown/pull/351) | `2414bc5` | Close Folder lifecycle |
| [#352](https://github.com/cbremer/specdown/pull/352) | `28848a2` | Aligned build 230 source stamp |

The public documentation/artwork candidate is prepared on `codex/release-proof-publication-230`, based on exact `28848a2`; its PR is separate from those eight source changes. The base review branch is `codex/release-review-build-230`. No application or dependency bytes change in this documentation commit. Main has advanced independently; final integration must preserve the reviewed dependency graph/version and main's changelog, resolve conflicts and rerun the required checks before merge. Do not treat the stacked PRs as eight independent duplicate patches.

## Evidence and remaining gates

The reviewed source passes 1,341 tests across 77 suites, required coverage, lint, typecheck and the web build. Close Folder has 58 independent cases and ten observed production-browser cases. Signing-disabled iOS production device/simulator products and the unsigned Mac arm64 review app are independently verified against this source. Twelve scoped unsigned Mac native UI cases pass. These observations do not establish provisioned-sandbox, Intel, signed distribution or physical TestFlight acceptance.

Signed production iOS and universal Mac **1.0.1 (229)** artifacts belong to `b9e5472`; their Owner-only TestFlight records remain historical. They do not contain Close Folder and are not relabeled as230. Build 230 still needs its own distribution artifacts, authorized signing/upload and exact production iPhone/iPad/Mac acceptance before App Review. Public release remains owner-controlled.

Selected saved listing copy and captions are unchanged. The AI-workflow rewrite remains an optional later proposal. Approved artwork and synthetic screenshots retain their original bytes; the ten iPhone captures remain build 229 evidence. No current230 screenshot is invented. Mac capture is owner-deferred. Search Results artwork submission, Apple approval, assignment, visible placement and owner proof remain separate facts.

## Publication privacy and inventory

[Publication inventory](2026-11-01-publication-inventory.json) accounts for the tracked README edit and all 71 previously untracked inputs with original hashes, public hashes and explicit decisions. Public counterparts normalize owner-specific paths and remove private backup/account-operation details. The original signing recovery runbook, original Word working document and three raw authenticated portal screenshots remain at their original local paths behind exact-path ignore rules; portable public summaries/text and exclusion notes explain them. No credential store was inspected or copied. No key, certificate, provisioning-profile bytes, generated app, live note store or private review-contact value is included.

The canonical checkout is unchanged during candidate review. Before a later promotion, preserve exact owner-original bytes for every sanitized tracked counterpart using the inventory; do not overwrite private originals merely because a public version exists. Source/artifact hashes and signed-file references remain provenance, not a claim that ignored local verification files are published.

## Review boundary

This candidate is documentation, approved artwork and proof metadata only. Existing exact-source application validation is retained; no unnecessary native build or signing check is repeated. Independent publication/security review and source-preservation checks must pass before the single logical documentation commit. GitHub reviews/CI and any later merge are separate owner-authorized steps. No source tag, GitHub release feed, website deployment, Apple account setting or Store submission is changed here.
