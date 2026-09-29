# App Store assets (draft)

Draft listing copy, screenshots and review material for the iPhone/iPad App Store and the
Mac App Store. Plan and tracker: [docs/project-appstore](../docs/project-appstore/).

**Status: DRAFT, pre-freeze.** Everything here was produced from `main` at
`b9ea264` (v0.0.193) on 2026-09-29, before any candidate freeze (AS-035). Screenshots
must be recaptured from the frozen candidate; copy must be rechecked against it.

| Path                                       | What                                                                                             | Plan task  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------- |
| `demo/`                                    | Original demo Markdown used for screenshots and App Review                                       | AS-036/038 |
| `metadata/en-US/ios.json`, `mac.json`      | Name, subtitle, promo text, description, keywords, URLs (limits validated)                       | AS-036     |
| `metadata/review-notes.md`                 | App Review notes (no login needed)                                                               | AS-036     |
| `metadata/privacy-policy.md`, `support.md` | Page drafts with `[PLACEHOLDERS]` for owner facts                                                | AS-037     |
| `metadata/app-privacy-answers.md`          | Proposed App Privacy / encryption / age answers with code evidence                               | AS-040     |
| `screenshots/<platform>/en-US/`            | Captioned Store images: iPhone 6.9" 1320×2868, iPad 13" 2064×2752, Mac 2880×1800 (RGB, no alpha) | AS-039     |
| `screenshots/asset-index.json`             | Source SHA, raw capture, caption and SHA-256 per image                                           | AS-039     |
| `compose-screenshots.py`                   | Regenerates the captioned sets from raw captures                                                 | AS-039     |

## How the screenshots were made

- **iPhone / iPad:** unsigned simulator build (`xcodebuild … CODE_SIGNING_ALLOWED=NO`) on
  iPhone 17 Pro Max and iPad Pro 13" (M5), iOS 26.4, status bar pinned to 9:41. Documents
  from `demo/` delivered to the running app via `simctl openurl` (same `onOpenURL` path as
  Files "Open in place"). Simulator captures, labeled as such.
- **Mac:** Electron dev build (`electron .`) with a throwaway user-data dir whose restored
  session holds the demo tabs; page captured at 1440×900 @2x over the DevTools protocol
  (content only, no window title bar). Color scheme forced per shot.
- Captions are added by `compose-screenshots.py`; the app UI itself is unmodified.

## Review risks found while capturing (fix before freeze)

1. **"v0.0.193 (alpha)" is shown in the header on every screen** (all platforms). App
   Review rejects apps presented as beta/demo (Guideline 2.2). Hide the alpha label and
   in-app version-check link in Store builds.
2. **Desktop wording on iOS start screen:** "Drop Markdown File Here / or click to browse".
3. **Start screen duplicates:** "Open Diagram Showcase" and "Try diagram showcase" both
   appear; "App Icon" sits under "or open a bundled sample".
4. **Name inconsistency:** home-screen/iPad title "Specdown", logo "SpecDown", desktop
   "Specdown Desktop". Pick one for D01 before creating records.
5. **Mac Store build must drop electron-updater/GitHub update polling** (AS-024) or the
   "Data Not Collected" answer and Guideline 2.4.5 (no self-updating) fail.
6. Observed once on iPad: after the system appearance changed while the app was closed,
   the web view relaunched dark under a light system UI. Not yet root-caused (AS-033).
