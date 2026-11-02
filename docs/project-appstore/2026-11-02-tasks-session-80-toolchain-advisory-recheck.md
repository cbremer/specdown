# Session 80: remaining build-tool advisories

Checkpoint: November 2, 2026. Re-audit of WK-19 / [issue #356](https://github.com/cbremer/specdown/issues/356), based on main `63c2e8af12fbc2aae0ce7a2a16cabdcc32e3a07d`. This is an audit and remediation handoff, **not a completed vulnerability fix**. No package, lockfile, application, signing or workflow files changed. Store versions remain **1.0.1 (230)** and direct desktop remains **0.0.232**.

## Current result

Fresh public npm audit of the exact lockfile reports **17 affected package entries: 12 moderate and five low**, arising from **two underlying advisories**. The production-only audit reports **zero**. GitHub independently reports exactly two open alerts, both with `development` scope: [122](https://github.com/cbremer/specdown/security/dependabot/122) and [120](https://github.com/cbremer/specdown/security/dependabot/120). Keep both alerts and #356 open.

The earlier reviewed dependency updates did not claim to resolve these remaining issues. The older [October 31 assessment](2026-10-31-spec-toolchain-advisories.md) remains historical; the versions and validation below are this fresh checkpoint.

| Issue | Exact remaining dependency | Live upstream result | Resolution blocker |
| --- | --- | --- | --- |
| [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), minimatch pattern amplification | Three development-only minimatch **3.1.5** copies under `@electron/asar`, `dir-compare` and legacy `glob` | Advisory lists **11.0.1** as patched; npm still lists **3.1.5** as the latest 3.x release. | The legacy consumers use callable CommonJS minimatch and callback-based glob APIs; newer exports are not drop-in replacements. No compatible patched legacy release was found. |
| [GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4), deepmerge returned-object prototype poisoning | Jest **30.5.2** → jest-config **30.5.2** → deepmerge **4.3.1** | Jest **30.5.2** and deepmerge **4.3.1** are still the latest published releases; the advisory lists **no patched version**. | Updating within the current Jest release line cannot remove the affected dependency today. |

All four flagged lockfile locations have `dev: true`. Their consumers are build/test configuration tools, rather than the Markdown rendering path. This narrows exposure; it does not dismiss the advisories or prove every possible developer-input path safe. The production audit is dependency-inventory evidence, not a new signed-app or runtime security certification.

## Why another dependency bump is not a safe fix today

The reviewed lockfile uses electron-builder/app-builder-lib **26.18.1**. Its public registry contract pins `@electron/asar` **3.4.1** and `@electron/universal` **2.0.3**. The universal dependency brings `dir-compare` **4.2.0**; the installed Windows packaging chain also retains electron-winstaller **5.4.0** → temp **0.9.4** → rimraf **2.6.3** → glob **7.2.3**. The direct Windows target is NSIS, but the unused Squirrel tooling dependency still remains in the installed development tree and audit inventory.

Registry checks also examined the alternatives:

- electron-builder's `v26` tag remains **26.18.1**; its `latest` tag is **26.18.0**, so following that tag would downgrade the reviewed version rather than fix these issues.
- Newer `@electron/asar` **4.3.1** and `@electron/universal` **3.0.6** move to ESM-only major lines. Their [asar 4](https://github.com/electron/asar/releases/tag/v4.0.0) and [universal 3](https://github.com/electron/universal/releases/tag/v3.0.0) release notes explicitly document the breaking module/runtime changes. They are outside the current builder's pinned contract.
- electron-builder **27.0.0-alpha.14** uses those newer lines, but also changes signing, notarization, resource editing and other packaging dependencies. It is a prerelease migration, not a scoped compatible patch; the existing signing-source guard deliberately rejects an unreviewed builder version.
- Latest dir-compare **5.0.0** still requests minimatch 3. Latest electron-winstaller **5.4.4** still requests asar 3 and temp 0.9.4. Those upgrades alone would leave the relevant legacy paths.
- npm's `fixAvailable` suggestions are major **downgrades** to Jest 25.1.0 and electron-builder 25.1.8. Neither was applied. No forced audit fix, blanket override, alert dismissal or version rollback was used.

Small local compatibility probes independently confirmed that the installed legacy minimatch export is callable, while the patched 11.x export is an object with named functions. Substituting it into a legacy direct call throws `TypeError`. Source inspection also confirmed asar's callback-glob adaptation and dir-compare's callable minimatch use.

The minimatch advisory describes `firstPhasePreProcess()` in a modern version, whereas the installed 3.1.5 source has no such method. That discrepancy is a reason to seek an upstream affected-range clarification, **not** sufficient evidence to dismiss the broad advisory locally. No hostile resource-exhaustion stress test was run.

A tiny synthetic deepmerge probe reproduced the advertised returned-object prototype poisoning when an input target has an own `__proto__` property. It did not modify the global Object prototype and did not use application data. This verifies the package behavior; it does not establish an exploitable SpecDown document or Jest configuration path. The [upstream issue](https://github.com/TehShrike/deepmerge/issues/273) remains the published report referenced by the advisory.

## Concrete resolution paths

1. **Preferred upstream path:** adopt a released compatible backport or a stable builder/Jest update that removes the affected branches. Re-run the complete audit and verify every old affected location is gone; a successful install alone is insufficient.
2. **Minimatch-specific clarification:** obtain an upstream correction to the affected legacy range if maintainers establish that the described mechanism does not apply. Keep the current alert open until authoritative metadata changes and the exact-lock audit reflects that outcome.
3. **If a fix is needed before upstream publishes one:** prepare a separate reviewed compatibility/backport change with an explicitly maintained source and provenance. It must preserve the legacy minimatch/glob calling contracts, test real archive include/exclude/unpack behavior, and preserve deepmerge/Jest merge semantics while rejecting dangerous keys. A local postinstall patch would not by itself remove the advisory from the lockfile, and must not be reported as a clean dependency inventory.
4. **Broader replacement path:** evaluate the stable successor to the builder prerelease or a test-runner migration separately. This requires cross-platform package/installer review and signing-policy review; it is larger than closing two transitive alerts.

For any dependency-changing candidate, require clean installation, complete dependency audit, coverage/lint/typecheck/web build, actual unsigned universal Mac and MAS packaging, Windows NSIS and Linux AppImage checks, then inspection of source/dependency inclusion, permissions, update feeds and universal native slices. A signing-tool change also requires its own authorized signing verification before release. Do not reuse current signed release evidence for changed dependencies.

## Verification and retained evidence

The isolated worktree is `.claude/worktrees/specdown-toolchain-advisories-20261102`; evidence is its ignored `ios/DerivedData/toolchain-advisories-20261102/` directory. Public registry/audit calls used empty npm configuration files, no credential values and an isolated cache. Initial restricted-network failures were retained separately; the live audit results came from successful scoped public-registry requests.

- Exact unchanged lockfile SHA-256: `5b6414ee1fbf0e87faffa19d3c5594adfa8c181c959e6dc39160fa1871b55ab2`.
- A clean `npm ci --ignore-scripts` passed, followed by the unchanged signing-source guard and `npm ls --all`. Lifecycle downloads/signing were not invoked.
- **1,440 tests / 80 suites**, including required coverage, passed. Lint, typecheck and production web build passed.
- `audit-before-live.json`, `audit-production-before-live.json` and `dependabot-open.json` preserve the exact current results. `registry-*.json` retains the examined versions/contracts; `compatibility-evidence.json` records the bounded API/prototype probes.
- Application source, dependency lock, release versions and packaging configuration are unchanged. Existing signed artifacts were not rebuilt, signed, installed, uploaded or relabeled. No new cross-platform packaging claim is made for this documentation-only audit.
- The canonical owner checkout and frozen Dev/Beta signing worktree remain unchanged. No Apple session, private keys, other computer or live document/note store was accessed.

**Closure condition:** #356 stays open until both dependency issues have a verified remediation or authoritative affected-range correction. This session records the current blockers and exact next validation steps; it does not mark WK-19 complete.
