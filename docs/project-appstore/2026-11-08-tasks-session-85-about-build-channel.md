# Session 85: actual native build and channel in About

## Request and diagnosis

The owner wants About to identify the actual iPad Dev build and clearly label
development and beta builds without adding either label to production.

Observed Xcode state confirms the intended candidate project, SpecDown Dev
scheme, physical iPad destination, marketing version 1.0.2 and Dev Debug build 233. Xcode reports that app running on the iPad. The owner followed the setup
correctly.

The confusing number originates in About's version display. The iOS shell passes
the marketing version but omits the native build number. About then appends the
shared viewer version, 0.0.232, which cannot distinguish native Dev builds 232
and 233.

## Implementation and local plan

1. Pass the installed bundle's CFBundleVersion and SpecDownChannel from the iOS
   shell to the shared About dialog.
2. Display `Version 1.0.2 (build 234)` and title `SpecDown — Development` in the
   refreshed Dev app. Explicit beta configuration uses `SpecDown — Beta`.
   Production, missing and unrecognized channels use the plain `SpecDown` title.
3. Read metadata from the installed bundle, without using a user preference,
   debug flag, build-number guess or TestFlight upload status. Existing shell
   callers without native build metadata retain their current version display.
4. Run regression and real WKWebView checks, rebuild the local iPad Dev app as
   234, and retain the owner's signing configuration and earlier build evidence.

The native metadata injection in this change applies to iOS/iPadOS. Shared About
supports the explicit metadata when supplied; this session does not change Mac
packaging or its preload metadata transport.

## Verification

- New About regressions failed against the original display: native build 233
  was replaced by viewer 0.0.232, and development/beta headings were unlabeled.
- After implementation, 31 focused About/desktop compatibility cases passed.
- The full scoped Jest suite passed 86 suites and 1,489 tests. Scoped lint,
  strict type checking and the fresh viewer production build passed.
- Production, missing and unrecognized channel values receive neither a
  Development nor a Beta label.
- The hosted native test passed in the task-owned simulator, exercising the real
  bundle-to-WKWebView-to-About path. That simulator is shut down.
- Xcode changed only the generated Dev Debug build number, 233 to 234, saved the
  project, rebuilt and reported the Dev app running on the physical iPad.
  Device metadata independently confirms SpecDown Dev 1.0.2 (234) installed.
- The exact Xcode-built app is retained privately. Strict signature, Dev channel,
  profile coverage for the iPad, certificate/profile agreement and all 110 bundled
  viewer files were verified. The physical About sheet itself was not inspected;
  its real WKWebView display was verified by the hosted native test.

Existing Jest listener and Vite chunk/config warnings are retained in complete
private logs. Source and build evidence is under
`ios/DerivedData/wave-102-local-dev-234/`. These are local development changes;
they do not reserve Apple upload numbers or establish release acceptance.
