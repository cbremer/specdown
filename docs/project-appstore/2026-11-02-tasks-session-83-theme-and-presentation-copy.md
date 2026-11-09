# Session 83: Starfield startup, Basic theme and diagram presentation copy

Chris requested Starfield as the initial theme on iOS, direct desktop, Mac Store
and web, then renamed the old Default theme to Basic. He also requested that
App Store descriptions explain diagram-only presentation mode.

## Implementation plan

1. Change the shared initial preference fallback to Starfield and align initial
   renderer/menu state. Preserve saved named themes and legacy opt-outs.
2. Rename the visible Default label to Basic while retaining its `default`
   storage/IPC/CSS ID. Add the presentation feature and theme choices to new
   draft iOS/Mac descriptions, preserving the approved 230 copy packet.
3. Run focused and full source checks, then refresh the separate local Dev apps
   under a new local build number so owner testing includes these changes.

The shared module supplies every surface. The direct and MAS shells also use
the same fallback menu catalog; iOS labels come from the shared catalog. No
new presentation behavior or annotation capability is introduced.

## Verification

The updated regression tests failed against the old native startup defaults
and old Default labels before implementation. They exercise the mounted sky
canvas, selected picker/sheet labels, desktop menu choice and preservation of
saved `default` selections and legacy `starfield=0` opt-outs.

Fresh checks: 86 suites and **1,483 tests** pass, including the required desktop
coverage gate. Lint, type checking and production build pass. Existing test
runner SQLite/listener warnings and Vite chunk-size/config warnings remain in
the unfiltered logs; no lint warnings or build errors remain.

Real local browser startup mounted a nonzero 2540 × 1294 Starfield canvas.
Selecting Basic and reloading preserved the choice with no starfield canvas.
The menu showed Basic, Starfield, Aurora and Blueprint. This used a fresh local
origin and no owner documents or notes.

Independent read-only review identified a removed platform import still needed
by the real canvas path; lint also caught it. The import was restored before
the final passing checks. Review found no remaining material issue, and stale
comments were corrected. Native tests below remain separate evidence.

The previous local Dev **1.0.2 (231)** remains retained evidence; it does not
contain this follow-up.

## Local Dev 1.0.2 (232)

Both refreshed Dev apps were built, signed with the existing development key
and profile, checked against actual packaged source/web bytes,
installed and launched. iPhone Z's installed metadata confirms 1.0.2 (232).
The Mac app is `<user-applications>/SpecDown Store Dev.app`.
Its updated welcome screen visibly shows Theme: Starfield, and its picker
lists Basic, Starfield, Aurora and Blueprint.

Evidence is retained locally under
`ios/DerivedData/wave-102-local-dev-232/`, including `BUILD-RECORD.json`, source
and web manifests, unfiltered build logs, strict-signature/profile/certificate
checks, 110 bundled-web-file checks on each app, 19 Mac desktop-source checks,
installed phone metadata and launch results. Build metadata overrides are local;
tracked Store configuration remains unchanged. Build 232 is not a reservation
of an Apple upload number.

Mac Dev 231 was quit normally with the bundled showcase open, preserved under
the new evidence directory's `previous-mac-dev-231/`, and verified against its
prior Info.plist/ASAR hashes. The older 230 copy and all 231 signed artifacts
remain retained. Production/direct app metadata and the clean canonical source
at `9d27fc1` remain unchanged. No app-data reset or note inspection was used.

Owner physical feature acceptance, a fresh-install iOS theme visual check,
physical iPad acceptance and provider-specific testing remain separate. No
Beta delivery, merge, Apple account change, upload or public deployment occurred.

## Copy

The [draft descriptions](submission-copy-1.0.2-draft/README.md) add presentation
mode as an existing feature, plus Starfield and Basic theme wording. Both are
below 4,000 characters. No App Store Connect edit or submission is performed.
