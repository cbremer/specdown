# Session 101 · Word and PDF import release candidate

Prepare the iOS, iPadOS and Mac App Store production candidate as 1.0.5 (257). Use the production identity on both Store records. Production imports use the paths exercised in Beta 256. The owner approved promoting the Beta 256 design into these Store candidates.

- Runtime source is commit `3375ea4` (imports in `6db32f2`, approved design in `3375ea4`). Both production packages use explicit version and build overrides.
- [Submission packet](../../app-store/release-assets/1.0.5-257/) contains the public descriptions, release notes, promotional text, reviewer walkthrough, fixtures and screenshots.
- [Changelog](../../CHANGELOG.md) summarizes Word and PDF import, on-device recognition, basic edits and annotation recovery security improvements.
- On November 19, the owner approved the corrected gallery and submission. Both App Store Connect records showed Waiting for Review for 1.0.5 (257) at 9:50 a.m. Pacific, with automatic release after approval.

Both signed candidates use the production bundle ID and version 1.0.5 (257). Choose the retained artifacts from runtime revision `3375ea46db79` under the platform’s `prod` folder. An earlier local build 257 from `6db32f2` predates the design promotion. For Mac, choose the universal distribution installer. The ARM-only development-signed app was used for screenshot capture.

The release source passed 98 Jest suites (1,620 tests), lint, typecheck and the web build. Two native simulator tests opened Word and mixed text/scanned PDF documents, edited the contents, saved Markdown copies, checked their contents and verified the original inputs. The signed Mac bundle contains the same 304 viewer files as the production web build. The Apple Store distribution installer and universal app signature were checked locally.
