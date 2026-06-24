# Setup Guide: iOS TestFlight & App Store Distribution

**Date:** 2026-06-21 (expanded 2026-06-22)
**Type:** spec (setup checklist for activating the distribution lane)
**Builds on:** [`../project-modernization/2026-06-16-spec-ios-distribution.md`](../project-modernization/2026-06-16-spec-ios-distribution.md)

The TestFlight release lane is **scaffolded and committed** — see
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
  Archives for device, exports an `.ipa`, and uploads to App Store Connect
  **when secrets exist**; otherwise validates the Release build. Stamps a
  monotonic `CFBundleVersion` from the workflow run number and
  `MARKETING_VERSION` from the tag, so uploads never collide.
- **`ios/ExportOptions.plist`** — `method = app-store`, `signingStyle =
  automatic`. The `teamID` is a placeholder that CI overwrites from the
  `APPLE_TEAM_ID` secret (so it's never committed).
- **`ITSAppUsesNonExemptEncryption = false`** in `ios/project.yml` — skips the
  per-upload export-compliance question (SpecDown uses only standard HTTPS/TLS).
- The existing **`ios.yml`** simulator build stays as the fast PR check.

---

## Part A — Apple side (browser, ~15 min, one-time)

### A1. Create the app record
1. **appstoreconnect.apple.com → Apps → "+" → New App**.
2. Platform **iOS**; Name **SpecDown**; primary language of your choice.
3. **Bundle ID:** choose `com.cbremer.SpecDown`. If it isn't in the dropdown,
   first register it at **developer.apple.com → Certificates, IDs & Profiles →
   Identifiers → "+" → App IDs → App** (`com.cbremer.SpecDown`), then return here.
4. **SKU:** any unique string (e.g. `specdown`). Create.

### A2. Create the App Store Connect API key
1. **App Store Connect → Users and Access → Integrations → App Store Connect API
   → "+"**.
2. Name it (e.g. `specdown-ci`), **Access: App Manager**, Generate.
3. **Download the `.p8`** — you only get this **once**; store it safely.
4. Note two values from that row / page:
   - **Key ID** (e.g. `A1B2C3D4E5`)
   - **Issuer ID** (a UUID near the top of the Integrations page).

### A3. Team ID
- **developer.apple.com → Membership details → Team ID** (10 chars). If you
  already set `APPLE_TEAM_ID` for the macOS DMG lane, reuse the same value.

---

## Part B — GitHub side (add 4 secrets)

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `APPSTORE_API_KEY_ID` | the **Key ID** from A2 |
| `APPSTORE_API_ISSUER_ID` | the **Issuer ID** from A2 |
| `APPSTORE_API_KEY_P8` | **base64 of the `.p8`** (command below) |
| `APPLE_TEAM_ID` | your **Team ID** from A3 (may already exist) |

Produce the `.p8` value locally and paste the output verbatim:

```bash
base64 -i AuthKey_XXXXXXXXXX.p8 | pbcopy   # macOS — copies to clipboard
# or just print it:
base64 -i AuthKey_XXXXXXXXXX.p8
```

The moment `APPSTORE_API_KEY_P8` is present, the next `v*` tag (or a manual run)
archives, signs with cloud-managed automatic signing, and uploads to App Store
Connect.

---

## Part C — First run (→ TestFlight)

1. Add the four secrets.
2. **Actions → "iOS Release (TestFlight)" → Run workflow** (manual dispatch is
   the safest first test; it uses the latest tag for the marketing version).
3. Watch the **Upload** step succeed.
4. **App Store Connect → your app → TestFlight** — the build appears in
   "Processing" within a few minutes.
5. Add yourself as an **internal tester** to install via the TestFlight app.

After that, every `v*` tag the release pipeline creates auto-uploads a build (the
run-number build stamp keeps uploads monotonic).

---

## TestFlight vs. App Store — what these secrets cover

**The same secrets, signing, and uploaded `.ipa` serve both.** `ExportOptions.plist`
already uses `method = app-store`, so the binary that lands in App Store Connect
is eligible for **both** TestFlight and a public App Store release — there is no
separate "App Store build," and **no extra secrets or workflow changes** are
needed to go public.

What the App Store additionally requires is **listing + review work in the App
Store Connect UI** (per app, not CI):

| | TestFlight (internal) | App Store (public) |
|---|---|---|
| Uploaded build | ✅ from this lane | ✅ same build |
| Review | none (internal) | **full App Review** (~1–3 days) |
| Screenshots | not required | **6.7" iPhone (+ iPad)** required |
| Description / keywords / support URL | minimal | required |
| **Privacy policy URL** + App Privacy "nutrition label" | not required | required |
| Age rating, category, pricing/availability | — | required |
| Action | add testers | **Submit for Review** |

### Suggested phasing (from the distribution spec)
- **Phase A — TestFlight internal:** Parts A–C above. The "people can install it"
  milestone; proves the whole signing/upload chain. No review.
- **Phase B — TestFlight external:** add a public tester link → one-time **Beta
  App Review** (usually <24h). Wider testing, still no store listing.
- **Phase C — App Store:** fill in the listing + privacy + screenshots once, then
  **Submit for Review**. The build is already in App Store Connect waiting.

### Optional: automate the App Store listing later
A **fastlane `deliver`** lane (using the same API key) can push metadata +
screenshots from a `fastlane/metadata` folder and submit for review from CI. It's
extra setup (a Ruby/fastlane dependency) and only worth it once the listing
content is settled — the first submission is usually simpler done by hand.

---

## Gotchas

- The **`.p8` is a one-time download** — if lost, revoke the key and make a new one.
- **Build numbers must increase** every upload — handled here via the run number.
- **Automatic signing** needs `-allowProvisioningUpdates` (set) and the API key;
  no profiles are checked in.
- TestFlight builds **expire after 90 days**; re-tag to refresh.
- The first upload of a brand-new app id can take longer to appear while App Store
  Connect provisions it — not a failure.
