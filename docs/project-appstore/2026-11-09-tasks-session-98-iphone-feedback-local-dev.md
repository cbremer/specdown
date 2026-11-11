# Session 98: iPhone feedback investigation and local 1.0.4 Dev review

## Authorized scope

Investigate the existing TestFlight screenshot report and prepare a separate local
Dev build for review. The owner called this “1.4”; this session interpreted it as
Store marketing version 1.0.4. No new feature implementation, production install,
signing, upload, submission, merge or publication was performed. Existing pending
1.0.3 submissions remain separate.

## Earlier report: unrelated historical Find issue

The production app's Screenshot Feedback list contained four historical reports.
The initially selected, unrelated Find report was submitted October 13, 2026 at 8:13 AM Pacific, for
1.0 build 8 on iPhone 17 Pro Max / iOS 27.2, 440 by 956 points. The tester said
Find enlarged the screen off the right edge and pinching restored it. The original
image visibly clips both application controls and document text on the right.
Original screenshot and metadata are retained privately outside Git.

Commit ade4ae65167385bbf983eb6ab66ff09779821273, October 13 at 8:18 AM Pacific,
explicitly cites this same report and changed editable native-iOS fields to 16px,
allocating historical build 9. The earlier Find field was 0.9rem. The documented
mechanism is focus-triggered iOS page zoom for a field below 16px; right-edge
clipping is the resulting symptom, and pinching is the recovery. Earlier Dynamic
Island and iPad menu reports are separate symptoms and builds.

Confirmed: report identity, screenshot clipping, old field size, exact historical
correction and retention of that correction in current main, Apple 1.0.2 source
b11b255 and 1.0.3 source c3042e4. The focus-autozoom mechanism is strongly supported
by the tester's trigger/recovery and contemporaneous source record; this session
did not independently replay build 8 on physical iOS 27.2 or measure its zoomScale.
No current-release reproduction follows from an old screenshot alone.

## Local review build and verification

- Base: freshly verified main a750ca77fbd4b7a65aa11d587dcee3b7e757c903 in a new
  managed workspace. Canonical root checkout and existing worktrees preserved.
- Pinned dependencies installed with npm ci --ignore-scripts. Lifecycle scripts
  were unnecessary for this unsigned iOS simulator build.
- Fresh Vite production build passed; generated viewer contains the expected
  independent desktop/package version 0.0.233. Existing large-chunk notice remains.
- Existing iosActionSheet and iosRenderer regression suites: 2 suites / 23 tests
  passed. Their CSS assertions are source checks, not physical-device proof.
- XcodeGen generated only the isolated project. SpecDown Dev / Dev Debug built
  and launched on iPhone 17 Pro Max simulator / iOS 27.0.
- Build-time overrides: MARKETING_VERSION=1.0.4, CURRENT_PROJECT_VERSION=243,
  CODE_SIGNING_ALLOWED=NO. These are local-review labels, not a Store reservation.
- Verified built plist: com.mosaicpando.specdown.dev, development, 1.0.4 (243).
  All 110 bundled viewer files match the fresh build byte for byte.
- Build log contains the AppIntents metadata-extraction skip warning because no
  AppIntents.framework dependency exists. No build error was reported.
- Semantic simulator automation timed out; native Device Hub screenshot/input
  was used for interactive observation instead. Open Diagram Showcase, More,
  Find, focus with software keyboard, enter Diagram, observe 1/14 matches,
  refocus and close Find: controls and document remained within the screen.
  No right-edge cutoff or pinch recovery was observed in this run.
- Physical iOS 27.2 acceptance remains untested. No new layout correction was
  justified or introduced. No full-release-readiness claim is made.

## Correction: actual November 9 Beta feedback

The initial reply incorrectly matched the owner's current report to the October
Find issue. The owner corrected that match. The earlier Find simulator check and
historical correction do not diagnose today's reported bottom strip.

A refreshed production SpecDown Screenshot Feedback list exposed only its four
October records, with no active filter shown. The separate SpecDown Beta record
exposed the actual report: November 9, 2026 at 7:53 AM Pacific, 1.0.2 build 241,
iOS 27.3, 440 by 956 points. Apple's device field is Unknown; the owner describes
an iPhone 17 Max. The screenshot is the light Starfield start view with a plain
white strip across the bottom. The owner says the strip is black in dark mode
and is unsure whether content is being cut off. There is no Find UI in this
screenshot. Metadata and original image are preserved privately outside Git.

Session 96 binds production and Beta build 241 to b11b25594e5f093ca8152d9225200a9d75736257.
The relevant ContentView.swift, WebView.swift and styles.css have no differences
between that source and the current-main local Dev source a750ca7.

### Native geometry investigation

A temporary synthetic XCTest hosted the actual ContentView shell on the iPhone
17 Pro Max simulator / iOS 27.0, inspected the WKWebView and real bundled page,
then opened and scrolled a synthetic long document. Product source was unchanged.
The probe passed (1 test, 0 failures). Four diagnostic-only optional-value print
warnings were emitted; its source and runtime observations are retained privately.
The temporary test was removed and the isolated generated project refreshed.

Observed native geometry:

- Window: 440 by 956 points; safe insets: 62 top, 34 bottom.
- Web view: x=0, y=62, width=440, height=860; bottom=922.
- Web-view-local safe insets and adjusted scroll insets: zero.
- DOM inner/visual viewport: 440 by 860; visual scale and native zoom: 1.
- Home drop-zone bottom: 860, matching the actual web viewport exactly.
- Loaded-document action bar: y=783 to 860 in web coordinates.
- At the end of a 100-paragraph synthetic document, the final sentinel paragraph
  ends at y=732.30, above the action bar; it remains reachable and visible.
- Dark appearance changed the web page's theme without changing these bounds.

### Cause, symptom and limits

Confirmed locally: the 34-point bottom band lies outside the web view, in the
native safe area. ContentView's GeometryReader respects native safe edges;
SafeAreaWebView forwards only residual local safe insets. The Starfield backdrop
is inside the web page and therefore stops at that boundary. No native themed
background extends it into the reserved bottom area. The native surface is then
visible as a different-colored strip. The source history records the safe-edge
layout change in a42b7d8; its purpose was to keep interactive content clear of
system areas, not to add a decorative strip.

The evidence supports a native-safe-area/background coverage issue, rather than
the October focus-zoom problem or a 100vh overflow. The screenshot confirms the
strip, but does not itself prove missing controls or content. The measured local
viewport fits, and the tested long-document ending remains visible. Physical
behavior on the reported iOS 27.3 device has not been measured; other document,
rotation, text-size and keyboard cases remain outside this bounded probe.

Proposed narrow follow-up for 1.0.4: continue the appropriate native background
through the bottom safe area while preserving safe bounds for interactive
content. Verify home light/dark, last document paragraph, bottom actions,
rotation and keyboard dismissal on the owner's phone. This is a proposal only;
no product fix was implemented in this investigation.

## Release implication

Today's Beta report remains a valid 1.0.4 layout-polish candidate. The previous
suggestion that it was already covered by the old Find correction is withdrawn.
WK-18 still needs shipped-source/36-case acceptance reconciliation; WK-52 remains
an optional future feature requiring scope selection. Neither was implemented here.
No advisory review was requested for this investigation/build-only task.
