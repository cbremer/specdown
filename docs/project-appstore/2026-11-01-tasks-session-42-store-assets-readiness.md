# Session 42: Store assets and listing readiness

**Date:** 2026-11-01. **Result:** not all images and listing fields are ready.
Read-only live inspection used the existing signed-in **Comet** session for
production SpecDown record **6822086808**, English (U.S.). No login retry,
browser/profile switch, asset upload, assignment, save, review submission or
release occurred.

## Current App Store Connect state

| Area | Live result | Remaining work |
| --- | --- | --- |
| iOS 1.0 | Ready for Distribution; five iPhone screenshots and five iPad 13-inch screenshots assigned | Review continued accuracy when preparing the next production version |
| iPhone Duo | Screenshot slot empty | Prepare and validate screenshots from the intended candidate |
| Brand Halo header | **Approved**, 3840 × 1646; Recent Usage says it has not been used | Assign the owner-selected header and verify actual device cropping |
| Reading Companion header | **Approved**, 3840 × 1646; Recent Usage says it has not been used | Retain as an approved alternative; crop validation remains separate |
| iOS header placement | **0 of 1 Header Asset** | Library approval has not assigned a header to the product page |
| macOS 1.0.1 draft | Prepare for Submission; **0 of 10 screenshots**, 0 of 3 app previews | Prepare current Mac screenshots and upload/assign them; preview video is a separate enhancement |
| Mac description | Empty | Write and review Mac-specific description |
| Mac promotional text | Empty | Optional copy enhancement |
| Mac App Review notes | Inherited iPhone/iPad instructions, including Files/share-sheet and iOS ATS discussion | Replace with accurate Mac sandbox/open/reopen/diagram review instructions |
| Mac draft build | No build selected; Add Build is shown | Attach the exact accepted Mac TestFlight build after acceptance |
| Mac release setting | Manual release selected | Preserve owner-controlled release |

Mac keywords, support URL, marketing URL, copyright and review contact fields
are populated. No sign-in-required checkbox is selected. The support and
marketing URLs point to `specdown.mosaicpando.com`. This pass does not establish
mailbox delivery, all store-country/legal settings, privacy-label accuracy or
full TestFlight acceptance.

The two header approvals supersede the older October 31 tracker statements
that they were waiting for review. Do not upload duplicate copies. The separate
Beta TestFlight record was outside this production-listing audit.

## Existing local artwork

Independent read-only inventory verified all 20 screenshot PNG hashes and
dimensions against `app-store/screenshots/asset-index.json`:

- `app-store/screenshots/iphone63/en-US/`: five at 1206 × 2622.
- `app-store/screenshots/iphone/en-US/`: five at 1320 × 2868.
- `app-store/screenshots/ipad/en-US/`: five at 2064 × 2752.
- `app-store/screenshots/mac/en-US/`: five at 2880 × 1800.

These are RGB/no-alpha files, but their index labels them pre-freeze drafts
from `23016b4` / v0.0.199. The local README has older conflicting provenance
(`2b5c835` / v0.0.194). They are not established screenshots of current Mac
TestFlight source `eed62c9`. All 20 indexed raw-capture basenames were absent
from the inspected `app-store`, `ios` and `docs` trees. Recapture or explicitly
verify current appearance before using these as final assets.

Both final header exports in
`docs/project-appstore/assets/2026-10-20-header-mocks/` match Session 06 hashes,
dimensions and opaque sRGB format. Sources and prompts are preserved. Actual
product-page cropping remains unverified despite Apple approval.

`app-store/metadata/en-US/mac.json` still includes a literal
`[VERIFY IN SANDBOX BEFORE KEEPING]` placeholder. Do not paste that draft into
the listing unchanged. No local preview video or separate Search Results
creative export was found. English (U.S.) is the only saved asset/copy locale.

## Next preparation

1. Complete current Mac TestFlight acceptance and capture representative Mac
   screenshots from that exact app, using synthetic documents only.
2. Prepare Mac description and accurate review notes, then upload/assign the
   reviewed screenshots and attach the accepted build.
3. Assign the existing approved Halo header and check device previews when
   performing the authorized listing-edit step; keep Companion as an alternative.
4. Prepare Duo screenshots for the next iOS candidate separately.
5. Perform final listing/privacy/availability checks before App Review; keep
   public release manual.

WK-09/WK-10/WK-12 reflect these findings. WK-16's stale owner-signing setup
status is reconciled to completed, backed by Sessions 35–36 and the actual
signed Mac TestFlight delivery in Session 40. Off-device credential-backup
verification is a separate historical follow-up, not inferred complete here.

Read-only portal evidence is retained in
`ios/DerivedData/store-asset-audit-20261101/`: Mac listing, iOS iPhone/iPad/Duo
panels, header assignment, Asset Library approval and both assets' Recent Usage.
Review phone/email values were omitted from retained text snapshots.

Root phone source stays `729258b`; no application code, images, signing settings
or uploaded builds changed. No build/test rerun was needed for this inventory.

## Follow-up: iOS readiness and coordinated releases

A subsequent read-only check in the same Comet session confirmed the latest
production iOS upload is still **1.0 (11), Complete**. The separate SpecDown Beta
record **6829391032** shows **1.0.1 (228), Internal, Testing, Owner**. New Beta
physical acceptance has not been reported; the earlier Dev phone checks do not
replace it. A production `SpecDown / Release` archive and standard distribution
upload, followed by acceptance of that exact production TestFlight build on
iPhone/iPad, remain before App Review. The existing internal-only Beta upload
cannot be promoted across app records or used as the production submission.

Apple's [submission overview](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review)
confirms each platform's app version is submitted separately and its status
does not determine another platform's status. Our iPhone/iPad app is one iOS
submission; Mac is a separate macOS submission in the same production record.
Both may retain the owner-selected marketing version **1.0.1**.

Recommended coordination: finish each platform's testing and metadata, submit
each separately when ready, and use manual release if a joint launch is wanted.
Apple's [release controls](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option/)
are platform-specific, so each approved version must be released explicitly;
simultaneous public availability is not guaranteed. This is a recommendation,
not a new owner instruction to submit or release either platform.

Additional evidence: `production-ios-uploads.txt` and `beta-ios-status.txt` in
the same audit directory. No Apple mutation occurred.
