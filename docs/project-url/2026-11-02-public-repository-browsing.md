# Public repository browsing — 1.0.2 development evidence

Baseline: main `63c2e8af12fbc2aae0ce7a2a16cabdcc32e3a07d`. Worktree: `specdown-wave-102-20261102`; canonical phone checkout preserved.

## Problem and behavior

Unauthenticated Code Search returned HTTP 401 in a real read-only reproduction. Public repository metadata, commit resolution and Git Trees replace that credential-required flow. Existing raw/blob Markdown URL handling and bounded document reads remain in place. Selection pins the listed commit. Branch and folder URLs resolve bounded longest-ref candidates, including encoded slash names; GitHub's specific missing-SHA 422 response permits the next candidate while unrelated validation failures stop.

Recursive Git Trees has no pagination. Truncated trees fall back to bounded iterative subtree traversal, never partial advertised success. Limits: 32 requests, 8 MiB aggregate body bytes, 20,000 entries, 2,000 Markdown files, eight branch/path candidates and 30 seconds. Rate limits, unavailable/private repos and unsupported capacity show recovery guidance. Symlinks/submodules are excluded; paths and SHA identifiers are validated and remote-supplied URLs are never followed. Fetch omits credentials and rejects redirects.

Repository results, file selection and the subsequent raw fetch retain both request epochs and accepted-document generations. Keyboard Enter/Space opens a focused file item.

## Validation

- Baseline: 80 suites / 1,440 tests passed.
- Regression tests cover public tree listing, default/custom branches, slash encoding, exact commit/path URLs, missing refs, empty repos, errors, truncation traversal, entry/file/request/streaming limits, unsafe paths and stale responses.
- Real public API: repository root listed 228 Markdown files; `tree/main/docs/project-url` listed four; selected URLs were pinned to `63c2e8a`.
- Real in-app browser on isolated `http://127.0.0.1:5184/`: repository folder → four listed files → README filter → select → rendered README.md/project-url heading. Real marked and DOMPurify were used through Vite, rather than the Jest passthrough mocks.
- Full coverage suite, lint, typecheck and production build pass; exact final counts recorded in the batch session ledger. Existing Vite large-chunk advisory and Jest listener warnings remain separate from clean lint.
- Independent agent review found deep-URL fallthrough and selected-raw-fetch races. Both were reproduced with failing tests, fixed, and passed scoped independent re-review with no remaining actionable finding.

Desktop/MAS/iOS network/provider runtime acceptance remains distinct from browser/API evidence. No signing, native installation, account changes, deployment or merge occurred.
