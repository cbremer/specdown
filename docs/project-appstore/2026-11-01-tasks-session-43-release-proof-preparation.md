# Session 43 — iOS and Mac App Store proof preparation

Chris requested completion of the release artwork, text, screenshots and builds so he can proof both platforms before submission. This session prepares draft materials and reviewed candidates; it does not authorize App Review submission or public release.

**Latest checkpoint:** [Session 48](2026-11-01-tasks-session-48-current-release-proof.md) supersedes this session's earlier canonical/source/artifact and empty-screenshot observations. The canonical checkout is now final `b9e5472`, 1.0.1 (229), with verified unsigned iOS and MAS artifacts and the required diagram-link removal. Native iPhone screenshots are partially complete; iPad/Duo/Mac captures, new signing/TestFlight and owner proof remain in progress. Sections below preserve the earlier preparation evidence and its chronology.

## Baseline and preservation

- Canonical iOS checkout: `<repo>`, `codex/local-ios-1-0-1`, `729258b3ef31d9a4167e8e93fdd3f095d92a08d2`, 1.0.1 (228). Existing owner source, signing settings, artwork and local documents remain preserved.
- Mac candidate: `.claude/worktrees/specdown-mas-local-20261101`, `codex/mas-startup-delivery`, `eed62c9911d0477386c8dc3fd1a76a6a2db498f1`. Mac TestFlight 1.0.1 (228) is already Testing for Owner; do not overwrite or relabel that build.
- iOS Beta 1.0.1 (228) is internal-only on its separate `.beta` record. The production iOS update needs a production-ID archive with internal-only distribution disabled.
- Work is limited to this Mac and connected project services. Existing direct desktop installation, live note stores and owner keys remain untouched. Use the existing signed-in Comet session; stop if it signs out.

## Release work

- [x] Implement and independently review scoped native open-failure feedback and explicit per-entry Stop reopening behavior (WK-31/WK-32). Source review and synthetic controls pass; native signed-app acceptance remains separate. Dismiss hides a notice without deleting its saved startup reference.
- [x] Implement and independently review the permanent MAS public embedded-profile permission and package readability guard, preserving private profile permissions.
- [x] Integrate the reviewed source changes and validate the aligned version stamp. The isolated candidate is stamped iOS/MAS **1.0.1 (229)** and shared-source **0.0.229**; this is source metadata, not evidence of a completed native artifact, upload or TestFlight acceptance.
- [x] Finish paste-ready EN-US iOS/Mac listing copy and platform-specific review notes; validate limits and read back the saved draft fields exactly. Chris's final copy proof remains pending.
- [x] Prepare the Halo Search Results adaptation and validate its 1920 × 1280 opaque export. Upload as a draft only; owner appearance/crop proof, creative review and assignment remain pending.
- [ ] Capture fresh actual-app screenshots for iPhone, iPad, Duo and Mac; preserve raw captures and bind them to exact source/runtime.
- [ ] Prepare draft App Store Connect metadata and media without publishing changes to the current live iOS listing.
- [ ] Produce reviewable current builds and document signing/distribution status separately from local/simulator evidence.
- [ ] Refresh the Launch Weekend sheet, proof index and the remaining owner/device acceptance checklist.

The local proof index and platform-specific checklist are prepared. The parent task owns the live tracker and final owner-acceptance readback; this documentation pass does not change the sheet.

## Deferred scope and submission gates

WK-18's broad annotation recovery/identity project remains deferred under the existing release plan. Native iOS annotations remain disabled. Do not present CI, screenshots or simulator runs as physical-device/TestFlight acceptance. Owner proof, physical platform acceptance and approval precede App Review submission. Public release remains owner-controlled.

## Materials and observations

Proof materials are under `docs/project-appstore/release-proof-2026-11-01/`; machine evidence is under `ios/DerivedData/release-proof-20261101/`.

The signed-in iOS creative placement view shows **1 of 1 Header Asset** with Save disabled, superseding Session 42's earlier 0/1 observation. The subsequent Recent Usage check confirms this is the approved Halo asset, assigned to iOS 1.0.1 English (U.S.); no agent assignment was made. The Search Results placement was 0/1, with no compatible approved asset in its picker. Its new compatible adaptation is still an unsubmitted, unused draft. Existing screenshots/previews remain the observed fallback. Both original approved header exports are 3840 × 1646, not 3:2 Search Results art.

The Halo adaptation was generated using the built-in image tool from the approved header, saved non-destructively, then exported at Apple's minimum 1920 × 1280 (opaque PNG). The raw generated source is 1536 × 1024; the export is a documented 1.25× resize, not a native higher-resolution generation. It awaits owner proof and Apple asset review; it is not assigned to the live listing.

### Draft portal preparation

- Created production iOS **1.0.1 Prepare for Submission**; manual release is selected. No Add for Review action.
- Uploaded **SpecDown — Brand Halo Search Results**, asset `c7c00019-6a0c-8898-8036-5a719f4c0b25`, **1920 × 1280**, Works With **Search Results**, **Prepare for Submission**, unused. No creative review submission or live assignment. Existing approved header assets are preserved. The normal Comet file picker was used because extension file attachment is unavailable; no browser permissions changed.
- Shared name/subtitle remain SpecDown / Markdown & Mermaid viewer; categories Developer Tools and Productivity; displayed global age rating4+ with regional exceptions; existing standard Apple license and content-rights answer preserved.
- Current App Privacy shows published Data Not Collected and the existing privacy-policy URL. Existing price is US$0.00; pricing/availability view shows175 countries or regions Available. No pricing, legal, privacy or availability answers were changed.

- Both platform1.0.1 drafts now contain the reviewed platform-specific promotional text, description, keywords and App Review notes; iOS also has What’s New. Readback verified every saved field exactly against the copy JSON. Existing contacts, copyright and manual-release settings were preserved.
- Halo identity is now explicitly verified: Approved asset `fe000019-6a0c-8898-8029-cae241fa2fe2` Recent Usage lists Product Page Header on iOS1.0.1(en-US), Prepare for Submission, and the liveiOS1.0. The agent did not assign the live Header. Search asset remains an unsubmitted, unused draft.
- Public support and privacy URLs load normally in Comet. The existing reviewed support-contact clarification remains in source for the website’s later coordinated deployment. No public website deployment occurred.

## Current local proof packet

- [Local gallery](release-proof-2026-11-01/index.html): literal copy from JSON, local full-resolution Halo assets, iOS/Mac sections, prepared screenshot captions and pending capture/build slots. No deployment. The approved Header was copied into the packet byte-for-byte so the gallery needs no files outside this folder to display its artwork.
- [Platform acceptance checklist](release-proof-2026-11-01/acceptance-checklist.md): exact-build, screenshot-order, artwork, privacy and owner-proof checks, all remaining acceptance explicitly pending.
- [Preparation status and hashes](release-proof-2026-11-01/preparation-status.json): dated source/copy/artwork metadata, kept distinct from final artifact evidence.
- [Screenshot manifest](release-proof-2026-11-01/screenshots/manifest.json) and [manifest contract](release-proof-2026-11-01/gallery-manifest-contract.json): `iphone63`, `iphone69`, `ipad13`, `duo` and `mac` are currently empty. Five caption positions per group are planned; no new capture or upload is claimed. Full-size raw native captures may be used directly, with captions displayed separately for proof.

### Exact copy readback

| Platform  | Saved fields verified against packet                                  | Source file SHA-256                                                |
| --------- | --------------------------------------------------------------------- | ------------------------------------------------------------------ |
| iOS 1.0.1 | Promotional text, description, What's New, keywords, App Review notes | `267d8eb00095b09b70fcdea6577f9333c87351e41f94885885cd4e5833edde82` |
| Mac 1.0.1 | Promotional text, description, keywords, App Review notes             | `755188e8cba36f849339cb09a2bb6e7383b822dab66df3887c5eec520d0cd9c2` |

These hashes identify `copy/ios-en-US.json` and `copy/mac-en-US.json`. Mac What's New is prepared copy for proof; the first Mac release's saved-field readback does not include that field. Existing name/subtitle, copyright `2026 SpecDown`, reviewer contacts and manual-release settings were preserved. Local copy validation still passes. Owner acceptance is not inferred from successful field matching.

Evidence: canonical `ios/DerivedData/store-asset-audit-20261101/ios-draft-copy-verification.json` and `mac-draft-copy-verification.json`. Both report `submitted: false`.

### Exact artwork state

| Placement               | Portal identity and state                                                                                                                                                                                | Local output                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| iOS Product Page Header | Halo `fe000019-6a0c-8898-8029-cae241fa2fe2`, **Approved**. Recent Usage confirms iOS 1.0.1 en-US **Prepare for Submission** and live iOS 1.0. Agent made no assignment change. Owner crop proof pending. | `artwork/specdown-brand-halo-header-3840x1646.png`; SHA-256 `d95704918b1076541af1186b0b860a05fd6f2c893ffab1b6cd81c98310c357dd`   |
| Search Results          | Halo `c7c00019-6a0c-8898-8036-5a719f4c0b25`, **Prepare for Submission**, unsubmitted and unassigned.                                                                                                     | `artwork/specdown-halo-search-results-1920x1280.png`; SHA-256 `145100f59dfcd82464ef3af665f4feb911136aafdb10b0f39554c8182da8af79` |

Header confirmation evidence is `ios/DerivedData/store-asset-audit-20261101/halo-assignment-confirmed.txt` and `.png`; Search draft evidence is `halo-search-draft.txt` and `.png` in the same directory. Approval of the old Header does not imply approval of the new Search Results adaptation.

## Source integration and evidence boundaries

- Package guard source: `cd3981f2457c2f31eeedb128db0d0f72dab0c1df`, integrated as `00da12eca2109f2af02b0ebd45e19670fbb1e89a`; [Session 44](2026-11-01-tasks-session-44-mas-package-permissions.md).
- Native open recovery source: `328b70c12a0910254974f998783b2e8853f86c60`, integrated as `03703298d28ac56dce2ffe69ff98e8fdf0ca4b0d`; [Session 45](2026-11-01-tasks-session-45-native-open-recovery.md).
- The integrated `specdown-store-release-proof-20261101` worktree retains both changes over `eed62c9`. Independent review compared 456 tracked non-index files to the exact source union and allowed only the five intended version replacements. Dependency versions and integrity entries are unchanged; all six generated iOS target configurations are 1.0.1 (229). Session 46 records the integration. The aligned stamp is `bb59e16`; subsequent required WK-33 removal is integrated as `b9e54727f3e18d02a874c5de768f6e0e47def493`. Final artifacts must bind to the latter source and their generated file hashes.
- Parent-reported integrated gates: **1,294 tests / 73 suites** with coverage, lint, typecheck and production web build passed. Native security checks, 24 icon/channel mappings and 17 negative controls also passed. These are source/tooling checks, not a signed artifact or device result.
- The separate recovery UI harness copies the actual renderer, toast, bridge and CSS unchanged, with synthetic in-memory bridge outcomes. Parent browser proof passed at desktop and 440px dark layout, covering failed Stop reopening/retry, canceled Locate, explicit accepted resolution, duplicate-basename isolation and oversized-file controls. It does not exercise native authority, file I/O, actual persistence or real document admission. Evidence: `ios/DerivedData/release-proof-20261101/recovery-ui/` and `ios/DerivedData/store-asset-audit-20261101/recovery*` captures/reports.

Final native 229 artifacts, Apple processing, screenshots, TestFlight installation and physical acceptance are **in preparation**. Existing 228 artifacts are preserved and are not relabeled. The canonical owner checkout remains 729258b at this snapshot; no source promotion, native build, signing, install, UI or portal operation is performed by this documentation update.

## Subsequent WK-33 release gate and Header preview

The aligned source stamp was committed as `bb59e16850c9a6394c332ce907ef1997d625d732`. Chris then identified the unsupported diagram toolbar link button as a pre-submission blocker. The minimal removal is independently reviewed and committed in isolation as `b9e54727f3e18d02a874c5de768f6e0e47def493`, with 1,292 tests / 74 suites, lint/typecheck/web build and independent 157-test review passing. Final native artifacts and screenshots must be rebuilt and checked with that removal. Version 229 remains unchanged, so its number alone cannot establish that a particular artifact contains the fix. Earlier bb59 native evidence is historical.

The parent also inspected Apple's Halo Header reference previews on iPhone portrait, Duo outer and inner landscape, and iPad landscape/light and dark. The emblem is centered and intact. `ios/DerivedData/store-asset-audit-20261101/halo-header-crop-review.json` explicitly records owner acceptance as false and notes that placeholder icons/inherited screenshots are not final 229 evidence. Search Results remains an unsubmitted, unassigned draft. Chris's final packet proof and exact-build TestFlight acceptance remain pending.
