# Spec / Scope: iOS & iPadOS Distribution (Phase 3)

**Date:** 2026-06-16
**Type:** spec (scope + setup guide for getting SpecDown onto real devices)
**Phase:** 3 — distribution

**Today:** the iOS/iPadOS app can only be run by **building from source in Xcode**
onto your own device. CI builds the app **for the simulator only**
(`CODE_SIGNING_ALLOWED=NO`) just to prove it compiles — there is no `.ipa`, no
signing, and no way for anyone else to install it.

**Recommendation:** add a **TestFlight** lane first (private/known testers,
minimal review), then graduate to the **App Store** when you want a public
listing. Both are gated on a one-time Apple setup; the build/upload itself is
automatable with an **App Store Connect API key**.

---

## 1. Why there's no install today

`ios/project.yml` (XcodeGen) defines the app — bundle prefix `com.cbremer`,
target `SpecDown` (so bundle id `com.cbremer.SpecDown`), iOS 16+, iPhone + iPad —
but it has **no team, no signing, no distribution config**. `.github/workflows/
ios.yml` runs `xcodebuild … -sdk iphonesimulator … CODE_SIGNING_ALLOWED=NO`. A
simulator build is unsigned and can't run on hardware or be uploaded anywhere.

Unlike macOS (where a **Developer ID** app can be distributed directly as a DMG),
**iOS has no direct-download path**. Apple only allows installing iOS apps via:

| Channel | Who can install | Review | Notes |
|---|---|---|---|
| **TestFlight** | Up to 100 internal + 10,000 external testers (by email/public link) | Light **Beta App Review** for external testers only | Best first step — "let people install it" without a public launch. Builds expire after 90 days. |
| **App Store** | Anyone | Full **App Review** | Public listing + metadata, screenshots, privacy. The end goal if you want general availability. |
| **Ad Hoc** | Up to 100 devices registered by **UDID** | None | Clunky: collect each device's UDID, re-sign per device. Fine for a handful of known devices, doesn't scale. |
| ~~Enterprise (in-house)~~ | Org-internal only | None | Requires the **Apple Developer Enterprise Program** ($299/yr, company-only). Not applicable here. |

There is **no equivalent of macOS "Developer ID"** for iOS — you cannot hand
someone a signed `.ipa` to double-click. TestFlight is the lightest real option.

## 2. Recommended path: TestFlight via an App Store Connect API key

The cleanest CI story is an **App Store Connect API key** (a `.p8` issued in App
Store Connect). It both **signs** (with cloud-managed signing) and **uploads**,
with no Apple-ID password, no manually-wrangled provisioning profiles, and no
2FA prompts in CI.

### One-time setup (you, in the browser)

1. **Membership** — already covered by your Apple Developer Program (the same one
   used for the macOS Developer ID cert). Individual is fine.
2. **Register the App ID** — developer.apple.com → Identifiers → `com.cbremer.SpecDown`
   (or let App Store Connect create it in the next step).
3. **Create the App record** — appstoreconnect.apple.com → Apps → **+** → pick the
   bundle id, name **SpecDown**, primary language, SKU.
4. **App Store Connect API key** — App Store Connect → Users and Access →
   **Integrations → App Store Connect API → +**. Role **App Manager**. Download the
   **`.p8`** (one-time download!) and note the **Key ID** and **Issuer ID**.
5. **Export-compliance answer** — SpecDown uses only standard HTTPS/TLS, so set
   `ITSAppUsesNonExemptEncryption = false` in `Info.plist` to skip the per-build
   compliance prompt.

### GitHub secrets (mirrors the macOS set)

| Secret | Value |
|---|---|
| `APPSTORE_API_KEY_ID` | the Key ID from step 4 |
| `APPSTORE_API_ISSUER_ID` | the Issuer ID from step 4 |
| `APPSTORE_API_KEY_P8` | base64 of the `.p8` (`base64 -i AuthKey_XXXX.p8 \| pbcopy`) |
| `APPLE_TEAM_ID` | already set (reused from the macOS lane) |

### Project changes (`ios/project.yml`)

- Add the **team** + **automatic signing** to the target's `settings`:
  `DEVELOPMENT_TEAM: $(APPLE_TEAM_ID)`, `CODE_SIGN_STYLE: Automatic` (or manual
  with an App Store provisioning profile if we prefer pinned profiles).
- Set `ITSAppUsesNonExemptEncryption: false` in the `Info.plist` properties.
- Make the **build number monotonic** — App Store Connect rejects a reused
  `CFBundleVersion`. Easiest: have CI stamp `CFBundleVersion` from the run number
  or the `vX.Y.Z` tag's patch (the same auto-version the rest of the pipeline uses).

### CI: a new `ios-release.yml` (tag-triggered, like `desktop.yml`)

```
on: { push: { tags: ['v*'] }, workflow_dispatch: {} }
runs-on: macos-latest
steps:
  - checkout
  - setup-node 22, npm ci, npm run build          # shared web bundle
  - brew install xcodegen; (cd ios && xcodegen generate)
  - write APPSTORE_API_KEY_P8 (decoded) to a private dir
  - xcodebuild -project ios/SpecDown.xcodeproj -scheme SpecDown \
      -sdk iphoneos -configuration Release -archivePath build/SpecDown.xcarchive \
      archive  -allowProvisioningUpdates \
      -authenticationKeyID … -authenticationKeyIssuerID … -authenticationKeyPath …
  - xcodebuild -exportArchive -archivePath build/SpecDown.xcarchive \
      -exportOptionsPlist ios/ExportOptions.plist -exportPath build/export \
      -allowProvisioningUpdates  (+ same auth key flags)
  - xcrun altool --upload-app -f build/export/*.ipa --type ios \
      --apiKey $KEY_ID --apiIssuer $ISSUER_ID        # → TestFlight
```

(`ExportOptions.plist`: `method = app-store`, `signingStyle = automatic`,
`teamID = …`. `fastlane` (`gym` + `pilot`) is a heavier but friendlier
alternative that many iOS teams prefer; either works.)

Keep the existing simulator `ios.yml` as the fast PR check; the new workflow only
runs on release tags so we don't notarize/upload on every PR.

## 3. Effort & risk

- **More involved than the macOS lane.** macOS signing was "import a cert + flip
  notarize on." iOS adds an **App Store Connect app record**, an **API key**,
  signing/provisioning, an **ExportOptions.plist**, and an **upload** step — plus,
  for external TestFlight testers, a one-time **Beta App Review** (usually <24h).
- **Build-number discipline** is the most common CI foot-gun (every upload needs a
  higher `CFBundleVersion`).
- **App Store (public)** additionally needs screenshots (6.7" + iPad), a
  description, keywords, a privacy policy URL, and the privacy "nutrition label."
  TestFlight needs almost none of that — just a "what to test" note.
- **Assets:** the 1024 icon already exists (`ios/.../AppIcon-1024.png`); a launch
  screen is configured. So icon/launch are not blockers.

## 4. Suggested phasing

1. **Phase A — TestFlight (internal):** API key + app record + `ios-release.yml`;
   invite yourself + a few known testers. No external review. This is the
   "people can install it" milestone and proves the whole signing/upload chain.
2. **Phase B — TestFlight (external):** add a public tester link (one Beta App
   Review). Wider testing without an App Store listing.
3. **Phase C — App Store:** screenshots + metadata + privacy, submit for App
   Review. Public availability.

Phase A is the high-value, low-overhead step and the natural next task whenever
you want it. Phases B/C are incremental on top.

## 5. Open decisions (for when we implement)

- **Signing style:** automatic (cloud-managed, simplest in CI with the API key)
  vs. manual profiles (more control, more upkeep). Recommend **automatic** to
  start.
- **Upload tool:** `xcrun altool`/`xcodebuild` (no extra deps) vs. **fastlane**
  (nicer ergonomics, a Ruby/Gemfile dependency). Recommend the **plain Xcode
  toolchain** first; adopt fastlane only if the lane gets fiddly.
- **Versioning:** reuse the repo's auto-patch `vX.Y.Z` for `CFBundleShortVersionString`
  and stamp `CFBundleVersion` from CI — keeps iOS in lockstep with web/desktop.
