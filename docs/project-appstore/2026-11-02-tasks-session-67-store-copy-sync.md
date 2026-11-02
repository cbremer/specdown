# Session 67: Approved copy for the Apple submission

Date: 2026-11-02. Copy extraction and local preparation only.

## Owner direction and current selection

Chris approved the final proposal and requested that all App Store Connect copy
be updated before submission. He then clarified that his earlier passing checks
were on **build 228**, not 230. The initial attribution of that report to both
production 230 builds is superseded. **Mac 230 acceptance is pending after the
TestFlight update from installed 228; iOS 230 exact-build acceptance is
unconfirmed.** Do not use the earlier report to clear the submission gate or
infer a per-device matrix or screenshot approval. The copy approval is unchanged.

The [submission packet](submission-copy-2026-11-02/README.md) selects the exact
approved HTML at `e8dd3cb95a41c19ad10c14e6f1efba3287866625`, SHA-256
`a56a892d8a1968f54d858a8053689932a8888d45a07b87ab56cbd9f2f386bafd`.
It supersedes Session 51's retained saved-copy selection and the old
`release-proof-2026-11-01/copy/selection.json` for this Apple update. Those files,
the older optional copy and the gallery remain preserved historical proof.
Use the new packet for synchronization; do not take values from the old gallery.

## Deliverables and boundaries

- One complete JSON packet plus shared and per-platform JSON fields.
- Exact per-field plain-text files for the forms, without trailing newlines.
- Human-readable proof, exact before/after diff and validated plain-text limits.
- Literal App Review notes, TestFlight description and platform What to Test.
- Approved screenshot-caption references with the earlier capture references
  retained. Mac image 3's subtitle and iPad image 4's title differ from the old
  selected caption text; no screenshot pixels, upload or placement changed.
- A deterministic, standard-library-only extractor pinned to the approved Git
  blob, with a read-only check mode and a hash manifest.

The target remains production record **6822086808**, bundle ID
`com.mosaicpando.specdown`, both platforms **1.0.1 (230)** and English (U.S.).
Name, subtitle, URLs and copyright retain the approved values. Mac What’s New is
absent because the first Mac release has no approved field; historical reference
text is not silently submitted. Private contacts, account settings, age-rating
and privacy-label answers are outside this copy packet.

The canonical checkout, build 230, signed artifacts, approved HTML and artwork
remain unchanged. This task does not rebuild, sign, upload, change Apple fields,
submit to App Review or publish the public website. Parent-owned portal work uses
the existing Comet session, performs exact readback and keeps authentication
recovery owner-led. Website copy is handled separately.

## Portal progress reported by the coordinating session

On November 2, the coordinating session saved the approved promotional text,
description, keywords and App Review notes in both iOS and Mac version drafts,
and saved iOS What’s New. Production build **230** is attached to both drafts.
The shared name and subtitle already matched the approved packet exactly.

**TestFlight description and What to Test are still pending synchronization.**
Exact-build 230 acceptance is also still pending as described above; the earlier
228 checks do not satisfy that gate. No App Review submission or public release
is recorded by this checkpoint. The copy extractor's checks are separate from
these reported portal actions and do not imply additional shared-field,
account-setting, screenshot or regulatory readback.

## Verification

Local extraction validates the exact source identity, paragraph/list conversion,
per-field JSON/text equality, keyword and field limits, no Mac What’s New output,
and preservation of the old selected files. The full plain-text descriptions
are 1,473 characters for iOS and 1,718 for Mac; promotional text is 158/165;
keywords are 98/93 ASCII bytes. Reviewer notes are 1,647/1,975 UTF-8 bytes.
These counts include serialized paragraph breaks and bullets, so they differ
from the earlier whitespace-collapsed HTML counts without changing wording.

The deterministic regeneration and read-only check pass. Full 1,371 tests in 78
suites, lint, typecheck, documentation formatting and diff checks pass. The
previous passing report remains applicable to the unchanged form values after
the acceptance-history correction.

Independent review used a separate jsdom extraction of the exact approved Git
blob and passed all literal field, generated-file, limit and preservation checks.
Portal synchronization and readback remain separate from extraction validation.
The reported saved fields are listed above; no completion is inferred for the
remaining TestFlight text, exact-build acceptance or App Review submission.

## Rebase-merge portability

Integration review found that rebase merging can replace the approved proposal's
commit ID. A main-only clean clone may therefore lack the original `e8dd3cb`
object even though its approved source bytes have landed. The extractor now
accepts checked-in proposal and historical baseline files as a fallback only
when they match the five pinned SHA-256 hashes; missing or altered inputs fail
closed. It retains the original approval revision as provenance and makes no
network request or unpinned current-branch assumption.

This changes the helper and its hash in `manifest.json`, with all 40 other
generated outputs preserved byte-for-byte. The local main-only clone and tamper
checks are recorded with the integration evidence; they do not imply Apple or
runtime validation.
