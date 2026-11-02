# Session 60: README accuracy and consistent copy proof

Date: 2026-11-01. Documentation-only work following the reviewed dependency merges.

## Request and scope

Chris requested an updated README and a simple HTML page containing the complete
proposed copy, with iOS and Mac side by side. The two listings should describe the
same product in the same voice, differing where platform behavior differs. The
HTML is a clean reading proof, without change notes, build-status panels or source
hashes. The proposal is available at [copy-proposal.html](copy-proposal.html).

The existing name, Markdown/Mermaid category and technical reading focus remain.
The opening now connects that reading experience to developers reviewing specs,
plans and READMEs saved from editors or AI tools. It makes no AI generation,
automatic integration, document editing or diagram-link publishing claim.
Retrieved copywriting guidance informs the wording; current source behavior
controls feature claims.

## README changes

- Lead with the saved-document reading use case and interactive diagrams.
- Keep useful setup, architecture, keyboard, download, release and library links.
- Remove the unsupported footnote example from the Markdown feature list.
- Scope notes and SVG/PNG export to web/desktop, and recents to the surfaces that
  expose them. Keep Raw/Preview and Split without claiming they are Mac-exclusive.
- Explain folder Open/Close on desktop and supported browsers. Closing retains
  document tabs; hiding the sidebar leaves the folder open. Native iOS has no
  folder browser.
- Describe public HTTPS document links and host/sign-in restrictions; qualify
  the web app's offline behavior by its saved resources.
- Distinguish the existing direct desktop download from the prepared Mac App
  Store edition. Avoid an unconditional promise about Gatekeeper dialogs.
- Make SpecDown Dev explicit in local Xcode steps, distinguish Beta and production
  identities, and preserve existing generated-project signing settings.
- Retain the newly merged Node.js 22.22+ requirement and document the desktop
  synthetic-file watcher validation command.

## Copy proposal boundaries

Shared audience, opening paragraphs, section headings and common features use
consistent wording in both listings. iOS-specific file access, sidebar and icon
features stay with iOS; folder browsing stays with Mac. Split view is shared by
both listings, matching the native iOS action-sheet wiring. The common copy does
not describe these platform differences as separate products.

The HTML proposal does not replace the selected release-copy JSON, screenshots,
artwork, website/support/privacy source or App Store Connect fields. Proposed
support/privacy wording must distinguish document processing, local app storage,
content-host requests and automatic update checks. No Store availability,
submission, signed-build acceptance or policy adoption is established by a copy
proof. Internal App Review instructions need not appear in customer-facing copy.

## Source and release checkpoint

The work starts at main `85f374be178f0895719ddc64802eeed7146c81ca`, after
[Chokidar #317](https://github.com/cbremer/specdown/pull/317),
[Marked #319](https://github.com/cbremer/specdown/pull/319) and
[tooling/Electron #358](https://github.com/cbremer/specdown/pull/358) merged.
Their validation is recorded in Sessions 57–59. The merged tree matches the
reviewed combined dependency tree.

Previously retained Store **1.0.1 (230)** artifacts remain bound to source
`28848a25b837c022918ccc1625b17af0fa9c80e1`; they do not silently acquire the newer
dependencies or this documentation. Historical signed **229** Owner TestFlight
artifacts remain historical. No build number, native setting, dependency,
application source, credential or artifact is changed in this session. New
release builds and their exact-build acceptance remain separate work.

## Verification boundary

README claims were checked against the current rendering configuration, native
iOS feature visibility, workspace lifecycle, service worker, channel schemes and
release workflows. Real Marked 18.1.2 parsing confirms that the removed footnote
example is rendered literally without a footnote extension. The documentation
index retains its existing row text/order with one additive contiguous session
row.

Browser verification passed with the two listings side by side at 967 pixels and
stacked at 390 pixels, with no horizontal overflow. All internal anchors resolve.
The HTML uses no JavaScript or external resources. Independent copy review passed
platform-claim and Store-field-limit checks. Final wording selection remains with
Chris; browser proof does not apply the proposal to any Store field or public
website page.

No native build, signing, account action, upload, App Review submission or public
Store release is part of this documentation change.
