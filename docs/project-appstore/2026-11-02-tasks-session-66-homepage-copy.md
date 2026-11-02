# Session 66: approved browser homepage copy

Date: November 2, 2026. Base: `9d27fc1a6961e29c86def43cee17c6fbb7d66db1`.
Branch: `codex/homepage-copy-20261102`. Scope: website wording, without a redesign
or changes to the frozen Store build 230.

## Approved copy and availability

The browser homepage now leads with “Read the specs, plans and diagrams your AI
workflow produces.” It explains the concrete reading benefit: formatted tables,
highlighted code, interactive Mermaid diagrams and clean typography for technical
specs, design docs, READMEs and notes. The existing cards describe diagram
exploration and public HTTPS/file/folder opening. The platform section explains
desktop Live reload and its Live/Paused control, conditional access to Files
providers on iPhone/iPad, and supported-browser installation with honest offline
limits. The README lead follows the same approved wording.

The source is the approved website proposal at
`e8dd3cb95a41c19ad10c14e6f1efba3287866625`,
`docs/project-appstore/copy-proposal.html`. Its future Mac launch wording is
intentionally held back: the public homepage says the Mac App Store edition is
coming and is in TestFlight, not publicly available. The existing direct desktop
and iPhone/iPad App Store destinations are preserved. Windows and Linux retain
the less-tested qualification already recorded in the README.

Production iOS and Mac 1.0.1 (230) builds are processed and available in Owner
TestFlight. Chris clarified that the earlier physical checks used build 228;
physical acceptance of 230 remains pending. This supersedes the initial report
that 230 had passed. No native acceptance test occurred in this homepage task,
and TestFlight availability does not establish public Mac Store availability.

## Browser and native boundary

Visible changes are confined to the existing hidden-by-default landing sections,
which `setupWebLanding()` reveals only in a browser. Native drop-card markup,
Browse/sample labels, shared document title, app heading and all event handlers
are unchanged. CSS, renderer modules, native code, dependencies, versions,
signing settings and artwork are unchanged. The built HTML still contains the
hidden copy when bundled natively; no new native marketing view is enabled.

The description, Open Graph description and Twitter description use the same
approved wording. Open Graph and Twitter titles match the approved search/social
title. Canonical URL, CSP, social-image URLs and existing robots behavior are
preserved. The shared HTML title remains unchanged to preserve native window
semantics.

## Verification and deployment

The existing full CI/coverage suite passed: **1,371 tests in 78 suites**. Lint,
typecheck and the production web build passed. Existing landing tests cover
browser visibility, native gating, sample opening and click-to-browse behavior.
A separate static comparison confirms that only the four allowed landing-copy
regions and five metadata fields changed in the HTML: the native drop card and
every button, input, link, script and stylesheet reference are unchanged. The
landing sections remain hidden by default in source and built HTML. No tests
were added solely to match static wording.

Independent source review passed with no requested changes. Parent browser proof
of the exact production HTML passed at 1280 × 720 and 390 × 844: the approved hero
is readable in the existing design, and both viewports have no horizontal
overflow. The desktop lower section also passed visual review: the feature
cards, Live reload explanation, direct download, testing qualification and
Mac Store “coming” message are clear. iOS and PWA text is present in the rendered
page. The existing Vite chunk-size/config-loader advisories do not prevent the
build or local preview.

The actual Pages workflow builds `markdown-viewer/dist/` and deploys only on
`main`. A draft PR runs validation, including unsigned iOS simulator CI because
the shared HTML changed; it does not deploy the homepage or modify the existing
signed apps. This task does not merge, dispatch deployment, upload, sign or
submit anything. Evidence is retained under canonical
`ios/DerivedData/homepage-copy-20261102/`.
