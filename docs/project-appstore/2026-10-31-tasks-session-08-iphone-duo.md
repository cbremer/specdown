# Session 08: iPhone Duo adaptive viewer

Date: 2026-10-31 (America/Los_Angeles). Follow-up to [session 07](2026-10-31-tasks-session-07-launch-weekend.md).

## Scope and boundaries

The owner requested iPhone Duo readiness for the next mobile revision. This change is a separate draft after the launch security and website work. It does not change the approved marketing/build values in `ios/project.yml` (1.0 / 11); unsigned simulator validation stamps 1.0 / 228 only.

Work stays on **this Mac and its local simulators**. Never access the owner's other computers, remote hosts, SSH sessions, or other Macs. Do not sign in to Apple, retry credentials, access App Store Connect, accept new agreements, upload, submit or release a Store candidate. Existing Mac App Store keys remain owner-held and unverified; Chris performs all key/signing setup by hand. No key was created, replaced, rotated, exported or used here.

## Preparation and audit

- Xcode 27.2 build 27B52 was already installed. The local Duo device type requires iOS 27.1 or newer.
- `xcodebuild -downloadPlatform iOS -buildVersion 27.1 -architectureVariant arm64` downloaded and installed the official 7.85 GB runtime without sign-in or agreements. Verified runtime: iOS 27.1 build `24A94232`; local disk retained about 134 GiB free.
- Xcode created the local Duo simulator `F3C080B3-F12A-4CF8-ACF1-B0692756EF81`. Device Hub exposes Closed, Partially Open, Open and rotation controls.
- Applied Apple's exported `app-resizability` skill from `xcrun agent skills export --output-dir /private/tmp/specdown-xcode-skills-20261031`. Prerequisites pass: a launch screen exists, all four iPad orientations are declared, and no full-screen opt-out exists. The app already uses SwiftUI scene lifecycle; no main-screen sizing or orientation-based layout branch was found.
- The initial actual Duo launch reproduced viewer content under the persistent right-side status region. Source also gated expanded layout on iPad idiom and constructed different WebViews when changing shells.

Sources: [Apple preparation guide](https://developer.apple.com/iphone-duo/prepare/), [adaptive layouts and reserved regions](https://developer.apple.com/videos/play/tech-talks/111463/), [official component download instructions](https://developer.apple.com/documentation/xcode/downloading-and-installing-additional-xcode-components). Local SDK headers and Swift interfaces were checked before choosing APIs.

## Implementation

- `ContentView.swift`: choose the native shell from available size class rather than device idiom. On iOS 17+, keep one `NavigationSplitView` and detail identity with an explicit compact detail preference. iOS 16 retains the compatible shell path. Read the detail's own environment and geometry; widths at or below the shared viewer's 768px breakpoint retain compact Contents/Raw/More controls even within a regular-width native split view. Native sidebar navigation remains available independently of renderer actions.
- Remove the blanket `ignoresSafeArea()` from readable/interactive content. Native containers reserve all four safe edges, including the persistent lateral bar. Existing CSS receives only residual local WKWebView insets; it does not add window insets a second time.
- `WebBridge.swift` and `WebView.swift`: the scene bridge strongly retains a single WKWebView. Recreated representables reuse it and reattach their weak delegates without loading the page again. The weak script-handler proxy keeps that ownership graph acyclic. Thus document tabs, scroll and diagram state remain in the same renderer.
- Safe-area publication runs during layout, deduplicates unchanged values and forces publication after a page load. The SwiftUI update path sends layout changes only when the mode actually changes, so unrelated view updates do not dismiss an open sheet. A web-process reload preserves the last delivered layout mode for replay, while a newer queued layout takes precedence.
- File/error delivery requests compact detail presentation even when initiated from the sidebar. Picker/print presentation uses the renderer's window or the weak window recorded on its latest local attachment, replacing the global first-key-window scan. This also supports a retained detail temporarily detached while its compact sidebar is visible.
- No shared renderer, CSS, dependency, signing or version source was changed for this compatibility patch. Native split containers handle the tested partial-fold division; no custom hinge/camera JavaScript bridge was added.

## Verification and precise evidence boundary

The final post-lock native source, including the reload-replay correction, was built successfully with Xcode 27.2 using `CODE_SIGNING_ALLOWED=NO`, generic iOS Simulator destination, Release configuration and minimum iOS 16.0. This build follows the rebase onto tested toolchain commit `a391c62a4f7cdf26824de97144fa82e8bc8af2bf` and a fresh dependency install/production web build. All 110 packaged web files match that production bundle, and both ATS arbitrary-load flags remain false. The real Swift bundle-containment and bounded-read regression executable and `git diff --check` passed. The only build warning is skipped App Intents metadata extraction because the app has no AppIntents.framework dependency. The final app was not installed or launched after the Mac locked.

The last interactive source has WebBridge SHA-256 `2887b296e03e6d70eea3f8cd39a3e09a84b7580314a7a5c0625f0a7d025d786a`; final compiled WebBridge SHA-256 is `f4b6ade42303852a7371cd95dd488a42650f20bf75a7e915c048accedb466a1d`. ContentView and WebView hashes are unchanged between these two native snapshots. Keep the manifests distinct; the table below is runtime evidence for the last interactive revision or earlier drafts, not a claim about the post-lock revision.

Local artifacts:

- Final compiled build log: `/private/tmp/specdown-ios-duo-final-20261031.log`.
- Final compiled app: `/private/tmp/specdown-ios-duo-final-20261031/Build/Products/Release-iphonesimulator/Specdown.app`.
- Final exact native/dependency/110-asset hashes, bundle comparison and version metadata: `/private/tmp/specdown-duo-build-manifest-20261031.json`.
- Preserved last interactive native manifest: `/private/tmp/specdown-duo-interactive-build-manifest-20261031.json`; corresponding build log/app remain under `/private/tmp/specdown-ios-duo-20261031`.
- Runtime installation log: `/private/tmp/specdown-ios27-1-runtime-download.log`.
- Initial folded-overlap screenshot: `/private/tmp/specdown-duo-baseline-outer-20261031.png`.
- Earlier adaptive partial-fold screenshot: `/private/tmp/specdown-duo-adaptive-partial-20261031.png`.
- Earlier fullscreen zoom continuity screenshot: `/private/tmp/specdown-duo-zoom-partial-20261031.png`.

| Native runtime check                                                             | Result and tested scope                                                                                                                                                                                 |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cold launch on Duo iOS 27.1                                                      | Passed before the final reload-replay correction. Last interactive process ID 76930; no login/signing needed.                                                                                           |
| Open pose, two bundled document tabs, selected diagram showcase                  | Passed before the final reload-replay correction through real Device Hub interaction.                                                                                                                   |
| Narrow expanded detail action bar, Contents sheet and heading navigation         | Passed before the final reload-replay correction. Flowchart rendered after choosing its Contents entry. This verifies the width-based renderer mode fix before the post-lock reload correction.         |
| Closed → open → partially open → closed, two tabs and selected document retained | Passed on an earlier draft with the same retained-renderer/native-safe-area design. Later detail environment, width policy and presentation refinements need this sequence repeated on the final build. |
| Fullscreen flowchart, zoom changed from 54% to 66%, then partially opened        | Earlier draft retained the 66% zoom and kept controls in the native detail region clear of the hinge/status area. Final build retest remains pending.                                                   |
| Compact Contents sheet and heading/scroll navigation                             | Passed on earlier draft; final narrow expanded equivalent passed.                                                                                                                                       |
| Rotation, keyboard, compact-sidebar picker/return, active camera occlusion       | Pending; not claimed passed.                                                                                                                                                                            |
| Ordinary iPhone/iPad and iOS 16 resize regression                                | Final source compiles for iOS 16 minimum; runtime/touch validation remains pending. Earlier security-only phone validation does not cover this layout change.                                           |

After these interactions, review identified a small reload edge case: resetting the applied layout mode could lose it if WebKit restarted without a SwiftUI update. The final correction preserves the last mode for replay. Its compile/bundle verification is separate from the preceding runtime evidence; web-process restart replay and all final source interactions remain unverified.

The Mac locked during the final interactive sequence. Computer automation reported that it could not unlock it. UI actions stopped; no unlock bypass, other computer or physical device was used. Build and source checks continued. The owner must unlock this Mac before the remaining interaction checks can run.

The native automation plugin could enumerate the Duo UI but its screenshot call could not choose between two displays, and its inner-display taps did not activate the target. Device Hub via computer use provided actual interactions; official `simctl io ... screenshot --display=1` / `--display=3` captured display artifacts. Do not equate a plugin's successful tap response with observed app behavior.

## Remaining acceptance checks before a Duo-ready release claim

1. On the final source, repeat both directions through Closed/Open/Partially Open, all supported rotations and Split View sizes. Retain two tabs, the selected document, Contents scroll position, unsaved edits/annotations and a distinct fullscreen zoom/pan state.
2. Reach the native sidebar in a compact layout, open a bundled sample and pick a file, and verify detail return. Repeat cancellation and oversized-file error delivery. Verify that the locally cached presentation window is valid while the retained detail is detached.
3. Exercise keyboard open/close, action/Contents sheets, fullscreen controls, raw/render split and native print/popovers around asymmetric bars. Check active camera occlusion and a hidden-sidebar partial-fold state; the tested two-column hinge handling does not prove every custom overlay/camera case.
4. Repeat ordinary iPhone and iPad behavior, including an older runtime. iOS 16 fallback reuse must be checked on an actual supported runtime/device when available, not inferred from a successful compiler availability check.
5. Physical folding-device behavior is a separate owner-run gate. No simulator or source audit proves physical touch ergonomics or App Store acceptance.

Keep this as a draft compatibility change until the outstanding native matrix passes. No production deployment, Store upload, scanner finding closure or release claim is authorized by these local results.
