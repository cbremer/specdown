# SpecDown 1.0.2 implementation handoff

This is the saved implementation brief for the six agreed next-release features. **Saving this prompt does not start implementation or authorize signing, uploads, submission or release.** Use it when Chris assigns the implementation task. Target Store marketing version **1.0.2**; retain production **1.0.1 (230)** and its artifacts unchanged.

## Copy/paste agent prompt

> Implement all six features below as a coherent, reviewed SpecDown 1.0.2 candidate. Read `CLAUDE.md`, its hard-won learnings and the linked contracts first. Work from freshly verified `origin/main` in a new `codex/` worktree under `<repo>/.claude/worktrees/`. Main was last observed at `63c2e8af12fbc2aae0ce7a2a16cabdcc32e3a07d` when this brief was drafted; verify the actual current head and PR state rather than treating that checkpoint as a permanent base.
>
> Preserve `<repo>` and its canonical Xcode project, owner artwork, signing settings, unrelated changes, existing installed apps and the retained production 230 evidence. Work only on this Mac and authorized project services. Never reach another computer through SSH, remote desktop, network shares or another transport. This task ends with an exact reviewable candidate and handoff. It does not authorize merging, signing, installing over production, creating credentials/profiles, uploading, submitting, publishing or changing account/release settings.
>
> Inspect current implementations before coding. Do not count historical unchecked tasks as proof that a feature is missing. Document decisions and acceptance criteria; use separate agents for independent review when useful. Deliver complete user flows with real platform consumers, not disconnected helper libraries.

### 1. Native iOS recent documents

- Let iPhone/iPad users reopen accepted documents from a discoverable recent-documents UI, including after relaunch. The existing stored display names are not enough to reopen files.
- Use native security-scoped bookmark/provider authority and stable source descriptors. A renderer path, filename, equal bytes or a recent entry never grants filesystem access. Start/stop scoped access correctly; keep native title/recents changes behind accepted-load callbacks.
- Cover same-name files in different locations, moves, deletion, expired/revoked access, regrant, cloud-provider eviction/offline availability, repeated opening, cancellation and stale asynchronous replies. Show a useful recovery path without replacing the current document on failure.
- Persist only appropriate bounded metadata; do not copy documents into a hidden store or transfer notes merely to implement recents. Preserve separate Dev/Beta/production app data.

### 2. Local relative images on iOS

- Make images beside an opened Markdown document render through an explicitly authorized resource/folder flow. Explain when the user must choose the containing folder; picking one file does not automatically grant its directory.
- Keep document resources distinct from the bundled `specdown://app` web origin. Bind resource tokens to the authorized document, native scope and current view generation; stale loads must not cross documents or survive revoked authority.
- Reject traversal, encoded traversal, absolute/ungranted paths, symlink escapes and unsupported schemes. Bound individual bytes, decoded dimensions, resource count and aggregate work; preserve MIME/sanitization/CSP protections. Do not make a broad read-access directory or permit arbitrary native file URLs as a shortcut.
- Exercise valid sibling/nested images, spaces/non-ASCII names, missing/oversized/corrupt files, provider/offline errors, document switch, folder regrant and close/reopen with actual native evidence. Leave remote-image/network policy explicit.

### 3. Native PNG/SVG diagram export on iPhone/iPad

- Add reachable native export actions for PNG and SVG through the iPhone action UI and iPad controls. Produce an actual share/saveable file through the native bridge; do not restore the removed diagram Link feature.
- Require explicit user intent and the captured current diagram/document. Bound SVG payloads, raster dimensions and temporary storage; use safe filenames/MIME types and narrowly validated bridge messages. Do not grant arbitrary writes or allow stale export completions to act on a new document.
- Cover share-sheet presentation on phone/tablet, Files destination, cancel, concurrent requests, render failure, backgrounding and temporary-file cleanup after the consumer is done. Verify real exported files, not just a JavaScript callback.

### 4. Matching icon artwork across platforms

- Offer the same eight approved artworks, including Light, where the platform supports runtime icon choice. Preserve existing masters, prior exports, channel-default mappings and desktop-specific geometry; derive missing platform exports reproducibly instead of inventing replacements.
- Preserve iOS Original/Flat/Light primary-vs-alternate mapping across production/Dev/Beta and UIKit's primary-icon behavior. Test each choice and reset after relaunch.
- On desktop distinguish running Dock/window icons from the packaged Finder/Start-menu/shortcut icon. Do not promise runtime changes to every OS surface. Verify Windows/Linux limitations and actual package assets; preserve direct/MAS/channel identities.

### 5. Public GitHub repository browsing

- Reproduce the current repo-browser behavior first. Provide a useful unauthenticated public-repository Markdown browsing flow without relying on code-search access that may require authentication. Do not add token storage, private-repository access or an account-login feature to this scope.
- Support explicit owner/repository, branch/ref selection and bounded directory/file discovery. Handle pagination, truncated trees, rate limits, inaccessible repositories, empty results, network errors, spaces/non-ASCII paths and URL encoding. Explain the limit instead of silently showing an incomplete tree as complete.
- Fetch only through the existing approved URL/security boundary. Pin navigation/content to the selected repository/ref; do not turn returned URLs into unrestricted fetch authority. Cancel stale results on navigation and keep a rejected document from replacing the accepted view.
- Verify real public API/browser behavior with primary documentation where needed; mocked fetch success alone does not demonstrate usable unauthenticated browsing.

### 6. Annotation identity, backup and recovery on web/desktop

- Implement the full [annotation recovery contract](2026-10-31-spec-annotation-recovery-contract.md), including **all 36 acceptance cases**, using synthetic stores only. Existing notes keyed by a filename and a raw export button are not this feature. Native iOS annotations remain disabled at UI, bridge, rendering, import/export and storage boundaries; new touch annotation editing is out of scope.
- Resolve and record the authoritative transaction backend, browser/Electron origins and partitions, native source continuity, per-platform numerical transport/memory/storage limits and undo/retention semantics before enabling behavior. A localStorage read-check-write, renderer mutex, BroadcastChannel or lease is not compare-and-swap.
- Complete an actual capture → immutable archive → export → reselect/import → restore staging → preview → explicit association/reconnection → conflict-safe undo flow in web, direct desktop and MAS. Do not stop at an isolated parser/transport helper.
- Separate store/document/collection identity, occurrence lineage, native source authority and transient view generations. Filename/hash equality must neither merge notes nor grant access. Preserve duplicate occurrences, unknown/corrupt/future data and unmapped collections; make recovery discoverable without opening the source document.
- Preserve original localStorage UTF-16 code units and imported raw file bytes in declared formats. A Blob/string round trip can change lone surrogates; verify actual exported/reselected files. Bound manifests/chunks/aggregate decoding and projections, preserve opaque over-limit material, and report unsupported capacity honestly without truncation.
- Keep private recovery backups distinct from deliberately lossy/redacted portable exchange. Imported paths/tokens are untrusted descriptors, never recreated permissions. Preview/import must not open paths or fetch URLs.
- Use real atomic revision/epoch/operation checks; protect current state before replacement. Test concurrency, crash points, quota/serialization failure, interrupted staging, stale previews, retries, old-version coexistence and rollback. Undo must preserve later edits and unrelated work; do not replace an entire store to reverse one operation.
- Never read or migrate Chris's live annotation stores. Do not overwrite the legacy key, silently activate old data, remove archives to make space or claim a migration succeeded from unit-only evidence.

## Integration order and completion gates

Start with shared source identity/authorized-resource/lifecycle decisions because recents, images and recovery depend on them. Implement icon/export/repository work in separately reviewable slices where appropriate; integrate without duplicating previously merged fixes. Keep the current document safe across rejection, reload, raw/preview changes, tabs and asynchronous rendering.

Use the [platform testing runbook](../project-desktop/2026-11-02-spec-platform-testing-runbook.md) for scoped evidence and host-safe handoffs. Do not interpret it as permission to use another host. Required repository tests, lint/typecheck, appropriate native checks, production-browser verification, real simulator/native UI checks and independent source review must pass for the exact final candidate. Include adversarial/negative cases, not tests that merely mirror implementation. Distinguish source, unsigned artifact, simulator, signed sandbox and physical-device results; mark missing native acceptance explicitly.

Preserve one logical commit per PR and use reviewed integration candidates. Do not merge or release as part of this handoff. Store marketing version is 1.0.2; choose an unused monotonic build number from fresh local/provider evidence only when authorized to prepare that build. Do not reuse or relabel production 230, infer a reservation from simulator metadata, or force the independent direct-desktop version stream to match Store marketing numbers.

Finish with exact source/PR heads, decisions, remaining gates, test evidence and a concise owner testing checklist. Update relevant documentation/backlog without claiming live deployment. Keep these separate follow-ups out of this feature implementation: development-tool advisory remediation, credential/secret-scope migration, release-policy changes, off-device backup verification, HTML mode and new iOS touch annotations. Report a genuinely blocked requirement with the evidence and next owner decision; do not silently drop one of the six features or weaken a security boundary to finish.
