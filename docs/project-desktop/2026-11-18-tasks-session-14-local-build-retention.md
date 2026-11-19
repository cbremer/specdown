# Session 14 — Standard local build retention

All four Apple app platforms use the [standard retained build location](../../README.md#standard-home-for-retained-builds). Local Electron packaging and the mobile build wrapper stage verified copies outside the worktree. A dual-family mobile build has one physical package and an iPadOS directory link.

The initial Dev backfill preserves direct Mac 0.0.234, Mac App Store 1.0.4 (252), and mobile 1.0.4 (251) device and simulator products. The simulator's bundled viewer differs from the final device viewer. Its exact source revision is recorded as unknown. Retention records identify built artifacts independently of installation or physical-device acceptance.

The local Electron packager and a real unsigned Xcode simulator build exercised the automatic retention paths using a temporary archive. A separate fixture checked concurrent writers, idempotent repeats, changed bytes under an existing build number, corruption detection, and retention of an entire Xcode archive with symbols and an accompanying export. The retained Mac Store and mobile device bundles passed strict signature checks.

The README and AGENTS.md also identify the current DOCX/PDF/OCR implementations and distinguish the earlier Microsoft MarkItDown evaluation from the Dev app runtime.
