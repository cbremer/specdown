# Session 70: iPhone Duo artwork for submitted build 230

Date: November 2, 2026.

## Scope and owner approval

Chris requested Duo screenshots for the existing production iOS **1.0.1 (230)**
submission, kept new builds on hold, and approved these exact five final images.
He separately authorized removing and resubmitting only the iOS submission with
those images and the same build 230. Mac review and manual release remain
separate. This session does not authorize or record a new build or public release.

## Exact capture and durable packet

The retained simulator app was verified against frozen source
`9d27fc1a6961e29c86def43cee17c6fbb7d66db1`: production bundle identity,
version 1.0.1, build 230, 117 app files matching the earlier simulator inventory,
and 110 shared web files matching the simulator, submitted archive and exported
IPA. No new simulator or device binary was built. The images are real simulator
captures, not physical Duo acceptance evidence.

The normal native Files picker opened approved synthetic demo documents. Five
inner portrait views at **2007 × 2853** show Preview, centered fullscreen diagram,
Raw, Find with its keyboard dismissed, and native/web Dark Mode. The dedicated QA
simulator was restored to Light and shut down after capture. Initial landing,
inactive black-display and earlier mixed-appearance captures were preserved in
local evidence but excluded from the selected set.

The [versioned Duo packet](../../app-store/release-assets/1.0.1-230/iphone-duo/README.md)
retains the exact five raw and final PNG pairs plus the owner-reviewed contact
sheet, sanitized provenance, manifest and portable verifier. It adds to the
existing Mac packet and historical assets without replacing them. Public files
exclude private host paths, simulator IDs, account screenshots and credentials.
The approved caption source remains `e8dd3cb`; all five literal title/subtitle
pairs match `submission-copy-2026-11-02/screenshot-captions.json`.

## Validation

- All five final PNGs are opaque RGB 2007 × 2853, without metadata.
- Raw and final SHA-256 values match the exact owner-reviewed proof.
- Read-only reproduction with Pillow 12.2.0 and the recorded system font passes
  exact pixel and PNG-byte comparisons for all five images.
- The verifier binds the existing compositor, font, captions, demo documents,
  provenance and contact sheet; existing or in-packet output directories are
  rejected before any write.
- Independent artifact review passed: all 15 public packet files are bound,
  all 11 retained images equal the approved proof, and independent in-memory
  reconstruction reproduces all five PNGs and the review JPEG exactly. No private
  metadata or visible private content was found.
- The original archive checks passed: 1,371 tests in 78 suites, lint with zero
  warnings, and typecheck. These historical counts describe the original archive
  base, not later main rebases. The temporary dependency link was removed afterward.
- No app source, versions, signed binaries, owner signing settings or canonical
  checkout changed. No app build ran for this asset archive.

During the later archive housekeeping review, the verifier gained explicit
caption-count, compositor-loader and output-symlink guards. Eight focused failure
checks pass, and all five approved images still reproduce exactly. Repository
checks on that newer main base passed 1,440 tests in 80 suites, lint and typecheck.
These later checks do not change the original capture or Apple checkpoint below.

## Final Apple checkpoint

Production iOS **1.0.1 (230)** was resubmitted on **November 2, 2026 at
8:32 AM Pacific Standard Time** and Apple shows **Waiting for Review**. The new
submission is `95e90789-90d9-43b5-a370-75f62050b8bf`, selecting the same existing
build `adb33253-0916-40b0-9538-048d8def946e`. All five approved Duo images finished
processing and were saved in order **01, 02, 03, 04, 05**. Manual release remains
selected. The earlier iOS submission in Session 69 is historical and was canceled
only to add these images; no new binary was uploaded.

The Mac submission `d2bdaeb9-4fe6-4dda-9113-89015272f9d4` remains **Waiting for
Review**, with its original November 2, 12:48 AM submission unchanged. Existing
approved iPhone/iPad images and their captions remain. No app approval or public
release is claimed.

The first upload of image 01 stayed in processing. Chris removed only that stuck
image; the exact approved PNG was reuploaded at 16:24:59 UTC and processed in
about a minute. The five-image set was then restored to the approved order and
verified before resubmission. **Remove All was not used.** This recovery changed
no artwork bytes, other screenshot slots, build selection or Mac submission.

The private portal snapshots remain in local ignored release evidence, outside
this public asset packet. The following SHA-256 values bind the final observations
and independent artifact review without publishing account screenshots:

| Evidence                           | SHA-256                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| Duo packet manifest                | `4b7c55fe8765666b277b85a3c99f576d09d57ade9c18251dba97d1cea2b384ee` |
| Independent portable packet review | `e396386a824c0587b58e511a9b17631b3a64cf982135aca5ebc3c4f1d7b6ad83` |
| Required checks report             | `f2a9bfed878f04480ca6fc592dea5ab5ba4a47105adccb217e18c452548fad2a` |
| iOS submission detail text         | `b8bff6d86fbf28def00fdd4b94a10b0de349081fc2d2f6bb967067eed745c99a` |
| iOS submission detail screenshot   | `9d19a12e61c66b4907c5c471586cab6e3881e40022a23db7409d90458045d1cb` |
| Both review queues text            | `cf9ffc855c47b3883072cfddd7cef79bed1c6bd276f3a90166fb745b0023e873` |
| Saved five-image order text        | `9ce7a4de38c1f5b5b96977b4b2cd8cb1dad38cb755ac5389c5ad868d20ef2f7a` |
| Final Duo listing screenshot       | `6e2d8f8ecec743cf3dd933c7def7455e3550e09c820800c553d1e7c509987a06` |
