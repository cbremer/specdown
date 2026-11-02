# SpecDown 1.0.1 — platform proof checklist

This is the remaining acceptance plan for Chris to proof before App Review. Checked preparation does not mean the final build is accepted. Public release stays manual. No checkbox or manifest in this packet performs a submission.

## Prepared and verified

- [x] Platform-specific English (U.S.) copy is selected from the retained saved baseline and is within the validated character limits. The gallery defaults to `copy/selected/`; selection provenance is in `copy/selection.json`.
- [x] Historical Session 43 portal readback matched the selected iOS and Mac version copy and review notes. Session 49's AI-workflow revision is preserved unchanged as an optional later proposal, not a release blocker. Current draft confirmation and final owner proof of the selected copy remain pending; no fresh subtitle/App Information readback is claimed.
- [x] Mac What's New is prepared copy only; the first Mac version's portal readback does not include that field.
- [x] Approved Halo Header identity is confirmed for iOS 1.0.1 en-US: `fe000019-6a0c-8898-8029-cae241fa2fe2`.
- [x] Parent inspected Apple's reference Header previews on iPhone, Duo outer/inner and iPad landscape/light and dark: emblem intact and centered. This is not owner acceptance or proof of current build-230 screenshots/icon.
- [x] New Halo Search Results export is 1920 × 1280, opaque, and submitted for creative review at Chris's explicit request. Apple confirmed **1 Item Submitted** and asset `c7c00019-6a0c-8898-8036-5a719f4c0b25` is **Waiting for Review**. Recent Usage remains unused; approval, assignment and visible placement are not claimed.
- [x] The local gallery, caption ordering and local-file manifest contract are prepared. Ten retained iPhone captures belong to build 229; none is relabeled as build 230. Current-release capture/proof remains pending. The retained 6.3-inch lifecycle scene needs lower zoom, and iPad, Duo and Mac groups remain empty.
- [x] Historical production iOS IPA and universal Mac App Store 1.0.1 (229) installer are signed and independently verified against `b9e5472`, including the diagram-link removal and all 110 packaged web files. Both were delivered and are available only to Owner; iOS readback records one internal tester and zero individual testers. Physical 229 TestFlight acceptance remains unrecorded. Build 229 does not include Close Folder. Reviewed replacement source 230 is now canonical; its signing, upload and physical acceptance are separate pending gates.
- [x] Close Folder and aligned build 230 source are independently reviewed and promoted to the canonical checkout: 1,341 tests/77 suites, required coverage, lint/typecheck/build, 58 independent feature cases and 10 observed production-browser cases pass.
- [x] Actual signing-disabled production iOS Release device and simulator 1.0.1 (230) products pass independent identity, icon, native-source and 110-file web verification. They are not signed distribution archives or physical acceptance.
- [x] Actual unsigned Mac arm64 review app 1.0.1 (230) passes independent static source, dependency, native-slice, link and bundle verification. This is not a universal signed distribution app, installer, sandbox runtime pass or TestFlight acceptance.
- [x] Twelve observed unsigned arm64 Mac 230 native UI cases pass: File/header Close, retained documents and links, live reload, replacement folder, recents and native Quit. The fixture was restored and binary/ASAR unchanged. Provisioned sandbox, Intel and exact Store/TestFlight acceptance remain unchecked.
- [x] Eleven scoped local checks of the separately development-signed Mac 229 candidate passed; evidence and unexercised cases are in `mac-runtime-229/runtime-result.json/.md`. Runtime QA ended with the app quit; a later screenshot session is separate. This does not accept the distribution-signed TestFlight build.

Source hashes and provenance are in [preparation-status.json](preparation-status.json) and [build-status.json](build-status.json). The gallery is [index.html](index.html). Signed artifact verification does not establish Apple processing, runtime behavior or physical acceptance.

## Freeze the exact candidates

The current source is **`28848a25b837c022918ccc1625b17af0fa9c80e1`**, version **1.0.1 (230)**. It includes WK-33 diagram-link removal (`b9e5472`), reviewed WK-34 Close Folder (`2414bc5`), and the separate aligned version-only commit. Sessions 53–55 bind the source, canonical promotion and new unsigned native evidence. Exact build-229 signed delivery evidence is retained under `historical_builds.229` in [build-status.json](build-status.json); it is not current build-230 evidence.

| Required evidence | iOS production | Mac App Store |
| --- | --- | --- |
| Marketing version / build | 1.0.1 (230) | 1.0.1 (230) |
| Reviewed source commit | `28848a2` | `28848a2` |
| Current unsigned artifact | Release device arm64 and simulator x86_64/arm64 independently verified | Unsigned arm64 review app independently verified |
| Exact embedded viewer | All 110 reviewed web files match each iOS product | All 127 source/web and 8,555 dependency files verified; no updater |
| Distribution signing / uploadable artifact | Pending new archive and signed IPA | Pending universal distribution app and PKG |
| Apple processing / exact selectable build 230 | Not uploaded | Not uploaded |
| Exact production TestFlight accepted | Pending | Pending |

- [x] Record build-230 source, source manifest and preserved canonical project settings. Keep unsigned artifact evidence separate from signing, upload and physical acceptance.
- [ ] Verify the actual 230 runtime has no diagram link action inline, fullscreen or in presentation; PNG/SVG retain their existing platform behavior. Record the exact artifact and source.
- [ ] Confirm the signed iOS product is **SpecDown**, production bundle `com.mosaicpando.specdown`, with standard distribution and the internal-only restriction **off**. Owner-only assignment is separate. Dev/Beta identities do not substitute for the production candidate.
- [ ] Confirm the final signed Mac product is the **Mac App Store** channel, `com.mosaicpando.specdown`, 1.0.1 (230), with universal native slices, complete dependencies and no direct-channel updater. The arm64 review product is a separate preparation artifact.
- [ ] Verify final build-230 signed identities, entitlements/profiles, installer permissions, complete payload and embedded viewer against the recorded source. Earlier signed 229 checks do not carry forward automatically.
- [x] Preserve the existing 228/229 uploads, artifacts and source-specific evidence without relabeling them as 230.

## iPhone and iPad acceptance — pending

Use synthetic Markdown fixtures and the exact intended production TestFlight build. Record the device/OS, version/build, results and any exceptions. Simulator captures remain simulator evidence.

- [ ] First launch and upgrade retain expected app state without clearing saved data. Native annotation display/edit/import/export stays unavailable; existing stored bytes are not migrated by this release.
- [ ] Open the bundled Sample and Diagram Showcase offline. Open a Markdown file through Files/iCloud and through another app's document handoff.
- [ ] Open valid document A, then reject an oversized or unsupported document B: A's heading, content and tab remain correct. A later valid open succeeds.
- [ ] Check tabs, Raw/Preview, Contents and Find. With the keyboard visible, the Find field, match navigation and close controls remain reachable; dismissal restores the expected layout.
- [ ] Expand a Mermaid diagram, pan, zoom with controls and Reset. Check centering at actual canvas size, resize/rotation and return to the reading view.
- [ ] Check fullscreen/presentation focus and nested actions. Find must not move focus to a hidden background field; accepted view/document changes remove old diagram overlays.
- [ ] Verify Files access and external HTTPS behavior without implying unrestricted filesystem or arbitrary embedded HTML support.
- [ ] Check all eight manual icons, including Light, plus light/dark/system appearance. Earlier Dev icon acceptance is useful history, not automatic acceptance of this exact production build.
- [ ] Test relevant iPhone and iPad layouts and record any untested older OS/device gate. Do not turn a Duo/simulator screenshot into a blanket compatibility claim.

## Mac App Store acceptance — pending

Use synthetic files and disposable test state in the exact intended sandboxed candidate. Leave the owner's real note store, unrelated session entries and direct-download installation untouched.

The current unsigned arm64 230 app passed the 12 observed cases recorded in `mac-runtime-unsigned/runtime-result.json`; this is not provisioned sandbox or production TestFlight acceptance. Native empty-folder/pending-picker race UI and note persistence were not exercised in that run.

The separate development-signed arm64 229 app passed scoped native launch/Open/Split, diagram controls and SVG/PNG save, Find, oversized rejection, startup restore and missing-file recovery checks. Locate cancellation, temporary Dismiss and persistent Stop reopening passed. Successful Locate replacement and the broader cases below remain unexercised in that run; the unchecked list remains the exact production TestFlight acceptance plan. Fresh Electron user data does not isolate shared OS recents or app-group identity.

- [ ] Launch, choose **Try diagram showcase**, then use **File > Open…** to open a synthetic Markdown file. Verify source/preview Split, tabs, Contents, Command-F, diagrams and appearance.
- [ ] Quit/relaunch and reopen the selected file through **File > Open Recent**. Where access is lost or the file moves, reselect it through the normal picker/Locate flow; do not grant Full Disk Access as a workaround.
- [ ] A missing, unreadable or oversized native open produces visible feedback while the current accepted document remains intact. Check the normal Open path, saved startup reopening and manual refresh.
- [ ] A retained missing startup file shows **Locate…**, **Stop reopening** and **Dismiss**. Non-session failures omit Stop reopening. Clicking a warning's body does not dismiss it.
- [ ] Cancel Locate: the warning and saved entry remain. Select a valid replacement: the startup reference changes only after that file is admitted. Rejected/full-tab opens do not silently remove the original reference.
- [ ] Dismiss hides only the notice for the current page load. Relaunch may offer the saved reference again. Stop reopening removes exactly that saved startup entry, retaining the file, notes, recents, grants and other entries.
- [ ] Exercise two missing files with the same basename; each control affects only its own entry. Check failure/retry using disposable state; failed persistence must leave the previous entry and truthful retry feedback.
- [ ] Confirm accepted path-bookmark recalls account for the retained startup entry, including a moved authorized file. Rejected, superseded or stale callbacks must not clear another entry.
- [ ] Open synthetic folder A, hide/show it, and verify Hide retains navigation. Close via its header, the command palette with the sidebar hidden, and File > Close Folder; each removes only folder navigation and keeps open documents, notes, recents and usable file access.
- [ ] Replace A with B and close an empty folder from the welcome screen. Retained A document links must not open B's files or navigate the app away; show reopen-folder guidance instead. Cancel a picker and complete a stale picker/scan after Close without restoring the old tree.
- [ ] Complete actual sandbox launch and relaunch checks. Installer readability/ownership and signature gates must be repeated for the exact signed 230 package; historical 229 static checks do not establish new runtime permission or persistence behavior.

## Screenshot order and upload proof — partial captures, owner proof pending

Use full-size, actual native captures. The gallery can show raw captures directly; its captions are proof text beside the images and are not evidence of a finished caption composite. Preserve raw originals. Never replace a live slot until the new candidate and intended draft/version/locale are confirmed.

Mac window sizing and screenshot capture are deferred until Chris returns to this Mac. That capture deferral is an owner-availability gate. WK-34 source is now reviewed and staged in 230; exact 230 native runtime, distribution and final screenshot proof remain separate gates. iPhone 6.3-inch order 4 still needs recapture; iPad and Mac groups remain empty. Duo remains an optional empty group unless the current portal establishes a requirement.

| Manifest set / intended slot | Caption source    | Ordered scenes 1 → 5                                                          |
| ---------------------------- | ----------------- | ----------------------------------------------------------------------------- |
| `iphone63` / iPhone 6.3-inch | `sets.iphone`     | Markdown overview; fullscreen diagrams; tables/code; state diagram; Dark Mode |
| `iphone69` / iPhone 6.9-inch | `sets.iphone`     | Same five caption positions, with captures for this actual slot               |
| `ipad13` / iPad 13-inch      | `sets.ipad`       | Sidebar/document; Gantt plan; tables/code; fullscreen sequence; Dark Mode     |
| `duo` / iPhone Duo           | `sets.iphone_duo` | Markdown overview; fullscreen diagram; Raw view; Find; Dark Mode              |
| `mac` / Mac                  | `sets.mac`        | Split view; fullscreen diagram; Gantt plan; tables/code; Dark Mode            |

The selected caption source is [copy/selected/screenshot-captions.json](copy/selected/screenshot-captions.json). The optional AI-workflow captions remain preserved separately. Match `order` 1–5, not filesystem sorting or upload-completion order. Do not silently discard a duplicate order.

- [ ] Use the intended current Apple slot and accepted dimensions. Historical local outputs were 1206 × 2622, 1320 × 2868, 2064 × 2752 and 2880 × 1800; these are references, not a fresh statement of all accepted dimensions. Confirm the Duo slot and its dimensions before export/upload.
- [ ] Record each capture's exact source commit, app identity/channel/version/build, OS/device or simulator, raw filename/hash, final filename/hash and dimensions. If resized/cropped/composited, record the transformation and retain the raw source.
- [ ] Fill `screenshots/manifest.json` using the [contract](gallery-manifest-contract.json), with plain local filenames, unique orders and explicit `in_preparation` or `ready_for_proof` state. Set `proof_accepted` only after Chris's actual acceptance.
- [ ] Proof real UI at full resolution and store preview size: visible controls, labels, safe areas, dark/light consistency and no private documents, paths, accounts or credentials. Do not promise editing, AI generation, iOS annotations or unverified MAS features.
- [ ] Before upload, identify **platform + 1.0.1 draft + en-US + device slot**. After upload, verify every displayed thumbnail and order 1–5 in that same slot. Count and ordering are separate checks; upload success alone does not prove placement.
- [ ] Record final uploaded-file hashes, portal counts/order and any rejected image. Leave missing groups pending. No optional video/app preview is claimed by this packet.

## Artwork, listing and final owner proof — pending

- [ ] Proof the assigned Halo Header on the actual device crops. The approved asset identity is confirmed, but approval is not Chris's crop acceptance for this new version.
- [ ] Proof the new 3:2 Search Results adaptation and its eventual placement. Creative review was explicitly authorized and submitted; Apple reports **Waiting for Review**, with Recent Usage unused. Keep **submission**, **approval**, **assignment**, **visible placement** and final owner acceptance as separate states.
- [ ] Confirm the selected saved copy in each applicable draft and proof it before final app-build submission. Session 49's optional revision is deferred; synchronizing it is not required for this release pass.
- [ ] Read each platform's exact saved copy and reviewer instructions against its candidate. Mac review starts with **Try diagram showcase**, not iPhone Files/share-sheet instructions. Preserve `2026 SpecDown` copyright and existing reviewer contact details.
- [ ] Verify live privacy, age/content rating, pricing/availability, support/marketing/privacy URLs and any current agreement/banner state. Do not invent owner/legal answers or change them merely to complete this checklist.
- [ ] Chris accepts the full packet and the exact intended production TestFlight builds before App Review. Any existing conditional submission authorization remains conditional on those gates; this proof preparation does not execute it.
- [ ] Keep public release manual and owner-controlled. Record each platform's submission and release independently if those later actions occur.

## Evidence references

- [Preparation metadata](preparation-status.json), [build status](build-status.json), [selected copy proof](copy/selected/proof.md), [copy selection](copy/selection.json), [optional later AI-workflow proposal](copy/proof.md), [artwork manifest](artwork/manifest.json), and [current screenshot manifest](screenshots/manifest.json).
- Canonical `ios/DerivedData/store-asset-audit-20261101/`: historical `ios-draft-copy-verification.json` and `mac-draft-copy-verification.json`; `halo-assignment-confirmed.txt/.png`; historical `halo-search-draft.txt/.png`; current `halo-search-review-submitted.txt/.png` and `halo-search-waiting-for-review.txt/.png`; local browser proof captures. The current Search evidence records only the creative asset's review submission, not an app-build submission.
- Historical canonical `ios/DerivedData/release-proof-20261101/ios-device-1.0.1-229/final-b9e5472/manifest.json` and `mac/final-b9e5472/manifest.json`: exact final-source unsigned artifact verification; hashes are recorded in [build status](build-status.json).
- Historical 229 signed evidence: `signing/ios229/runs/production-229-b9e5472-20261101/archive-independent-verification.json` and `ipa-independent-verification.json`; `signing/mac229/FINAL-INDEPENDENT-GATE.json` and `independent-store-review.json`, under the same release-proof evidence directory. Exact delivery-file and evidence hashes are in [build status](build-status.json).
- Canonical `ios/DerivedData/release-proof-20261101/integration-version-independent-review.json`: reviewed source union and version stamp; no native artifact claim.
- Canonical `ios/DerivedData/release-proof-20261101/recovery-ui/`: exact renderer/CSS copies and synthetic action harness; no native authority claim.
- Historical 229 delivery evidence in `ios/DerivedData/store-asset-audit-20261101/`: `ios229-transporter-delivered.json/.png`, `ios229-owner-testflight.txt/.png` (Apple build `5b231c50-ceb7-4883-b1c3-189765832828`, Owner only, saved What to Test), and `mac229-transporter-delivered.json/.png` (initial processing record). `mac229-owner-testflight.txt/.png` confirms Mac 229 Owner-only, one internal tester and zero individuals; parent recorded build ID `67638394-ae7d-40a7-a160-549087fb95c3`. Its What to Test field remains blank; the attempted optional relabeling was rejected by automatic approval review before any write. Earlier saved iOS release-candidate wording is superseded locally by WK-34, not edited in Apple. Delivery is separate from App Review.
- Scoped local Mac development runtime: `ios/DerivedData/release-proof-20261101/mac-runtime-229/runtime-result.json/.md`. The adjacent `folder-close-audit.md` preserves the original future-backlog audit. Chris subsequently made WK-34 (sheet row 38) required for this release; its old priority text is superseded, with source now implemented and independently reviewed in Session 53, aligned to 230 in Session 54, and staged in Session 55. Twelve scoped unsigned native UI cases now pass; provisioned sandbox, Intel and physical TestFlight acceptance of 230 remain pending.

- Current build-230 evidence: `ios/DerivedData/release-230-20261101/{author,independent,promotion,native}/`; Close Folder feature and browser evidence: `ios/DerivedData/close-folder-20261101/`. Exact current hashes are bound in the proof metadata and Session 55.
