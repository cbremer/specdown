# Spec — macOS Code-Signing & Notarization (Phase 3)

**Date:** 2026-06-15
**Type:** spec (setup guide + what the code change does)
**Phase:** 3 — distribution

The real fix for the desktop **"Specdown Desktop is damaged and can't be opened"**
Gatekeeper error. That error is *not* corruption — it's macOS quarantining an
**unsigned, un-notarized** app downloaded from the internet. The fix is to sign
the app with an Apple **Developer ID Application** certificate and **notarize** it
with Apple, then staple the ticket. After that, double-click just works.

---

## What the code change does (already in this PR)

- **`build/entitlements.mac.plist`** — the hardened-runtime entitlements Electron
  needs (JIT, unsigned-executable-memory, library-validation, dyld env vars).
- **`package.json` → `build.mac`** — `hardenedRuntime: true`,
  `gatekeeperAssess: false`, and the two `entitlements*` paths. (Hardened runtime
  is a prerequisite for notarization.)
- **`.github/workflows/desktop.yml` → `build-macos`** — now has two build paths:
  - **signed + notarized** when the signing secrets exist (`HAS_SIGNING` is true);
  - **unsigned fallback** otherwise, so the pipeline never hard-fails before the
    secrets are set up.

**Nothing signs until you add the secrets below** — current releases keep building
unsigned exactly as before.

---

## What you need to do (one-time)

### 0. Prerequisite
An **Apple Developer Program** membership ($99/yr). Individual is fine.

### 1. Create a "Developer ID Application" certificate
- In **Xcode → Settings → Accounts → Manage Certificates → + → Developer ID
  Application** (or create it at developer.apple.com → Certificates).
- It lands in **Keychain Access** (login keychain).

### 2. Export it as a `.p12`
- Keychain Access → find **"Developer ID Application: <your name> (TEAMID)"** →
  expand it, select **both** the cert **and** its private key → right-click →
  **Export 2 items…** → save as `cert.p12`, set an **export password** (remember it).

### 3. Base64-encode the `.p12`
```bash
base64 -i cert.p12 | pbcopy   # now on your clipboard
```

### 4. Get your Team ID and an app-specific password
- **Team ID** (10 chars, e.g. `AB12CD34EF`): developer.apple.com/account → Membership.
- **App-specific password**: appleid.apple.com → **Sign-In and Security →
  App-Specific Passwords → +** → name it "specdown-notarize" → copy the
  `xxxx-xxxx-xxxx-xxxx` value.

### 5. Add 5 GitHub repository secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret name | Value |
|---|---|
| `MAC_CERT_P12` | the base64 string from step 3 |
| `MAC_CERT_PASSWORD` | the `.p12` export password from step 2 |
| `APPLE_ID` | your Apple ID **email** |
| `APPLE_APP_SPECIFIC_PASSWORD` | the app-specific password from step 4 |
| `APPLE_TEAM_ID` | your 10-char Team ID from step 4 |

### 6. Release
Merge to `main` as usual → the version-bump pipeline tags it → the desktop
workflow runs the **signed + notarized** path automatically (the
`build-macos` job will log code-signing + `notarize` / notarytool steps).
First notarization can take a few minutes while Apple processes it.

---

## How to verify it worked
Download the DMG from the GitHub Release, then:
```bash
spctl -a -vvv -t install /Applications/Specdown\ Desktop.app   # => "accepted, source=Notarized Developer ID"
xcrun stapler validate /Applications/Specdown\ Desktop.app      # => "The validate action worked!"
```
Or just: download → open → it launches without the "damaged" dialog.

## Notes / gotchas
- **I could not test this end-to-end** — it needs your cert + a macOS runner. The
  config follows electron-builder 26's documented signing/notarization patterns;
  please do one release and confirm with the checks above.
- The signed path uses the **apple-id + app-specific-password** notarization
  method (simplest). If you'd rather use an **App Store Connect API key**, swap the
  `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD` env for `APPLE_API_KEY` (path to the
  `.p8`), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` and drop the `notarize.teamId`
  override — say the word and I'll switch it.
- Apple's **arm64 + x64**: this builds a single-arch DMG for the runner's arch
  (Apple Silicon on `macos-latest`). If you want a universal DMG, add
  `"target": { "target": "dmg", "arch": ["universal"] }` — separate change.
- Secrets are never printed in logs; the unsigned fallback exists so forks/PRs
  (which can't read secrets) still get a build.
