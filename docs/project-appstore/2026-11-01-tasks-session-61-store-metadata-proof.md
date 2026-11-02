# Session 61: App Store metadata in the copy proof

Date: 2026-11-01. Documentation-only continuation of Session 60.

## Request and result

Chris requested the search metadata and behind-the-scenes App Store fields in the
same clean HTML proposal. [copy-proposal.html](copy-proposal.html) now includes the
shared listing fields, dated Store settings, production app identity, version and
build selection, artwork references, proposed App Review notes and TestFlight
instructions. Platform-specific review and testing instructions appear side by
side. Shared fields are shown once.

The original listing proposal, keywords, website, screenshot captions, support,
privacy and in-app wording are preserved. The page contains final proposed text
and explicit field statuses rather than an editorial change log. Unknown values
are not filled from assumptions. Reviewer names, phone numbers, email addresses,
credentials and private account evidence are not included.

## Provenance and limitations

- Session 43 records the November 1 Apple observations: categories Developer Tools
  and Productivity; global 4+ with regional exceptions; published Data Not
  Collected; US$0.00 and 175 available regions; standard Apple license; manual
  platform release. Detailed regional/questionnaire answers and the content-rights
  answer were not retained, so those remain to confirm.
- The retained selected copy establishes the language, URLs and newer copyright
  `2026 SpecDown`. It remains unchanged. The proposal does not save any Apple field.
- Production record `6822086808` / `com.mosaicpando.specdown` serves iOS and Mac.
  Historical SKU `specdown` is recorded in the October 20 public copy review,
  line 251; confirmation remains explicit. The separate Beta app is not a target.
- Version 1.0.1 / build 230 is the preparation target. Session 55 unsigned artifacts
  remain tied to source `28848a25b837c022918ccc1625b17af0fa9c80e1`, not later
  dependency merges. Final signed build selection and exact-build acceptance are
  still separate. Historical signed 229 TestFlight evidence is not relabeled.
- iOS minimum 16.0 and MAS minimum 13.0, plus non-exempt-encryption false, are
  declarations from the current source configurations. They are not a new portal
  export-compliance readback.
- Session 50 supersedes Session 43 for Search Results artwork: submitted and
  Waiting for Review, unused at that observation. The approved Halo Header's
  recorded placement is iOS 1.0.1 en-US. No Mac placement is invented.
- Updated App Review notes come from the retained copywriting proposal and include
  Link removal and Mac Close Folder. TestFlight description and What to Test are
  new proposed text. They do not claim saved notes or passing device acceptance.
- Private contact fields, privacy choices, accessibility declarations, app tags,
  trader details, applicable regulatory fields and phased-release settings are
  marked for confirmation where evidence is absent.

Public Apple references checked for field scope and limits:
[App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/),
[platform version information](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/),
and [App Store search](https://developer.apple.com/app-store/search/).
The name/subtitle/keywords are distinct from promotional text and reviewer notes;
this proof makes no promise about ranking or discovery performance.

## Validation

Validation evidence is retained in the ignored canonical
`ios/DerivedData/store-metadata-proof-20261101/` directory. Check the exact final
HTML hash and independent review before publishing this documentation change.
Full 1,371 tests in 78 suites, lint and typecheck passed. The proof is readable at
967-pixel desktop and 390-pixel phone widths; reviewer notes use two columns on
desktop and stack on mobile. All 25 links resolve locally where applicable. The
canonical checkout remains clean; all 548 protected-file hashes match the baseline.
Name, subtitle, promotional text, keywords and descriptions fit the field limits.
Independent review checked exact original-copy preservation, artwork hashes,
review-note source text, statuses and contact privacy. It identified and corrected
one testing-instruction ambiguity: Stop reopening is exercised on an unavailable
saved startup file, not every Open Recent failure. No native build or packaging
is necessary for this documentation-only change.

The canonical phone checkout, generated Xcode project, selected Store-copy JSON,
version fields, signed/unsigned artifacts, owner artwork and credentials remain
untouched. No Apple account operation, upload, submission or release is part of
this task. No version bump or release tag is authorized by this proof update.
