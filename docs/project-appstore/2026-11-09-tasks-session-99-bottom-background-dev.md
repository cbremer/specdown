# Session 99: bottom background continuation and local 1.0.4 Dev refresh

## Authorized scope

The owner authorized correcting the bottom background strip while retaining safe
control bounds, and updating the local 1.0.4 Dev build. This follows Session 98's
November 9 Beta build-241 feedback investigation. No other feature or release
work is included.

## Change

Both SwiftUI viewer paths now extend the web surface through the bottom container
safe area only. Top and side system areas remain protected. WebKit exposes the
bottom inset to the existing safe-area CSS, so the themed backdrop continues
behind the home-indicator area while the home, document and sheet controls keep
their safe padding. No shared CSS, document permissions, annotation behavior,
production metadata or signing configuration changed.

On the iPhone 17 Pro Max simulator, the web surface now spans y=62 through 956
instead of ending at 922. Its local bottom inset is 34 points. The document action
bar still starts at web y=783; its buttons still end at y=848. This is the same
control position as before the change, with the background extended below it.

## Verification

- New native BottomSafeAreaTests first failed on unchanged source: web bottom 922
  versus required 956, reproducing the 34-point gap.
- Corrected source passes the same regression in light/dark on iPhone 17 Pro Max
  and iPad Pro 11-inch simulators, both iOS 27.0. Home controls, document actions,
  More-sheet bounds and the reachable final paragraph are checked against native
  safe-area geometry. Captures show the home backdrop continuing to the bottom.
- iPhone native About and URL-entry focus/error/cancellation/success tests also
  passed (3 native tests in the combined run). Final regression helper refinements
  passed again on phone, then iPad. No native-test warnings were reported.
- Full scoped shared suite: 91 suites / 1,543 tests passed. Lint and strict types
  passed. Existing Node listener-count/experimental notices remain nonfailures.
- SpecDown Dev / Dev Debug rebuilt, installed and launched successfully as local
  1.0.4 (244), bundle com.mosaicpando.specdown.dev, development channel. Build-time
  overrides leave production version files unchanged. This local number is not
  a Store build reservation. All 110 packaged viewer files match the fresh viewer
  build already verified in Session 98; no web inputs changed for this fix.
- Build log records the AppIntents metadata-extraction skip warning because the
  target has no AppIntents.framework dependency. No build error was reported.
- Physical iOS 27.3 owner acceptance, landscape/rotation and iOS 16 runtime coverage
  remain separate from these observed simulator results. Top/side behavior was
  preserved by the bottom-only modifier, not recertified on every device.

## Local review and boundaries

Build 244 remains running in the iPhone simulator. The unsigned simulator app is
retained under ignored ios/DerivedData/local-review-104/SpecDown-Dev-1.0.4-244.app;
build 243 remains preserved separately. Native result bundles, light/dark captures,
source fingerprints and the build manifest remain private outside Git.
The isolated workspace contains the source change, regression and session notes,
uncommitted. No advisory review was requested or claimed for this local patch.
No production installation, signing, upload, submission, push, merge or public
release occurred. Pending 1.0.3 Store submissions are untouched.
