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

## Sandbox evidence from the real app (unprovisioned mas-dev, arm64)

`SPECDOWN_MAS_UNPROVISIONED=1 npm run desktop:mas-dev` at the AS-026 branch,
signed with the Apple Development identity, `codesign --verify --deep --strict`
clean. Info.plist: `com.mosaicpando.specdown`, `SpecDown`, category
developer-tools, `ITSAppUsesNonExemptEncryption=false`, `.md`/`.markdown`
document types, minimum macOS 12.0. Entitlements exactly as
`build/entitlements.mas.plist`; helpers sandbox + inherit only. No
`app-update.yml`, no electron-updater in the asar; the native module is
unpacked and the sources aren't shipped. Logs: shared session notes
`mas-devbuild-qa-2026-10-12/`.

| Check                                     | Result                                                                                                    |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Launch under sandbox; updater             | ✅ "Auto-update disabled: Mac App Store build" (Q15)                                                      |
| Finder open (`open -a`) → quit → relaunch | ✅ session restored from the persisted bookmark, no access prompt (Q01 Finder, Q04, Q05)                  |
| File moved while closed → relaunch        | ✅ "Granted item moved: …/qa.md -> …/other/qa-moved.md"; the next launch restored the new path (Q03, Q05) |
| File deleted while closed → relaunch      | ✅ bookmark fails to resolve → `file-access-needed` → Locate… toast (Q03, Q21)                            |

Still manual (needs someone at the Mac): Open/Open Folder/CSS pickers and
relaunch (Q01, Q06, Q07), live reload on a save (Q02), drag-and-drop (Q08),
print sheet and Export as PDF + reveal (Q10, Q11), real rendering (Q12),
provider/iCloud files (Q09), the Locate… toast click-through.
