# Session 01 — repository documentation security and privacy audit

Reviewed November 2, 2026, from a clean checkout at
`9d27fc1a6961e29c86def43cee17c6fbb7d66db1`, branch
`codex/local-reviewed-main-230`, origin `https://github.com/cbremer/specdown`.
This report describes that local source and the accompanying uncommitted cleanup;
no current GitHub, Apple or public deployment status is inferred.

## Scope and method

- Enumerated all tracked files and scanned all 472 UTF-8 text files. The 221
  Markdown/HTML/text-extension inputs include `.env.html`, a public feature flag.
  Coverage includes root and platform READMEs, agent/skill instructions, all project
  plans and task logs, Store metadata, samples, fixtures and HTML proof pages.
- Searched for personal home directories, credential-bearing URLs, key/token
  signatures, secret assignments, risky shell commands and instruction/permission
  bypass language. Reviewed flagged contexts, executable command examples,
  publication exclusions and release instructions against tracked source/workflows.
- Scanned 1,496 distinct historical text/configuration/key-extension blob objects
  reachable through local Git refs (52,160,981 bytes) for private-key headers and
  recognizable GitHub, AWS, Slack and OpenAI access-token signatures. No matches.
  This is a targeted signature scan, not a comprehensive entropy/secret scanner.
- Checked tracked file modes: no tracked symlinks or submodules. Inspected local
  agent-directory entry names and permission-rule structure without following
  nested worktrees or accessing sibling credential stores or Keychain. The 18
  local allow rules had no unrestricted `Bash(*)` entry or credential-read command
  signatures in the checked forms; this is not a complete permissions audit.
- Reviewed all 40 tracked PNG/JPEG images under `docs/` and `app-store/` as a
  contact sheet and inspected their image/EXIF metadata. They appear to be product
  artwork and synthetic sample-document captures. Found only image/color/format
  metadata, with no GPS, personal author or device metadata. Visual inspection
  was at contact-sheet resolution, not OCR or a pixel-by-pixel forensic review.

## Findings and disposition

| Finding                                                                                                 | Impact                                                                                                                         | Change or remaining boundary                                                                                                                       |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20 personal absolute-path occurrences across 12 tracked documentation/skill files                       | Discloses the owner's username, checkout layout and archive/generated-image locations; paths alone do not grant machine access | Replaced with repository-relative paths or explicit placeholders; kept source/artifact hashes                                                      |
| Common credential types and local agent/credential directories had no repository ignore rules           | A new key/profile/env file or agent state could be accidentally staged; local settings relied on a machine-global ignore       | Added repository rules for local agent state, credential directories, env files and common signing/key types; retained public `.env.html`          |
| Two release-proof links pointed inside local worktrees                                                  | Broken public links and unnecessary local layout disclosure                                                                    | Linked the retained Session 44/45 documents directly                                                                                               |
| Historical signing/distribution guides described repository-wide secrets and automatic Apple uploads    | Readers could follow obsolete credential/release procedures                                                                    | Added prominent superseded notices to three guides, linked current release/channel rules, removed the private-key-to-terminal example              |
| Main agent guide described only two surfaces and iOS as build-from-source only                          | Stale instructions could cause wrong scheme, signing or release assumptions                                                    | Updated platform overview, branch conventions, Dev/production boundary and privacy instructions; retained merge discipline and render/test gotchas |
| Vite config uses `server.host: true`                                                                    | Running bare `npm run dev` listens on all interfaces; reachability depends on network/firewall configuration                   | All current setup/agent commands now specify `--host 127.0.0.1`; config remains unchanged for deliberate LAN testing                               |
| Private recovery runbook, three authenticated portal captures and a Word working original exist locally | Private recovery logistics/account evidence can leak through manual copies or repository-root hosting                          | Confirmed these five exact paths are untracked and ignored; preserved their bytes and existing publication inventory                               |
| Default Jest discovery entered ignored native source archives                                           | Old test copies caused module collisions and missing-file failures during the initial check; that run was stopped              | Documented `--roots ./tests` and agent-worktree lint exclusions; no archives deleted                                                               |
| Earlier project READMEs presented obsolete implementation/release snapshots as current                  | Confuses historical feature/check evidence with current behavior                                                               | Added dated/history boundaries, refreshed iOS/desktop entry guidance, and linked the audit and security policy                                     |

No private-key or recognizable access-token signature was found in the scanned
current text or historical objects. No suspicious credential assignment was found
in the current assignment-pattern review. No tracked credential files, active Git
hooks, or tracked symlinks were identified. Local `.claude/` holds permissions and
worktrees; a directory name alone is not evidence of compromise. The tracked
`.env.html` contains only a documented HTML-mode feature flag.

## Privacy and publication boundaries

The five ignored release originals are intentionally private. Preserve them and
follow their existing [publication inventory](../project-appstore/2026-11-01-publication-inventory.json).
That inventory is a dated hash record and was not rewritten to pretend these
later documentation edits were its original publication bytes. Older commits
still contain personal paths removed from the working tree. No history rewrite,
credential rotation or private-original deletion was performed.

Public support addresses, bundle/app IDs, source revisions, artifact hashes and
ordinary authenticated portal resource links were retained where they establish
provenance; they do not contain authentication credentials or grant account
access. New docs should omit personal device and account identifiers unless
necessary. The old privacy-policy draft and questionnaires remain dated drafts,
not newly approved legal/Store answers; the published-policy source is identified
explicitly. Reading a Markdown file can cause remote image requests, and exported
notes/diagnostics can contain private content even without analytics.

## Verification and limits

- [x] Scan all tracked text and the selected reachable historical objects.
- [x] Review flagged commands, path disclosures, agent instructions and image metadata.
- [x] Normalize personal paths and repair local-worktree links.
- [x] Add ignore protections and current security/privacy guidance.
- [x] `git diff --check`: passed; changed/new Markdown relative file links resolve.
- [x] Ignore-rule probes: local agent/credential/env/signing examples ignored;
      `.env.html`, README and repository skill remain trackable. All five existing
      private-release exclusions remain untracked and ignored.
- [x] `npm test -- --runInBand --roots ./tests`: 78 suites, 1,371 tests passed.
      Output retained pre-existing listener warnings and `fatal: Needed a single
revision` from a subprocess despite Jest exiting successfully; these diagnostics
      were not investigated as application failures in this documentation task.
- [x] `npm run lint -- --ignore-pattern 'ios/DerivedData/**' --ignore-pattern '.claude/**'`:
      passed with zero warnings; `npm run typecheck`: passed.
- [x] Prettier check for the three new Markdown files: passed. Existing historical
      docs were edited minimally without whole-file reformatting.

The initial unscoped test invocation was stopped after discovering old test copies;
no passing default `npm test` result is claimed. The first unscoped lint invocation
was also stopped; the scoped lint result above is the completed check.

This is not a full host-compromise investigation, application penetration test,
dependency advisory audit or external account review. No credentials outside the
repository, Keychain items, sibling repositories, nested worktrees, unreachable/deleted
Git objects, remote-only refs or old binary history were audited. Generated build
contents were not included in the documentation audit; the initial default Jest
run inadvertently discovered retained test copies there before it was stopped. Ignored binary originals were preserved rather than
republished or forensically inspected. Custom-format or encoded secrets can evade
these scans. No install, native build, signing, upload, submission, push, merge or
public deployment is part of this audit.

## PR integration verification

The original audit above remains scoped to `9d27fc1`. For the requested review PR,
the cleanup was applied in an isolated checkout to freshly fetched `origin/main`
`6f2747a` (shared-viewer version 0.0.232). Documentation conflicts were resolved
by retaining main's newer four-surface overview, channel/testing handoffs,
platform-neutral package commands and current release-approval modes.
The canonical owner checkout and its ignored private originals were preserved.

A fresh current-text signature scan found no recognizable key/token signatures.
It identified five additional personal home-path occurrences in three documents
added since the audit: the platform testing runbook, 1.0.2 agent handoff and
Session 78 channel/signing handoff. These were normalized with the same portable
path convention. This integration scan does not expand the original historical
blob or image-review coverage to all subsequent additions.

On the integrated source, `npm test -- --runInBand --roots ./tests` passed all
80 suites and 1,440 tests, with the existing listener warnings. Unmodified
`npm run lint` and `npm run typecheck` both passed in the clean isolated checkout.
The reused dependency installation matches its committed lock graph apart from
package-version metadata. The PR changes documentation and ignore rules only;
no application source, workflow, dependency or release-policy change is included.
