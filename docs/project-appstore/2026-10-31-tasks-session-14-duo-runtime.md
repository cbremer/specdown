# Session 14 — Duo runtime and centered diagrams

2026-10-31. Chris unlocked this Mac and requested completion of Duo testing, then asked that diagrams stay centered and zoom toward the diagram center. Apple login and existing Mac App Store keys remain owner-only.

## Source and boundaries

- Isolated branch `codex/duo-centered-diagrams`, based on exact candidate `da923e92e8516f87424c82c13bac24252c4005f7`; the prior revision remains available in draft #324, and the owner's main checkout remains preserved.
- Existing candidate app was independently matched to native/dependency hashes and all 110 bundled web files before installing on local Duo `F3C080B3-F12A-4CF8-ACF1-B0692756EF81`, iOS 27.1. Validation build 1.0 (228), unsigned simulator only.
- All interactions use disposable bundled samples/synthetic test data on this Mac. No Apple sign-in, keys, signing, uploads, submission, release or other computer access.

## Findings and changes

- The old fullscreen view retained absolute pan offsets after folding, rotating or changing detail width; Reset reused the original fit. Toolbar zoom retained the viewport focal point, which could move an already-panned diagram farther off center.
- Center the entire diagram for toolbar/slider zoom and detail resizing while retaining zoom scale. Reset recomputes fit using the current pane. Direct pan and pointer-focused wheel/pinch remain available.
- Find could overflow a narrow pane and become covered by compact controls when the keyboard reduced available height. Allow its input to shrink and make focused Find usable in short compact iOS panes.

## Runtime evidence before this correction

Real XCUITest actions opened two distinct bundled documents, navigated Contents, expanded a diagram, zoomed from 47% to 71% and panned. Closed/open/partly-open poses and four rotations retained both tabs, selected diagram, 71% zoom, and native PID 45480. Screenshots and AX records confirmed visible controls clear of system chrome. These checks exposed the centering behavior above rather than approving it.

Find's disposable text `duo cedar draft 731` survived folding/reopening. Narrow-pane keyboard layout exposed the separate issue above. Current iOS deliberately hides annotation editing and diagram sharing, so those UI checks are not applicable; Find is the available draft field. Simulator checks do not establish physical Duo ergonomics or App Store acceptance.

## Validation

- Full Jest suite: **958 tests in 56 suites passed**. Lint, typecheck, production build and diff checks passed. Focused cases use the real Panzoom library for clamped fit and the constructor-timer race; an independent reviewer reproduced and cleared that race.
- Fresh unsigned universal Release simulator build passed, with minimum iOS 16.0 and validation build 1.0 (228). All 110 packaged web files match the production bundle. Native source/config/dependencies remain unchanged; approved source build number remains 11.
- Final artifact: `/private/tmp/specdown-ios-centered-20261031/Build/Products/Release-iphonesimulator/Specdown.app`. Exact manifest: `/private/tmp/specdown-centered-final-native-ios-manifest-20261031.json`; build log: `/private/tmp/specdown-ios-centered-final-20261031.log`. Diagram source SHA-256: `434e191d94779a0520a6e904d85515db3248737f0fbbd0e54eca12473021c875`.
- Corrected app cold-launched on Duo at 17:29:09 UTC as PID 13216. Two tabs, Contents and fullscreen touch actions passed. At 47% fit the SVG and canvas centers match exactly; at 71% and after deliberate pan followed by + to 86%, centers match within 0.5 pt of AX rounding.
- Closed, partially open and all four rotations retain 86% and recenter within the actual resized detail canvas. Controls remain visible outside reserved native/system regions. This deliberately changes the old absolute-pan retention policy to match Chris's requested centering behavior; zoom and document state remain retained.
- Corrected Find accepts typed text with the keyboard present in a 371.3 × 255 pt detail viewport. Input and Close remain inside its bounds and Close is hittable; the previous obscuring action bar is hidden while focused in the short pane. Done restores the web headers and action controls while retaining the draft. Subsequent closed→open folding preserves the exact edited Find value and both tabs; Close Find, Contents→flowchart→fullscreen and Reset pass with PID 13216 unchanged.

- iPhone 16 Pro on iOS 18.5: exact final build cold launch, sample, compact controls, Find typing with visible matches, native Done, Close search, picker presentation and Cancel all pass; PID 26300 retained throughout.

- iPad Pro 11-inch (M4) on iOS 18.5: exact final build cold launch, sample, expanded controls, Find typing with visible matches, Hide keyboard, Close search, picker presentation and Cancel all pass; PID 28316 retained. All 11 ordinary-device XCUITest batches passed; both installed bundles match all 117 final artifact files. Evidence: `/private/tmp/specdown-ordinary-smoke-20261031/evidence-index.json` and `RESULT.md`.

Exact screenshot/AX/process evidence index: `/private/tmp/specdown-duo-runtime-validation-20261031.md`.

## Explicit limits

- Native picker presentation, fold/cancel and tab preservation, raw/render split, and 11-page native Print preview/fold/cancel passed on the immediately preceding candidate. Native code and those feature modules are unchanged by this follow-up. No printer was selected or job sent.
- Picking synthetic external files and oversized-file error delivery remain unverified through the Duo picker: its remote accessibility hierarchy was unavailable. A local FileProvider group exists, but no supported fixture insertion path was established; private provider files/databases were not changed.
- Active camera occlusion, arbitrary freeform app-window resizing and physical folding/touch ergonomics remain unverified. Tested sidebar/detail widths and rotations are not substitutes for those cases.
- No iOS 16 simulator runtime is installed. Successful minimum-target compilation is not iOS 16 runtime validation.
- WebContent restart remains unverified. A bounded debugger attempt attached only the known disposable app PID, but found the main thread in lock-sensitive loader work on both pauses. It detached/resumed without evaluating UIKit/WebKit getters or killing any process. No precise WebContent ownership was established. JS-only tabs/drafts are not crash-persisted by the current architecture.
- Annotation editing and diagram export/share controls are deliberately hidden in this iOS candidate, so their UI tests are not applicable.

The verified commit is intended to fast-forward local `codex/weekend-review-candidate` at `/private/tmp/specdown-weekend-20261031` for the next bounded follow-up; the new PR targets `codex/weekend-document-context` (#324). No release branch merge is authorized.

The changes remain a review candidate. These simulator results do not authorize Store signing, submission, release, or a physical-device acceptance claim.
