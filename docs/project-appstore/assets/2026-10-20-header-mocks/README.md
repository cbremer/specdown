# SpecDown App Store artwork concepts

October 20, 2026. Two logo-led concepts generated with the built-in imagegen tool and reviewed visually.

**Owner selection: Brand halo.** The owner authorized local image processing and upload. After the owner enabled the Chrome extension's file access, the Halo export was successfully uploaded and saved as **SpecDown — Brand Halo Header**, status **Prepare for Submission**. At the owner's subsequent request, **SpecDown — Reading Companion Header** was also uploaded and saved with the same status so both options are available. Neither is assigned to the app page or submitted for review. Final sized exports are saved below.

## Final sized exports

| File | Preparation | Status |
| --- | --- | --- |
| [Brand halo — 3840 × 1646](specdown-brand-halo-header-3840x1646.png) | Refined emblem size, then local Lanczos upscale; opaque RGB PNG with embedded sRGB. | Uploaded successfully; Prepare for Submission. Local safe-area check passed with a tight upper margin. Assignment is disabled during app review, so actual device crop validation remains pending. |
| [Reading companion — 3840 × 1646](specdown-reading-companion-header-3840x1646.png) | Owner-requested upscale of the original concept; opaque RGB PNG with embedded sRGB. | Uploaded successfully; Prepare for Submission. Composition unchanged; safe-area adjustment and device preview needed before placement. |

Both are resized from generated source images; upscaling does not add original detail. [Generation prompts, authorization, validation, and upload record](../../2026-10-20-tasks-session-06-halo-upload.md).

| Concept | File | Intent |
| --- | --- | --- |
| Brand halo | [01-brand-halo.png](01-brand-halo.png) | Extends the familiar ring, cyan eyes and amber diamond into a wide brand environment. |
| Reading companion | [02-reading-companion.png](02-reading-companion.png) | Alternative concept pairing the familiar logo with a document and flowchart to explain the app's purpose. |

Both files are **1916 × 821 opaque PNG concept mockups**. They are not upload-ready exports. They use the existing local primary iOS icon as an identity reference; no claim is made about the currently uploaded App Store icon. [Exact generation prompts](PROMPTS.md).

## What Apple provides

The version-page location is **Product Page Information → Header and Search Results**, with separate Header and Search Results placements. These optional creative assets appear in iOS/iPadOS 27 and later. They are separate from screenshots and editorial featuring artwork. A universal asset can be reused for both placements. [Placement documentation](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets).

| Placement | Required image dimensions | Format |
| --- | --- | --- |
| Header | 3840 × 1646 | JPG/JPEG/PNG |
| Search results | 3:2; minimum 1920 × 1280, maximum 3840 × 2560 | JPG/JPEG/PNG |
| Universal for both | 5244 × 2950 | PNG |

Apple prohibits alpha channels and transparency in these images. [Specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications).

## Apple examples

Apple's October 5 announcement describes **The Coast** using an illustrated lighthouse and cargo ship for its header, and **Ridge Explorer** using a trail map with a short phrase in search results. These demonstrate both brand storytelling and showing practical content. [Announcement and example](https://developer.apple.com/news/?id=ljpl7kyn).

![Apple's illustrative header and search example](https://devimages-cdn.apple.com/wwdc-services/articles/images/E79334BA-EE3D-4655-9217-251929306509/2048.jpeg)

Apple advises a single clear idea, cohesive visual identity, and central focal artwork within the template safe areas. Text is allowed; these drafts omit it for simplicity and localization. [Best practices and downloadable templates](https://developer.apple.com/app-store/asset-best-practices/).

## Before production use

- Produce the exact dimensions for the selected placement; these preview images are approximately half the required header resolution. Enlarging them alone does not add original detail.
- Reduce and center the main motif to fit Apple's safe area. In the inspected header PSD, the Art Safe Area layer spans approximately x=1097–2743, y=493–1154 on a 3840 × 1646 canvas. The current logo-led mockups extend above/below that region. Preserve the design idea while shrinking the focal group about one third for final composition.
- The universal template has a much tighter region, approximately x=1921–3323, y=660–1622 on 5244 × 2950, above the vertical center. Do not assume a header export will work as universal artwork.
- Those coordinates are measured PSD layer bounds including the outline, not a textual Apple guarantee of a device crop. Check Apple's Device Preview on iPhone/iPad and different orientations before choosing a placement.
- Check final logo geometry against the original source; generated treatments are concept interpretations.

[Header PSD](https://devimages-cdn.apple.com/design/resources/download/app-store/creative_assets-product_page_header_template-static.psd) · [Universal PSD](https://devimages-cdn.apple.com/design/resources/download/app-store/creative_assets-universal_asset_template-static.psd).

The earlier browser and file-access restrictions are resolved. [The saved Halo asset](https://appstoreconnect.apple.com/apps/6822086808/distribution/asset-library/assets/fe000019-6a0c-8898-8029-cae241fa2fe2) is recognized as a 3840 × 1646 Product Page Header image and has no usage yet. Upload evidence (retained privately; see publication inventory).

[The saved Reading Companion asset](https://appstoreconnect.apple.com/apps/6822086808/distribution/asset-library/assets/eac00019-6a0c-8898-800b-f41228d2c643) is also recognized as a 3840 × 1646 Product Page Header image and has no usage yet. Both options in Asset Library (retained privately; see publication inventory).

Live verification in Chrome shows version 1.0 still Waiting for Review, with its header DropZone and Save disabled. Device Preview displays the current page without a header, so it cannot yet validate the uploaded image's crop. No review submission or publication was changed. Apple says first-ever assets must accompany the first app version if none is approved; later standalone asset submissions are supported, subject to active-submission restrictions. [Submission documentation](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-assets-from-asset-library).
