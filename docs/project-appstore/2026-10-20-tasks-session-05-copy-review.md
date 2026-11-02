# Session 05: App Store copy review and Halo selection

Date: October 20, 2026

## Scope

Collect saved listing and related marketing copy in an editable document. Propose AI productivity positioning centered on desktop Markdown viewing and automatic refresh after a file is saved. The owner selected Brand halo and authorized uploading that artwork.

## Deliverables

- Editable Google Doc: SpecDown App Store Copy Review (owner-private document; link omitted)
- [Word copy](copy-review/2026-10-20-app-store-copy-review-public.md)
- [Proposed field text](copy-review/proposed-copy.json), separate from existing listing metadata.
- [Selected Halo concept and artwork requirements](assets/2026-10-20-header-mocks/README.md).

The document preserves saved iOS and Mac draft text, includes shared app fields, screenshot captions, review notes, URLs and website messaging, and separates proposals from baseline copy. It records character/byte limits and remaining live-capture gaps. Proposed subtitle: “Markdown for your AI workflow.” Desktop proposals explain save → automatic preview refresh → review → next iteration. iOS proposals focus on reviewing saved documents without promising desktop hot reload. Neither implies built-in AI generation.

## Verification

- Source inventory: `app-store/metadata/en-US/ios.json`, `mac.json`, review notes, screenshot asset index, and current local website HTML.
- Original metadata remains unchanged. These repository drafts are not a fresh App Store Connect export; live fields and any additional populated localizations, review contacts, TestFlight fields, custom pages or events remain unverified.
- Rendered and visually inspected all 11 Word pages. Sanitized the title style for Google Docs conversion.
- Imported into the existing ChatGPT Drive folder as a native Google Doc. Read back its title, document ID, 23,512 text characters, six tables, section headings and core proposal text.
- Independent source review found no blocking copy accuracy issue. Signed Mac App Store live-refresh QA remains a release-claim check, distinct from source evidence.

## Upload status and account boundary

The owner signed in manually in Chrome. The existing tab was located at the app's Asset Library, but the browser tool returned “Host access is restricted by policy.” This is an access-policy block, not an observed Apple authentication error. No login attempt, account edit, asset upload, submission or publication was performed.

Halo remains a 1916 × 821 concept. Required header export is 3840 × 1646 and needs safe-area refinement plus Apple's Device Preview. Do not label this file upload-ready.

Apple's workflow separates uploading from assigning a placement: upload creative artwork to Asset Library, then choose it through Header and Search Results → Browse Assets and save. A universal asset may be selected for both placements. Assigned assets are included automatically when the corresponding app version is submitted; uploading alone does not publish them.

## Next pass

1. Compare baseline fields against the live account when authorized browser access is available.
2. Edit the proposed positioning together in the Google Doc.
3. Produce the selected Halo at final dimensions and safe-area composition, then upload, assign and check Device Preview.

No application code changed, no tests/builds needed, and no commit or push was performed.
