# Session 100 — iOS 1.0.4 bottom background

SpecDown Beta 1.0.2 (241) feedback on iPhone 17 Pro Max showed a plain strip below the themed start screen. Native measurements placed the web view's bottom at y=922 on a 956-point display, leaving the 34-point bottom safe area outside the background.

The iOS view now extends the backdrop to the bottom edge. WebKit's existing safe-area padding keeps the actions above the home indicator. On the iPhone simulator, both light and dark layouts retain the original action bar and button positions, and the last paragraph of a long document remains reachable.

The original local fix and test are preserved in `c8d5057`. The release candidate applies those two files to `d3e5256`. The production web build, 1,543 Jest tests in 91 suites, lint, type checks and the focused iPhone simulator regression passed on that baseline.

SpecDown Dev 1.0.4 (245) was signed and installed on the owner's paired iPhone. Physical acceptance and App Store submission are tracked separately from the verified installation.
