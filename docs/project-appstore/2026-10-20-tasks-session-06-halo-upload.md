# Session 06: Halo artwork upload

Date: October 20, 2026

## Scope

Finish the owner-selected Brand Halo artwork, upload it into App Store Connect Asset Library, and inspect Apple's device previews. The owner explicitly authorized the upload. Preserve the first app version's existing review submission.

## Progress

- [x] Confirm signed-in Chrome can now access Asset Library and its creative-asset file chooser.
- [x] Recheck Apple's creative-asset dimensions and asset review constraints.
- [x] Generate a refined Halo source with the built-in image-generation tool.
- [x] Export exact production dimensions and validate composition, format, and opacity.
- [x] Upload the asset and verify processing.
- [x] Inspect device previews and placement editability; actual Halo crop validation remains blocked by assignment being disabled during review.

The refined source is `assets/2026-10-20-header-mocks/03-brand-halo-refined-source.png` (1915 × 821, opaque PNG). The generator again returned a smaller image than requested. The owner explicitly approved local image processing and upload, then requested the Reading Companion upscale too.

## Final exports and validation

Both exports use Pillow Lanczos resizing to 3840 × 1646, RGB PNG with an embedded sRGB profile and no alpha. Originals are preserved. This is interpolation, not newly generated high-resolution detail.

- `assets/2026-10-20-header-mocks/specdown-brand-halo-header-3840x1646.png`: 2,273,904 bytes; SHA-256 `d95704918b1076541af1186b0b860a05fd6f2c893ffab1b6cd81c98310c357dd`. Independent read-only pixel analysis puts the emblem approximately at x1643–2186/y497–1034, within the measured header safe area x1097–2743/y493–1154. Upper margin is tight, so device preview is still required.
- `assets/2026-10-20-header-mocks/specdown-reading-companion-header-3840x1646.png`: 3,211,638 bytes; SHA-256 `241049bfd34f84ac447520095a5b43586c1bb558a1293f5325ca05646dafe7ee`. Upscale only, as requested; composition unchanged and not yet validated for safe-area cropping.

## Upload result

The first attempt stopped at the Chrome extension's requirement to enable "Allow access to file URLs." The owner enabled it and explicitly requested a retry. The retry succeeded: the final Halo PNG is saved in Asset Library as **SpecDown — Brand Halo Header**, with status **Prepare for Submission**. Apple identifies it as **Image Asset (3840 x 1646px)**, compatible with **Product Page Header**. Recent usage says **This asset hasn't been used yet**. The library count increased from 30 to 31.

- Asset ID: `fe000019-6a0c-8898-8029-cae241fa2fe2`
- [Saved asset in App Store Connect](https://appstoreconnect.apple.com/apps/6822086808/distribution/asset-library/assets/fe000019-6a0c-8898-8029-cae241fa2fe2)
- Successful upload screenshot (retained privately; see publication inventory)

The owner subsequently requested uploading Reading Companion so both options are available. Its existing 3840 × 1646 export was uploaded successfully and saved as **SpecDown — Reading Companion Header**, status **Prepare for Submission**. Apple recognizes **Image Asset (3840 x 1646px)**, compatible with **Product Page Header**, with no usage yet. Asset Library now contains 32 assets, including both named headers. No review submission or public release was changed.

- Reading Companion asset ID: `eac00019-6a0c-8898-800b-f41228d2c643`
- [Saved Reading Companion asset](https://appstoreconnect.apple.com/apps/6822086808/distribution/asset-library/assets/eac00019-6a0c-8898-800b-f41228d2c643)
- Both header options in Asset Library (retained privately; see publication inventory)

Apple's Device Preview was opened and inspected. It shows the current app page without a header and offers no control to preview the unassigned library image. The version page still says **No header asset added**, with the header DropZone and Save disabled while version 1.0 is **Waiting for Review**. Consequently, upload is complete but assignment and actual device crop validation remain pending. Device Preview screenshot (retained privately; see publication inventory).

## Generation prompt

Use case: precise-object-edit. Edit target: the attached selected SpecDown Brand Halo artwork. Deliver the final App Store product-page header, exactly 3840 pixels wide by 1646 pixels high, opaque PNG, full-resolution production export. Preserve the existing deep navy background, sweeping cyan-left and warm amber-right halo arcs, lighting, palette, and the recognizable central circular face emblem: gradient ring, amber diamond above two cyan closed-eye arcs. Change only the central emblem scale: make the complete emblem approximately 560 px tall on the 1646 px canvas (34% of image height), horizontally centered at x=1920 and vertically centered at y=823. Every part of the central emblem must fit within x=1097–2743 and y=493–1154. This is a subtle safe-area adjustment of the selected art, not a redesign. Keep large surrounding halo arcs and generous dark negative space. Crisp smooth geometry; no text, no app icon tile, no device mockup, no guides, no border, no watermark, no transparency. Return the actual 3840×1646 asset, not a reduced preview.

## Review constraints

Live verification: version 1.0 still shows Waiting for Review. The Header panel says No header asset added, its DropZone control is disabled, and Save is disabled. Asset Library remains accessible. Assignment is currently locked; uploading into the library does not establish inclusion in the pending review.

The final composition source is `assets/2026-10-20-header-mocks/04-brand-halo-safe-area-source.png`, generated with a second focused edit to reduce the central emblem to 75% of its previous diameter. The exact export was produced after the owner's explicit permission for local image processing.

### Safe-area edit prompt

Use case: precise-object-edit. Edit target is the supplied SpecDown Halo banner. Make ONE precise change only: reduce the entire central emblem (ring, amber diamond and cyan eyes together) to 75% of its current diameter and place it at the exact horizontal and vertical center of the canvas. It is currently too large. The complete circular emblem should occupy only about 34% of total image height, with generous empty navy around it. Keep the large background halo arcs, cyan on the left, amber on the right, and all other background lighting/color/composition unchanged. Preserve the emblem's exact design and crisp geometry. No text, no border, no devices, no guides, no transparency. Maintain the existing wide canvas aspect ratio.

Apple permits uploading assets before submitting them. An app with no approved version must submit its assets with its first app version; Add for Review concerns draft submissions and does not establish that an active Waiting for Review submission can be amended. Do not withdraw the app to add optional artwork.

- https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications
- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-assets-from-asset-library
- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets
