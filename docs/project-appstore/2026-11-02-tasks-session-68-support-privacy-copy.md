# Session 68: approved public support and privacy copy

Date: November 2, 2026. Base: homepage commit
`04b3af4b3d4ff8ee34a99c39848eb8d2de314ca7` (Session 66).
Branch: `codex/support-privacy-copy-20261102`.
Status: source checks, independent review and browser proof passed; prepared
for a draft PR stacked on homepage PR #373. PR/CI pending. Not deployed.

## Copy and scope

The public `support.html` and `privacy.html` pages now use the approved sections
of `docs/project-appstore/copy-proposal.html` at
`e8dd3cb95a41c19ad10c14e6f1efba3287866625`. This is a separate logical change from
the homepage, retaining the existing page styles, heading/list layout, footer,
contact addresses and link destinations.

Support explains the reading benefit and the reviewed ways to open documents:
Files providers when installed/enabled, compatible app sharing, public HTTPS
links, bundled examples and folders in supported browsers/desktop. It includes
the approved desktop Live/Paused explanation, lack of iPhone/iPad file watching,
PWA installation and bounded offline availability. The FAQ covers the 8 MiB
document limit, additional rendering limits, HTTPS images and the existing iOS
relative-image restriction, hosts requiring sign-in, and Close Folder versus
hiding its sidebar. Email remains the first reporting route, with GitHub account
requirements stated separately.

Independent release-scope review found that the published direct desktop
`v0.0.229` does not yet include Close Folder. Both support mentions therefore
limit that action to the current web app and upcoming Mac App Store edition;
File → Close Folder is likewise scoped to that upcoming Store edition. Generic
Open Folder guidance remains available for desktop and supported browsers.

The proposal's future Mac launch sentence is withheld: the App Store link is
still labelled for iPhone/iPad, and the Mac App Store edition is coming/in
TestFlight, not publicly available. The direct Mac/Windows/Linux destination is
unchanged, with the existing less-tested Windows/Linux qualification. This does
not claim that production build 230 has passed physical acceptance; the owner
clarified that earlier checks used 228, and exact 230 acceptance is separate.

Privacy replaces overly broad collection/network statements with the approved
specific wording: documents render locally, local app/browser storage includes
web/desktop notes, providers or OS settings may sync files/backups, online
content requests go to their hosts, direct/web release checks contact GitHub,
and Store updates come through Apple. Voluntary support email and attachments
are disclosed. The page is labelled “Updated November 2, 2026”; this is the
prepared revision date, not a claim that the new page is already public.

## Boundaries and verification

Page descriptions are updated to match the content. Page titles, icons and
existing canonical/robots behavior are preserved. No scripts, forms, tracking,
new destinations or app features are added. Viewer HTML, JavaScript, CSS, native
source, dependencies, versions, Store metadata and the existing signed artifacts
are unchanged by this follow-up. Vite copies these public files into dist; the
pages are not injected into the native initial view.

The full coverage run passes all 1,371 tests across 78 suites with
`npm run test:ci -- --roots ./tests`. Lint, typecheck, the production build,
touched-page/document formatting and `git diff --check` pass. Vite reports only
its existing configuration-loader notice and large-chunk advisory.

The static boundary check proves both stylesheets, footers, page titles, all
link destinations/order and head content other than descriptions are unchanged.
The retained homepage bytes match the base. Across the complete 110-file build,
only `support.html` and `privacy.html` differ from the reviewed homepage build;
each built public page exactly matches its source. Independent review confirms
the approved wording and release qualifications, source boundaries and built
file comparison. No new unit tests are added solely to mirror static copy.

The parent reviewed the production preview in a real browser: support at
1280×720 retained its readable layout, including readback of the final corrected
Close Folder wording. Privacy at 390×844 was visually readable with
`scrollWidth === 390`; the support page also had no horizontal overflow at a
390-pixel viewport. The browser viewport was reset afterward. These checks are
public-page proof, not new native runtime or physical-device acceptance. The
loopback preview was stopped after review.

The Pages workflow deploys only from main. The draft PR validates this copy;
it does not deploy or alter the native apps. No merge, deployment, Apple action,
signing, upload or submission is performed here. Evidence is under canonical
`ios/DerivedData/support-privacy-copy-20261102/`.
