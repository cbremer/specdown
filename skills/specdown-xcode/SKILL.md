---
name: specdown-xcode
description: Use when updating the local SpecDown repo before iOS/Xcode work, deciding whether dependencies, Vite assets, XcodeGen, xcodebuild, or code signing steps are required, or offering the user safe options for preparing the iOS app.
---

# SpecDown Xcode

## Overview

Use this for SpecDown repo updates that feed the iOS app. Keep user work safe, pull the latest `main`, inspect what changed, then offer or run only the steps that are actually needed.

## Safety Rules

- Work in `/Users/chrisbremer/code/specdown` unless the user explicitly gives another path.
- Read `AGENTS.md` and `CLAUDE.md` before actions.
- Check `git status --short --branch` before pulling. If local changes exist, preserve them with a named stash or ask before proceeding.
- If the only local change is `package-lock.json`, inspect its diff before stopping. If it is clearly generated-only drift (for example npm metadata, peer/optional flags, platform entries, or lockfile-version alignment) with no dependency-spec changes, report that finding and offer to restore only `package-lock.json` before pulling. Never restore it without the user's approval.
- Treat source, manifest (`package.json`), iOS, or mixed-file changes as potentially intentional work: preserve them with a named stash or ask before pulling.
- Pull with `git pull --ff-only` on `main`; avoid merge commits.
- Use approval for network installs or Xcode commands when sandboxing blocks them.
- Do not run `xcodegen generate` unless the changed paths require it or the user asks for a full refresh.
- Never report web preparation as complete solely because commands were invoked. Verify that Vite is installed, the build exits successfully, and the generated bundle contains the current `package.json` version before opening Xcode or reporting success.

## Workflow

1. Capture the starting commit:
   ```bash
   before=$(git rev-parse HEAD)
   ```
2. Inspect local changes before updating. If `package-lock.json` is the only changed file, inspect it first:
   ```bash
   git diff -- package-lock.json
   ```
   If it is generated-only drift, offer to restore it; otherwise preserve local work with a named stash or ask before proceeding.
3. Update latest code:
   ```bash
   git checkout main
   git pull --ff-only
   after=$(git rev-parse HEAD)
   ```
4. Analyze changed paths:
   ```bash
   python3 ~/.codex/skills/specdown-xcode/scripts/recommend_steps.py "$before" "$after"
   ```
5. Present the recommendation and ask the user which option to run unless they already requested automation.
6. Run chosen steps and report exact commands and outcomes.

## Decision Rules

- **No changes pulled**: no rebuild is required.
- **`package.json` or `package-lock.json` changed**: run `npm install` before builds.
- **`markdown-viewer/`, `vite.config.js`, or bundled static assets changed**: run `npm run build`.
- **`ios/project.yml` changed**: run `cd ios && xcodegen generate`.
- **Swift, iOS resources, `ios/project.yml`, or web assets changed and user wants validation**: run the iOS simulator build.
- **Only docs, README, changelog, desktop config, or non-iOS build assets changed**: no iOS build is required unless the user wants verification.

## User Options

When changes are present, offer concise choices:

- `minimal`: install dependencies and rebuild web assets only when required.
- `project refresh`: run `xcodegen generate` only when required.
- `simulator build`: run required prep plus `xcodebuild` for iOS Simulator.
- `signed/device build`: attempt signing/device-oriented build only when the user asks; explain that credentials/profiles may be machine-dependent.
- `status only`: report what changed and what would be needed without running more commands.

## Commands

Web prep:
```bash
npm install
test -x node_modules/.bin/vite
npm run build
app_version=$(node -p "require('./package.json').version")
rg -Fq "$app_version" markdown-viewer/dist/assets
```

If any command fails, stop and report it. Do not install the iOS app from a
stale `markdown-viewer/dist` bundle. The Xcode project packages that directory
into the app, so a version mismatch means the installed app will remain old.

XcodeGen:
```bash
cd ios && xcodegen generate
```

Simulator build:
```bash
cd ios && xcodebuild -project SpecDown.xcodeproj -scheme SpecDown -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
```

Signing check, when requested:
```bash
cd ios && xcodebuild -project SpecDown.xcodeproj -scheme SpecDown -showBuildSettings | rg 'CODE_SIGN|DEVELOPMENT_TEAM|PRODUCT_BUNDLE_IDENTIFIER|PROVISIONING'
```

## Reporting

End with:

- Pulled commit/tag.
- Whether `npm install`, `npm run build`, `xcodegen generate`, or `xcodebuild` was required and whether each was run.
- For web preparation, whether `node_modules/.bin/vite` existed and the built bundle contained the expected package version.
- Any dirty worktree changes created by local tooling, especially `package-lock.json`.
- The preserved stash name if local work was stashed.
