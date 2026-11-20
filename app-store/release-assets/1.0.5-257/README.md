# SpecDown 1.0.5 (257) · App Store submission packet

English (U.S.) listings submitted for iPhone/iPad and Mac on November 19, 2026. Both showed Waiting for Review at submission, with automatic release after approval. The promotional text matches the preceding listings. Word and PDF import and Markdown editing appear after the core features in both descriptions. Build 257 uses the production app identity and the production interface. Its reading interface matches the approved Beta 256 design.

| Field | iPhone and iPad | Mac |
| --- | --- | --- |
| Description | [iOS description](ios-description.txt) | [Mac description](mac-description.txt) |
| Promotional text | [Promotional text](promotional-text.txt) | Same |
| What’s New | [Release notes](whats-new.txt) | Same |
| App Review notes | [Reviewer walkthrough](review-notes.txt) | Same |

Provide the [Word guide](review-files/Stargazing%20guide.docx) and [scanned PDF](review-files/Observing%20log.pdf) with the reviewer walkthrough. Both contain original example material. The public security note describes the shared annotation recovery fix from PR #446.

## Gallery

[Open the screenshot gallery](gallery.html). Select an image to inspect it at its exported resolution.

Each device has eight new captures from the 1.0.5 candidate. The frames, typography, navy gradient, headline placement and subtitle styling come from the approved 1.0.3 artwork. The dark Starfield opening, diagram presentation, mindmap with a table, release timeline and light-mode ending retain their places. The presentation now shows how Word and PDF imports lead to an editable Markdown copy. The timeline follows the same release. Word import, Markdown editing and PDF recognition occupy positions 03, 04 and 07.

| Position | Screen |
| --- | --- |
| 01 | Starfield home in dark mode |
| 02 | Word and PDF import flowchart in diagram presentation |
| 03 | A Word guide opened as Markdown |
| 04 | An edited heading and the Save as Markdown control |
| 05 | A feature mindmap with its reference table |
| 06 | Document import release timeline in presentation mode |
| 07 | Text recovered from the scanned observing log |
| 08 | API reference in light mode |

[Mac](screenshots/mac/) · [iPhone](screenshots/iphone/) · [iPad](screenshots/ipad/) · [iPhone Duo](screenshots/duo/)

Mac images show the production Store renderer in a local development-signed sandboxed app, at 1440 × 900 points and 2× scale. Mobile images show the production interface on simulators. A temporary simulator-only driver opened the demo documents, performed the edit and waited for each capture. The signed distribution apps contain the regular interface. The iPad gallery uses the native collapsed-sidebar view.

### Recapture the diagrams

Use the [document import flowchart](diagram-samples/Document%20import.md) for slide 02 and the [release plan](diagram-samples/Release%20plan.md) for slide 06. Open each file in the Store candidate in dark mode and enter Presentation. The `%% specdown:brand` line inside each Mermaid block selects the app’s diagram palette. Check the teal shapes and connectors in the flowchart and the teal active task in the timeline before composing the artwork.

### Rebuild the artwork

The [gallery style](gallery-style.json) preserves the CSS and standard captions from the owner-approved 1.0.3 templates. The [source captures](source-captures/) are the input to the [compositor](compose.py). Each device’s manifest records the pixel dimensions, captions and hashes for the source capture and export. Use the numbered PNGs under `screenshots/` for App Store Connect.

From this folder, run the following with Python, Pillow and Chrome available.

```sh
python3 compose.py source-captures screenshots mac iphone ipad duo
```

[Apple’s screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
