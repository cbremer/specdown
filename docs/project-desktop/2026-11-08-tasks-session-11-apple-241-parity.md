# Session 11: direct desktop parity with Apple build 241

## Scope

The owner requested that the changes submitted to Apple also reach the direct
desktop edition. Preserve the canonical Xcode checkout, installed applications
and the submitted Apple packages. Prepare a desktop candidate and a single
release-source PR against current main. Publication remains a separate step.

## Source and versioning

Current main is `4164860b1b5b753a28118f040ebafbd41d3c7ec9`. Consolidate the
complete candidate from `325d2c90ea791205e7f5e4938ab7a7cc2e9c5067` onto it,
including the initial GitHub download-error correction and Open File wording.
The Apple application payloads were built from
`b11b25594e5f093ca8152d9225200a9d75736257`; its later changes are documentation.

The consolidated application source is identical to that candidate. The new PR
supersedes the source changes represented by PRs 419, 420, 423 and 424. Do not
also merge those constituent drafts into the consolidated change.

The public direct desktop release remains `v0.0.232`. Keep its version sequence
independent from Apple's 1.0.2 marketing version. The reviewed version workflow
will assign the next public desktop version and immutable tag.

## Desktop behavior included

- Open File wording in the home screen, command palette, native File menu and
  system picker.
- Starfield for a new theme preference, Basic naming, the Light app icon and
  diagram Presentation mode.
- Public GitHub repository browsing and shared URL-opening error handling.
- Document identity and annotation backup/recovery improvements.
- Existing direct-desktop file/folder access, live reload, printing, PDF export
  and the protected direct-update delivery path.

iPhone sheets and iPad popovers remain native mobile affordances. Desktop keeps
the same inline URL entry used by the Mac App Store edition. Apple-only document
permissions and Store channel metadata remain specific to those shells.

## Validation and delivery

- [x] Verify that the consolidated application files match the Apple candidate.
- [x] Build a fresh local Apple Silicon direct-desktop candidate.
- [x] Compare every packaged viewer and desktop source file with the submitted
      Apple payload and the current source.
- [x] Run the full tests, lint, strict types and direct file-watcher checks.
- [ ] Inspect all required remote checks before source publication.

Local validation passes 89 suites / 1,527 tests, lint, strict types and all three
real watcher modes with normal macOS filesystem access. Restricted watcher runs
reported EMFILE and are recorded separately from the successful normal-access
run.

The verified local package has direct identity `com.specdown.desktop`, existing
desktop version `0.0.232` and internal build `241`. Its 110 bundled viewer files
and 20 desktop files match the submitted Apple payload byte for byte. All 103
tracked application inputs remain identical to the candidate. The updater and
watcher dependency closure contains all 18 required packages.

An initial package using shared dependency inputs omitted updater dependencies
and was rejected by verification. A clean install from the unchanged lockfile
produced the verified package. A subsequent download timeout was avoided by
using the cached Electron 45.1.0 archive after matching its SHA-256 against the
official vendor release metadata. No application or release-workflow workaround
was added.

The prior Windows/Linux package jobs reported HTTP 504 download failures.
Recheck the new consolidated PR's exact-head package jobs; local Mac packaging
does not establish Windows/Linux package or runtime acceptance.

Keep native artifacts, package comparison manifests and build logs ignored.
The local candidate is an unsigned packaging check; installed-app replacement,
hands-on acceptance, signing/notarization and public distribution are separate.
Windows and Linux runtime acceptance requires separately authorized hosts.
