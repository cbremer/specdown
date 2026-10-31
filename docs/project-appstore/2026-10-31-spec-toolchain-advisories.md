# Build-tool advisory assessment — October 31, 2026

WK-19 candidate, based on website head `04b4419` and security head `b44303d`.

## Result

Four scoped dependency overrides reduce the full npm audit from **37 entries (36 moderate, 1 low)** to **17 (12 moderate, 5 low)**. Runtime-only audit remains **zero**. These counts include affected parent packages, not just distinct vulnerabilities. Direct dependency versions are unchanged.

- Upgrade minimatch 9/10 consumers to 11.0.3 using a version-qualified override.
- Upgrade glob 10/13/14 consumers to 14.0.3 using a version-qualified override.
- Use minimatch 11.0.3 under FileList, which consumes its compatible `.match` API.
- Upgrade babel-plugin-istanbul's test-exclude 6 to 8; its Node 20 requirement is below SpecDown's Node 22.12 floor. The [upstream changelog](https://github.com/istanbuljs/test-exclude/blob/master/CHANGELOG.md) documents the Node/dependency changes.

These cross-major transitive overrides have project compatibility evidence; the original parent dependency ranges do not permit them automatically. Blanket parent-scoped overrides were rejected because they cascade into legacy descendants with incompatible callable APIs.

## Remaining advisories

| Underlying issue | Upstream fix | Remaining path |
| --- | --- | --- |
| [minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249) | 11.0.1 | electron-builder 26.18.1 → app-builder-lib 26.18.1 → asar 3.4.1 / universal 2.0.3 → dir-compare 4.2.0 / squirrel-windows 26.18.1 → electron-winstaller 5.4.0 → temp 0.9.4 → rimraf 2.6.3 → glob 7.2.3 → minimatch 3.1.5. These branches produce the 12 moderate entries. |
| [glob cancellation bypass](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) | 14.0.2 | Resolved in the candidate. The remaining glob 7 audit entry is inherited from minimatch, not this glob 9+ advisory. |
| [deepmerge prototype poisoning](https://github.com/advisories/GHSA-gcqx-w48m-w2h4) | None published | Jest 30.4.2 → jest-config 30.4.2 → deepmerge 4.3.1. This produces five low entries including Jest ancestors. |

Asar 3 and dir-compare call minimatch as a function; minimatch 11 exports an object. Legacy glob 7 consumers also require callbacks, unlike newer promise-based glob. Latest dir-compare 5 still requests minimatch 3, and latest temp 0.9.4 still requests rimraf 2. Further packaging work needs compatible upstream changes/backports and separate universal/Windows validation. Asar 4 introduces ESM-only exports and is outside app-builder-lib's pinned contract; it was not forced into this change. No old Jest, ESLint or electron-builder downgrade was applied merely to clear audit output.

The advisory's broad minimatch affected range includes legacy majors even though its described preprocessing mechanism concerns modern versions. Upstream clarification may help, but these audit entries remain open. These tools consume repository/build configuration and are absent from the packaged application; they do not process Markdown opened by the shipped app.

## Verification

- Clean isolated `npm ci --ignore-scripts`, followed by the unchanged keychain-version guard, passed. A subsequent full `npm ci` with normal lifecycle execution also passed. The guard verified app-builder-lib 26.18.1; unknown versions still fail. `npm ls --all` reported no invalid dependencies.
- **846 tests / 52 suites with coverage**, lint, typecheck and production build passed. Generated `dist` bundles are excluded from source coverage; the desktop coverage threshold is unchanged. A FileList fixture also verified filtering through minimatch 11's `.match` API.
- Actual unsigned universal MAS assembly passed using the explicit MAS configuration, identity null, no profile, automatic identity discovery disabled and publication disabled. The process environment did not inherit signing credentials.
- App executable and unpacked bookmark addon contain **x86_64 and arm64**. All **125 packaged source files**, including **110 web files**, matched the isolated source manifest. Updater/feed, native sources/build trees and the affected build-tool packages were absent.
- ASAR SHA256: `8ca9464b5d0cec133dfcd3c9511e72f11c69f3952b06c6ecc60c761b9c595677`.

This is unsigned packaging evidence, not signed sandbox runtime or Store submission evidence. A PR-only workflow now validates unsigned Windows NSIS, Linux AppImage and macOS universal app packaging with read-only permissions, no signing secrets and publication disabled. Those platform results must pass before merge. All experiments ran locally on this Mac in an isolated temporary copy, with public npm/GitHub references only. No other computers, Apple login, keys, signing, upload or deployment were accessed.
