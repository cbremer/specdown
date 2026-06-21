# Session 03 — Resolve the js-yaml DoS Dependabot advisory

**Date:** 2026-06-21
**Type:** tasks
**Surface:** tooling / supply chain (dev-only dependency).

## Problem

A push to the branch surfaced a Dependabot alert: **1 moderate** vulnerability
on the default branch — [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68),
a quadratic-complexity DoS in **js-yaml** merge-key handling (`js-yaml <= 4.1.1`).

### Assessment

The vulnerable copy was **`js-yaml@3.14.2`**, reached only through a **dev-only**
chain:

```
jest → @jest/core → @jest/transform → babel-plugin-istanbul
     → @istanbuljs/load-nyc-config → js-yaml@3.14.2
```

`@istanbuljs/load-nyc-config` uses js-yaml solely to parse local, developer-authored
`.nycrc(.yaml)` coverage config — never untrusted input — so real-world exposure
was effectively nil. But it's worth clearing: the alert is noise on every push,
and a patched js-yaml exists.

(The other js-yaml in the tree, via `electron-builder`, was already `4.2.0` —
patched — and not flagged.)

## Why not `npm audit fix --force`

`audit fix --force` wanted to **downgrade jest to 25.0.0** (a major breaking
change) — wrong tool for a deep transitive. Rejected.

## Fix

There is **no patched 3.x release** (3.14.2 is the last 3.x); the fix lands in
`js-yaml@4.2.0`. `@istanbuljs/load-nyc-config` declares `js-yaml@^3.13.1` but its
code calls only `require('js-yaml').load(...)`, and `.load()` exists in **both**
v3 and v4 (in v4 it's the safe loader) — so bumping it to v4 is API-safe.

Added a **scoped npm `overrides`** in `package.json`:

```json
"overrides": {
  "@istanbuljs/load-nyc-config": { "js-yaml": "^4.2.0" }
}
```

Scoped (not a global js-yaml override) so it touches only the one vulnerable
path. The lockfile was updated **surgically** — removed the nested
`js-yaml@3.14.2` and its now-orphaned transitives (`argparse@1`, `esprima`,
`sprintf-js`); `load-nyc-config` now dedupes to the root `js-yaml@4.2.0`. Net
lock diff is ~47 lines, no unrelated dependency churn.

## Gates

- `npm ci` — clean install, **0 vulnerabilities** (`npm audit`)
- `npm run lint` — 0 errors
- `npm run typecheck` — clean
- `npm test` — 448/448 pass
- `npm run test:coverage` — passes (exercises the `load-nyc-config` → js-yaml
  path, confirming the v4 bump doesn't break coverage instrumentation)
- `npm run build` — succeeds

## Notes / follow-ups

- Pure dev/tooling change; production runtime deps (pinned exact) untouched.
- The override can be dropped once `@istanbuljs/load-nyc-config` (upstream)
  moves off js-yaml 3.x on its own.
