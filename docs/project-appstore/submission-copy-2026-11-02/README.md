# Approved Apple submission copy

Use this packet for the **production SpecDown 1.0.1 (230)** copy update on iOS
and Mac, record **6822086808**, bundle ID `com.mosaicpando.specdown`, locale
**en-US**. It is extracted from the owner-approved proposal at
`e8dd3cb95a41c19ad10c14e6f1efba3287866625`.

This packet **supersedes the Session 51 retained selection** for this Apple
update. The old `release-proof-2026-11-01/copy/selected/` files and selection
manifest remain unchanged historical evidence; they are not the form values to
apply now. The earlier optional Session 49 copy is also historical.

## Form values

- [packet.json](packet.json): complete fields, target and provenance.
- [shared-en-US.json](shared-en-US.json): name, subtitle, support/marketing/privacy
  URLs and copyright. Preserve current private contacts and account settings.
- [ios-en-US.json](ios-en-US.json) and [mac-en-US.json](mac-en-US.json): literal
  platform fields, App Review notes, TestFlight description and What to Test.
- [fields/shared](fields/shared), [fields/ios](fields/ios) and
  [fields/mac](fields/mac): one exact `.txt` value per form field, with no trailing
  newline. Names/URLs are deliberately repeated in platform files for convenience.
- [PROOF.md](PROOF.md): all field text in a readable document.
- [DIFF.md](DIFF.md) and [field-diff.json](field-diff.json): summary and exact
  before/after values against retained selected copy, not a live portal readback.
- [screenshot-captions.json](screenshot-captions.json): approved caption text and
  retained capture references. This is not an instruction to upload or replace
  screenshots. No pixels or placement changed.

**Mac What’s New is intentionally absent.** This is the first Mac release, and
the approved proposal contains no such field. Do not paste the old reference
text or clear an unrelated field. iOS What’s New is included.

The new copy retains the selected name/subtitle/URLs/copyright, updates both
platforms' promotional text, descriptions, keywords and reviewer notes, and
simplifies iOS What’s New. TestFlight description and What to Test have no
retained selected-file baseline; use the actual form readback when synchronizing.

## Acceptance and synchronization

On November 2, Chris clarified that his earlier passing checks were on **build
228**, not 230. The initial statement was mistakenly attributed to both
production 230 builds and is superseded. **Mac 230 acceptance is pending after
updating from the installed 228; iOS 230 exact-build acceptance is unconfirmed.**
Do not use the earlier statement to clear the submission gate. No device matrix
or screenshot approval is inferred. The copy itself remains approved.

The parent handles the authorized App Store Connect synchronization, exact field
readback, build selection and App Review submission through the existing Comet
session. This extraction task performed none of those actions. Public release
remains a separate owner-controlled step. Website copy is handled separately.

At the November 2 checkpoint, the coordinating session reports the approved
promotional text, description, keywords and App Review notes saved in both
version drafts, iOS What’s New saved, and build 230 attached to both platforms.
Shared name and subtitle already match the approved values. **TestFlight
description and What to Test still need synchronization.** Exact-build acceptance
and App Review submission remain pending; the earlier 228 checks do not clear
those gates.

Account settings, private contacts, age-rating answers, privacy labels and other
regulatory answers are excluded. The packet's public policy URL is a copy field;
it is not a privacy-questionnaire answer.

## Reproduce and verify

From the repository root:

```sh
python3 docs/project-appstore/submission-copy-2026-11-02/extract-copy.py --check
```

The extractor first reads the original approved Git revision. Rebase merging
can replace that commit ID, so a main-only clone may not contain it. If the
original object or the Git executable is unavailable, the extractor reads the checked-in proposal and
four preserved historical baseline files, accepting them only when all match
their pinned SHA-256 hashes. Changed or missing snapshots fail closed; no
network lookup or unpinned current-branch substitution occurs. The original
approval revision remains the provenance recorded in the packet.

Later working-tree edits cannot silently change this packet. It preserves wording, punctuation and
heading case, converts paragraphs to blank-line-separated plain text, and adds
only structural bullet/number markers. `--write` regenerates the same 41 outputs;
the default and `--check` do not write. [manifest.json](manifest.json) binds those
outputs and the extraction script. [validation.json](validation.json) records
the actual character/byte counts of the plain text, including line breaks.

The portability correction changes only the extraction helper and its manifest
binding. All 40 other generated outputs retain their exact approved bytes.

Apple references: [platform fields and limits](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)
and [TestFlight information](https://developer.apple.com/help/app-store-connect/test-a-beta-version/provide-test-information/).
The 4,000-byte budgets on TestFlight text are conservative local checks; they
are not a claim that the referenced help page specifies that byte limit.
