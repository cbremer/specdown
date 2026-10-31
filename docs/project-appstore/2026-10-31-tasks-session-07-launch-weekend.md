# Session 07: launch weekend, security and next Store candidates

Date: 2026-10-31 (America/Los_Angeles).

## Working tracker

The existing [App Store execution tracker](https://docs.google.com/spreadsheets/d/1dGnVfCIzM4rgqb2_QsfNBh_yhvNYdjte0hs0ost1EKo/edit#gid=10312026) now has a **Launch Weekend** tab with WK-01 through WK-24. It covers security, local sync, public availability, website, assets, Mac App Store and the next mobile revision. Historical tabs remain intact. The existing Linear project is specifically Share Links; it is not a duplicate launch tracker.

## Scope and boundary

The owner reports Apple approved iOS 1.0 and moved it into publishing. Public US App Store and unauthenticated lookup checks independently confirm [SpecDown 1.0](https://apps.apple.com/us/app/specdown/id6822086808) is available. This does not establish all-country availability or a successful device purchase/download.

Work authorized overnight: inspect and fix Codex Security findings across shared and native code, update local source and website, inventory local assets, build and validate local candidates. Do not access App Store Connect, retry Apple authentication, upload, submit, or release Store candidates until the owner is ready. No Apple portal actions were taken. Work is restricted to this Mac and connected project services. Never access any of the owner's other computers through SSH, remote desktop, network shares, or other means.

## Baseline and preservation

- Fetched and fast-forwarded primary `main` from 2283d83 to 681d952 (v0.0.228).
- Preserved the owner's uncommitted App Store artwork/copy and index changes. The tracked index also has a named backup stash, `codex-preserve-appstore-readme-2026-10-31`.
- Implementation uses an isolated checkout with stacked branches `codex/weekend-release-controls`, `codex/weekend-security-fixes`, `codex/weekend-launch-website`, `codex/weekend-toolchain-audit` and `codex/weekend-iphone-duo`; the primary checkout remains on current published source.
- The first weekend follow-up adds `codex/weekend-updater-cache`, `codex/weekend-annotation-store` and `codex/weekend-electron-security` after the Duo branch. Each is a separate logical commit and draft review candidate; inspect live PR heads and checks before acting.
- The second follow-up adds `codex/weekend-document-context` after the Electron security branch. It protects note actions and asynchronous rendering across document changes without changing persistent annotation identity.
- The approved iOS source version remains 1.0 (11). Local simulator validation overrides only the candidate build number to 228; no new Store binary has been uploaded.

## Security work

Codex Security returned 45 historical/repository records: 41 marked new and 4 marked fixed. Several describe the same underlying flaw or code already changed. Full scanner evidence remains in a local private working report; this document records remediation categories without exploit payloads.

- Shared viewer: centralized real-DOMPurify policy, UI/DOM namespace separation, document and annotation bounds, HTTPS document fetching, explicit history reopening, bounded creator detection, clipboard-control warnings, and narrower service-worker caching.
- Electron/direct downloads/MAS: main-held file capabilities, genuine File provenance in preload, bounded native reads and watcher count, private print files, local-resource filtering, and moved-bookmark revocation.
- iOS: strict custom-scheme origin and symlink-resolved path containment, bounded reads, no arbitrary cleartext web exception, and reliable early file-error delivery.
- Dependencies: compatible updates plus Mermaid 12.2.0. The runtime-only npm audit has zero advisories; the full toolchain retains moderate/low advisories requiring separate compatibility work. No forced downgrade of Jest, ESLint, or packaging tools was applied.
- Release paths: shell-free Git arguments, strict version/tag validation, reviewed version PRs, immutable build SHA, separate build/publish permissions, and no automatic Apple upload.

## Release policy changes to review

The prior automatic release path used ADMIN_PAT to bypass main review. The candidate replaces it with a normal version-only PR created by GITHUB_TOKEN; it never merges that PR itself. A reviewed version-only commit may create an immutable tag and **draft** release. Existing tags cannot be moved. CI is explicitly dispatched for token-created PRs, including the required `bump` check.

Desktop release is explicitly dispatched from main with an exact tag. Preview defaults to unsigned, artifact-only output. Publication requires a `desktop-release` environment configured for independent reviewers, prevention of self-approval, no administrator bypass, and a main-only deployment rule. The workflow checks these controls and fails closed if it cannot verify them. macOS publication requires signing and notarization; no unsigned fallback can reach the public update feed. Build jobs cannot write releases; publication jobs do not execute npm or repository code. The publisher rechecks the tag SHA before upload and refuses to overwrite a published release.

**External policy still requires owner review:** the live repo had only `copilot` and `github-pages` environments, no protected desktop release environment, and an administrator bypass on main. Configure the independent release environment, move signing secrets into it, protect release tags from updates/deletion, and retire ADMIN_PAT after reviewing the replacement. Repository code cannot prove those account settings are enforced. No permissions or secrets were changed in this session, and these findings must not be closed merely because source was edited.

Pages builds tested main source with read-only permissions and deploys the resulting artifact in a separate job. iOS release automation is now unsigned validation only. A future signed Store lane needs a separately reviewed candidate/approval design.

## Apple handoff

- **Assets:** local Halo and Reading Companion 3840 × 1646 header exports and prior screenshots/copy are preserved. Prior session records report upload to Asset Library; current portal assignment remains unverified. Review assignment, screenshot ordering, optional app preview video, keywords/promotional copy and accessibility declarations after the owner signs in. Only declare accessibility features actually tested.
- **Mac App Store:** the owner confirmed some keys have already been generated and will complete the key/signing setup **by hand**. A local keychain snapshot is not evidence those owner-held assets do not exist. Do not create, replace, rotate or independently use these keys. Prepare the artifact and checklist for Chris, who handles existing distribution/installer identities and profiles; then verify the signed universal package, sandbox Finder cold start, grant restoration/revocation, live reload, print/PDF, updater suppression, metadata/privacy and submission.
- **Next mobile revision:** choose marketing version (proposed 1.1) and verify the latest uploaded build number in App Store Connect. Use a monotonically increasing build number tied to the web patch only after that check. Device QA and signed archive/export remain required before TestFlight/App Review. Release notes should describe security fixes and the visible changes to URL loading, document HTML, size limits and remembered file permissions.

## iPhone Duo addition

The owner added folding iPhone Duo compatibility to the next mobile revision. Apple confirms that iOS 27 SDK builds resize and iOS 27.1+ builds use the full display; native bars and safe areas can change position. Follow [Apple's preparation guide](https://developer.apple.com/iphone-duo/prepare/), [adaptive layout overview](https://developer.apple.com/videos/play/tech-talks/111461/) and [reserved-region guidance](https://developer.apple.com/videos/play/tech-talks/111463/).

Audit assumptions about phone versus tablet, viewport width/height, safe-area symmetry and WebView lifetime. Verify the same open document, tabs, scroll position, annotations and diagram zoom survive fold/unfold and rotation. Test closed, open and partially folded poses, Split View resizing, keyboard, action sheets, print/share popovers, fullscreen diagrams and screenshot needs. iPhone Duo remains an iPhone even when it has regular width. Compile success or arbitrary browser widths alone do not establish hinge/camera/pose correctness. No Duo-ready claim until native pose tests pass.

Additional tracked residuals: filename-only annotation identity needs a lossless migration design and external release protections require owner configuration. The initial security candidate retained 37 toolchain audit entries; the [separate toolchain follow-up](2026-10-31-spec-toolchain-advisories.md) reduces these to 17 (12 moderate, 5 low), with runtime audit still zero. Residuals are not silently marked fixed.

## Verification record

- Release controls: commit `51ffc3d`, [draft PR #311](https://github.com/cbremer/specdown/pull/311); all seven reported GitHub checks passed.
- Cross-platform security: commit `b44303d`, [draft PR #312](https://github.com/cbremer/specdown/pull/312), stacked after #311. 846 tests / 52 suites, lint, typecheck, YAML parsing and production build passed locally, including a clean `npm ci` checkout. GitHub caught an obsolete packaging backport version guard; corrected it to verify the upstream fix in app-builder-lib 26.18.1 without changing signing code or touching a keychain. GitHub lint/test and iOS Simulator checks passed on that exact head.
- Toolchain follow-up: commit `a391c62`, [draft PR #314](https://github.com/cbremer/specdown/pull/314); GitHub unsigned Windows NSIS, Linux AppImage and macOS universal packaging, iOS Simulator and lint/test checks all passed. Fresh local install and all 846 tests passed on the combined candidate.
- Runtime dependency audit: zero advisories. After the separate #314 update, the full build toolchain has 12 moderate and 5 low entries; see its assessment for the remaining upstream constraints. The remaining open brace-expansion Dependabot update is included in the candidate lockfile.
- Browser: real Marked/DOMPurify/Mermaid rendered all ten showcase diagram types, fullscreen controls, highlighted code, comments, disabled task checkboxes and namespaced authored anchors. A fixture containing overlay styles, control-targeting labels and an open dialog could not create those UI capabilities.
- Electron: an actual isolated runtime rendered Mermaid, denied an ungranted sibling file and arbitrary file image, blocked an HTTP request through CSP, exported a PDF and removed private temporary HTML. This is direct Electron evidence, not signed MAS sandbox evidence.
- iOS: unsigned Release simulator build passed with bundle ID `com.mosaicpando.specdown`, marketing 1.0 and validation build 228. All 110 packaged web files matched the production bundle, ATS arbitrary-load exceptions were false, real Swift traversal/symlink/size tests passed, and native cold launch no longer logged missing bridge-function errors. Physical device and complete touch-flow QA remain pending.
- Mac App Store initial security candidate: unsigned universal app and unpacked bookmark native module both contain x86_64 and arm64; packaged desktop and web bytes match source. MAS package excludes updater/feed and native source. ASAR SHA-256: `f738b1d178cc7af1842dbaf229a455dc0b3663e13eb710d62173ded3a59bf2be`. No signing keys were used; this is not an uploadable signed Store candidate.
- iPhone Duo: installed simulator device type requires iOS 27.1 or newer; initial installed runtime was 27.0. Official arm64 27.1 runtime installation completed with ample local disk space and no sign-in/agreement. Actual folded Duo baseline showed content beneath the side status area. Phone-idiom gating, conditional WebView recreation and lateral-safe-area work are being addressed on a separate compatibility branch; the native pose/state evidence is recorded in [Session 08](2026-10-31-tasks-session-08-iphone-duo.md). The Mac locked before the final touch matrix; no unlock bypass or other computer was used.

## First weekend follow-up

Three additional candidates extend the original stack. [Session 09](2026-10-31-tasks-session-09-updater-security.md) records the updater 6.8.11 cache-filename fix in [PR #321](https://github.com/cbremer/specdown/pull/321), including real dependency regressions that fail on 6.8.9. [Session 10](2026-10-31-tasks-session-10-annotation-storage.md) records unreadable-store and recovery-export protection in [PR #322](https://github.com/cbremer/specdown/pull/322). Independent review found and verified fixes for transient reads opening blank editors, overwriting saved collections, and losing imported extension metadata. Filename-only note identity and general recovery/restore design remain open under WK-18.

[Session 11](2026-10-31-tasks-session-11-electron-security.md) records the same-major Electron 44.10.1 update on `codex/weekend-electron-security`, its initial runtime evidence and separately identified combined artifacts. The reviewed builder guard remains unchanged. Do not replace it with the failing grouped Dependabot proposal or infer full security coverage from a zero runtime npm audit. No Dependabot PR was merged or closed.

The first follow-up's application revision `8303795` passed a clean install, **908 tests / 54 suites**, coverage, lint, typecheck and production build. Unsigned universal direct/MAS assembly and the unsigned iOS Release simulator build passed; all 110 iOS web files matched that bundle. Session 11 retains exact artifact hashes and distinguishes this application revision from its documentation-only review commit. The candidate checkout at `/private/tmp/specdown-weekend-20261031` is retained for the latest combined source under `codex/weekend-review-candidate`; the primary checkout and owner artwork remain untouched. Final interactive native checks still require this Mac to be unlocked.

## Second weekend follow-up

[Session 12](2026-10-31-tasks-session-12-document-context.md) records three reproduced races on `7803f9b`: a pending note saved into a different document, an obsolete editor deleting a colliding note ID from the new document, and a late render assigning old annotation context to new content. The context guard also covers raw/empty transitions, watcher/tab completion, and matching a requested PDF's filename to its captured content. Invalid input and ordinary resize preserve the current usable editor; rejected stale saves preserve the draft. Independent negative controls establish these failures on the prior candidate. Filename identity and legacy recovery remain unresolved under WK-18.

Session 12 is the current source/test/artifact handoff for `codex/weekend-document-context`; earlier native artifacts and interactive evidence remain tied to their recorded revisions. Do not claim final native interaction or signed sandbox acceptance from source, headless tests, or unsigned assembly.

Review/merge order is #311, #312, [website/tracker #313](https://github.com/cbremer/specdown/pull/313), [toolchain #314](https://github.com/cbremer/specdown/pull/314), [Duo #315](https://github.com/cbremer/specdown/pull/315), updater #321, annotation #322, [Electron #323](https://github.com/cbremer/specdown/pull/323), then the document-context branch, each via rebase after checks and independent review. Retarget stacked PRs after their base lands and recheck their exact heads. Do not merge release-authority changes before the owner reviews the changed release behavior. No Store action, production deployment or scanner finding closure occurred.

The user approved bounded two-hour overnight follow-ups; automation `specdown-launch-weekend-follow-up` is active. It preserves the Apple account/key boundary and reads this handoff plus live state before continuing.
