# Session 65: Copy proof feedback

Date: 2026-11-01. Documentation-only continuation of Sessions 60–63.

## Request and scope

Chris supplied comments on the local [copy proposal](copy-proposal.html). This
session implements those comments in the proposal for another proofing pass.
The canonical app source and selected release-copy JSON remain unchanged.
The HTML stays a clean proposal, without editorial change notes.

Work begins at reviewed source `9d27fc1a6961e29c86def43cee17c6fbb7d66db1` in a
separate in-repository worktree. The previous clean proof branch remains intact.
Session 64's release-artifact handoff is separate and is not replaced by this
copy revision.

## Copy decisions

- Give support the same developer and AI-workflow reading-companion context as
  the website, without claiming built-in AI generation or tool integrations.
- Describe OneDrive and Dropbox as providers available through Files when
  installed and enabled, alongside iCloud Drive. Do not imply that SpecDown
  independently signs in to those services.
- Add web-app installation and Add to Home Screen wording for supported
  browsers. Explain that offline use depends on saved app resources; online
  documents and remote images still require a connection.
- Lead the Mac listing with desktop Live reload and explain saved-file changes
  from an editor or AI agent. Also carry that benefit into website/support,
  search/social preview and proposed reviewer/TestFlight text. Keep it scoped
  to open local files with Live reload enabled; iOS has no file watcher claim.
- Chris subsequently asked to remove icon differences from marketing copy and
  use the same artwork across platforms. Remove icon feature bullets/sections
  from the customer-facing listings, website and support proposal. Keep the
  existing icon acceptance checks in reviewer/TestFlight instructions without
  giving them marketing prominence. Record implementation parity separately
  below; this wording change does not alter artwork or current platform behavior.
- Replace the rejected-document release note with plain language: “If a file
  can’t be opened, the document you’re reading stays open.” Remove the Link
  removal and Light/icon-sizing bullets from customer-facing What’s New.
  Reviewer/test instructions retain the checks for those implemented changes.
- Preserve the requested AI, SI, workflows and Markdown search meaning using
  `ai workflows`, `si workflows` and `markdown` in both proposed keyword fields.
  The iOS value is 98 ASCII bytes and the Mac value is 93. They remain proposals,
  not saved Apple fields.
- Update the build-230 proof status to reflect the completed Owner-only iOS and
  Mac TestFlight delivery recorded in Session 64. Device testing and final
  submission selection remain pending.

## Approved value-proposition refinement

After the annotation edits, Chris requested another evaluation using Grok Bot's
copywriting skill and approved its small opening refinement. The shared listing descriptions,
iOS promotional text and website opening now lead with the specs, plans and
diagrams an AI workflow produces, followed by the focused reading and
interactive-diagram benefit. The Mac description's first paragraph also
describes keeping the document beside an editor or agent and following saved
changes with Live reload on. Its existing desktop-focused promotional text
stays unchanged.

This is a focused wording change within the same proposal. Other feature copy,
keyword values, artwork, selected Apple metadata and build 230 stay unchanged.
The refined opening passed a fresh rendered-browser check with side-by-side
listings and no horizontal overflow. The full 1,371-test suite, lint and
typecheck were rerun and passed before updating the existing draft PR.

## Approved blend with the live iOS listing

November 2, 2026 continuation; the session filename is retained for continuity.

Chris supplied a screenshot of the existing iOS Store description and approved
incorporating the copywriting review's recommendations. The shared description
now combines the approved AI-workflow opening with a clean reading view,
formatted tables, highlighted code and interactive Mermaid diagrams right in
the document. Mac retains its saved-file Live reload sentence immediately after
that shared opening and keeps the existing 165-character promotional text.

The proposal preserves the live listing's useful phrases “Made for reading
technical docs,” “specs, design docs, READMEs and notes,” and “Clean typography
for long documents.” Separate reading, diagram and file-opening sections make
the details easier to scan. All earlier feature bullets are retained; the
website and support opening receive matching concrete language.

The iOS promotional text uses a shorter concrete blend at 158 characters.
Unsupported universal or speed promises are not restored: no “any Markdown
file,” “any app's share sheet” or “instantly.” Diagrams are interactive, while
file Live reload remains desktop-only. Precise file-provider, offline and
privacy qualifications remain intact, and icon marketing stays removed.
This is another wording refinement to the same draft PR; no selected Apple
metadata, public page or build changes with it.

The November 2 blend passed fresh full tests (1,371 in 78 suites), lint,
typecheck, HTML formatting and diff checks. Rendered-browser proof at the
1280 × 720 default viewport confirmed the exact shared opening, immediate Mac
Live sentence, grouped reading/file-opening copy and aligned website/support
wording, with no icon marketing or horizontal overflow. Screenshots were
inspected inline only.

## Platform icon parity backlog

Chris requests the same icon artwork choices across platforms. A separate future
implementation should bring the approved Light artwork to desktop alongside the
existing variants and assess consistent choices for the web app and installed
web app where browser/OS support permits. Preserve each platform’s actual
mechanism: native iOS alternate app icons, desktop runtime Dock/window icons,
and web manifest/browser installation behavior. Do not promise a desktop Finder
icon change or arbitrary dynamic installed-web-app icons without proving support.

This is backlog work, not part of build 230 or this copy revision. Keep current
artwork masters and approved exports intact. Require source review, platform
validation and an explicitly selected future build before promotion. The existing Launch Weekend tracker records this scope as **WK-37**.

## Feature and keyword boundaries

Source checks used `desktop/app-icons.js`, the Appearance menu and watch paths
in `desktop/main.js`, `markdown-viewer/src/platform/desktop.js`,
`markdown-viewer/src/features/pwa.js`, the web manifest and service worker.
Desktop Live uses an authorized local file path, not an AI service connection.
The service worker saves the shell and allowed same-origin assets, not remote
user documents. These checks establish appropriate copy scope; they do not
replace native or TestFlight acceptance.

Apple's [platform version reference](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/)
currently specifies keywords longer than two characters and a 100-byte total.
The phrases `ai workflows` and `si workflows` retain the requested meaning while
meeting that length guidance. No portal validation or search-index behavior is
claimed, and this draft is not already accepted metadata.

## Validation

Full 1,371 tests in 78 suites, lint and typecheck passed. The HTML passes
formatting and diff checks, has no scripts, and all local section anchors
resolve. Both subtitle values remain 25 characters. After the approved opening
refinements, promotional text is 158 characters for iOS and 165 for Mac;
descriptions and What's New remain within
the documented field limits. Only the build-230 status changes in the metadata
section; all other dated metadata/status fields, screenshot captions, privacy
and in-app wording remain unchanged.

Independent feature review confirmed the provider, Live reload, desktop icon
mechanics and PWA claims against source. The later owner direction removes icon
marketing from the proof and scopes parity as backlog work. An unauthenticated public request to the existing
GitHub Issues destination returned HTTP 200 and visible issue links. Browsing
works signed out; creating an issue requires GitHub sign-in. Independent review
cleared all 13 browser-comment dispositions, including the later icon direction.

Rendered-browser proof passed for the exact final HTML: desktop listings remain
side by side, and the website/support sections show the revised Live reload,
provider and PWA wording. Customer-facing sections contain no icon feature copy.
At a 390-pixel viewport, document scroll width is 390 pixels and prose width is
350 pixels with a 17-pixel font; there is no horizontal overflow. Screenshots
were inspected inline during that proof; no saved screenshot artifact is claimed. No new native build, signing, upload, App Review submission,
selected-copy change, public website edit or deployment is part of this session.
Mac availability wording retains Session 62's public-launch gate.
