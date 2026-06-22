# Setup Guide: iOS TestFlight Distribution

**Date:** 2026-06-21
**Type:** spec (setup checklist for activating the TestFlight lane)
**Builds on:** [`../project-modernization/2026-06-16-spec-ios-distribution.md`](../project-modernization/2026-06-16-spec-ios-distribution.md)

The TestFlight release lane is now **scaffolded and committed** — see
[`.github/workflows/ios-release.yml`](../../.github/workflows/ios-release.yml) and
[`ios/ExportOptions.plist`](../../ios/ExportOptions.plist). It is **inert until the
four App Store Connect secrets below are configured**: with no secrets the
tag-triggered workflow runs a Release-configuration simulator validation build
and stops (no archive, no upload), so the lane is green and ready ahead of time.

This document is the one-time, browser-side checklist **you** complete to switch
it on. None of it can be done from CI/agents (it needs Apple ID auth + the App
Store Connect UI).

---

## What's already done (in-repo, no secrets needed)

- **`ios-release.yml`** — tag-triggered (`v*`) + manual `workflow_dispatch`.
  Archives for device, exports an `.ipa`, and uploads to TestFlight **when
  secrets exist**; otherwise validates the Release build. Stamps a monotonic
  `CFBundleVersion` from the workflow run number and `MARKETING_VERSION` from the
  tag, so uploads never collide.
- **`ios/ExportOptions.plist`** — `method = app-store`, `signingStyle =
  automatic`. The `teamID` is a placeholder that CI overwrites from the
  `APPLE_TEAM_ID` secret (so it's never committed).
- **`ITSAppUsesNonExemptEncryption = false`** in `ios/project.yml` — skips the
  per-upload export-compliance question (SpecDown uses only standard HTTPS/TLS).
- The existing **`ios.yml`** simulator build stays as the fast PR check.

## One-time Apple setup (you, in the browser)

1. **Apple Developer Program** — already covered (same membership as the macOS
   Developer ID cert). Individual is fine.
2. **App record** — appstoreconnect.apple.com → Apps → **+** → bundle id
   `com.cbremer.SpecDown`, name **SpecDown**, primary language, SKU. (You can let
   this step register the App ID, or pre-create it under Identifiers.)
3. **App Store Connect API key** — App Store Connect → Users and Access →
   **Integrations → App Store Connect API → +**, role **App Manager**. Download
   the **`.p8`** (one-time download) and note the **Key ID** and **Issuer ID**.

## GitHub secrets to add

Repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|---|---|
| `APPSTORE_API_KEY_ID` | the Key ID from step 3 |
| `APPSTORE_API_ISSUER_ID` | the Issuer ID from step 3 |
| `APPSTORE_API_KEY_P8` | base64 of the `.p8`: `base64 -i AuthKey_XXXX.p8 \| pbcopy` |
| `APPLE_TEAM_ID` | your Apple Developer Team ID (reused from the macOS lane) |

The moment `APPSTORE_API_KEY_P8` is present, the next `v*` tag (or a manual
**Run workflow**) will archive, sign with cloud-managed automatic signing, and
upload to TestFlight.

## First run

1. Add the four secrets.
2. Actions → **iOS Release (TestFlight)** → **Run workflow** (manual dispatch is
   the safest first test; it uses the latest tag for the marketing version).
3. Watch for the upload step to succeed, then check App Store Connect →
   TestFlight for the processing build (a few minutes).
4. For **external** testers later, add a public link + complete the one-time Beta
   App Review (Phase B in the distribution spec).

## Gotchas (carried from the distribution spec)

- **Build numbers must increase** every upload — handled here via the run number.
- **Automatic signing** needs `-allowProvisioningUpdates` (set) and the API key;
  no profiles are checked in.
- TestFlight builds **expire after 90 days**; re-tag to refresh.
- The first upload of a new app id can take longer to appear while App Store
  Connect provisions it.
