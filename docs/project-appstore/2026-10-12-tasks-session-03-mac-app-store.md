# Session 03: Mac App Store build (AS-021..026)

**Date:** 2026-10-12. **Scope:** P05 lane under the owner's live order — sandbox
spike, grants behind the bridge, store/direct channel separation, MAS packaging
config and a development-signed sandbox build. **Stop before** any App Store
Connect change, upload or submission.

- [x] AS-021: launched a sandboxed Electron 44 MAS spike; proved/disproved each
      access mechanism and wrote the [access contract](mas-interface.md).
- [x] AS-024: separate the MAS channel from the direct (Developer ID) channel —
      no electron-updater, no update UI, no GitHub release polling in MAS.
- [x] AS-022/023 (code + unit tests; native QA pending): durable grants (native security-scoped bookmarks), balanced
      access, polling watch, folder/CSS grants, recovery UX, migration.
- [ ] AS-026: `mas` / `mas-dev` electron-builder targets, justified
      entitlements, local sandbox build + QA evidence.
- [ ] AS-027/028: blocked on Store certificates/profiles and owner approval.

Decisions taken in this session (implementation-level, no account impact):
native bookmark module for MAS only; polling watch for MAS; no temporary
entitlement exceptions. See [mas-interface.md](mas-interface.md).
