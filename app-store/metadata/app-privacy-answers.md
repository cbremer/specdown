# App Store Connect questionnaires — proposed answers (owner must confirm; AS-040)

Evidence: code audit 2026-09-29 of `markdown-viewer/src`, `desktop/main.js`,
`ios/SpecDown` at main `b9ea264`. Recheck against the frozen candidate.

## App Privacy ("nutrition label")

- **Proposed: Data Not Collected.** No analytics/ads/crash SDKs; `PrivacyInfo.xcprivacy`
  declares `NSPrivacyTracking=false`, no collected data types.
- User-initiated fetches (web/GitHub links via `file-loading.js`, `landing.js`,
  `repo-browser.js` → api.github.com / raw.githubusercontent.com; remote images in
  documents) go directly device → host; the developer receives nothing.
- iOS skips the GitHub release check (`version-check.js` returns early on iOS).
- **Mac Store build must remove electron-updater + GitHub polling (AS-024)** before
  "Data Not Collected" is true for the Mac record.

## Encryption (export compliance)

- iOS `Info.plist` already declares `ITSAppUsesNonExemptEncryption = false` (HTTPS only).
  Mac Store build needs the same key. Owner confirms.

## Age rating (proposed answers; owner submits)

- All content categories: None. Gambling/contests: No. User-generated content shared
  with others: No. Social media features: No.
- **Unrestricted web access: needs decision.** The app opens arbitrary Markdown URLs
  and renders links/images but does not browse the web freely (external links open in
  the system browser). Proposed "No"; if Apple disagrees the rating rises to 17+/18+.

## Other

- Sign-in required: No. Demo account: not needed.
- Content rights: bundled samples are original project content.
- EU DSA trader status: owner must declare in App Store Connect → Business (banner is
  currently showing). Individual developer: trader info (address/phone/email) becomes
  public on the EU storefront if you declare trader.
