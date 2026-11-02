# Session 49 — AI workflow reading companion copy

Chris clarified that SpecDown should be positioned as a helper for developers and people using artificial intelligence tools who create and read many documents. He wants a distinctive reading experience alongside editors and AI conversations, with modest enhancements to the existing iOS and Mac listing rather than a rebrand.

## Positioning and applied changes

**A focused reading companion for the documents people create during AI-assisted work.** The workflow is explicit: create and revise in an editor or AI assistant, then open the saved Markdown in SpecDown to read and review.

The current proof packet at `docs/project-appstore/release-proof-2026-11-01/copy/` now includes:

- Shared name remains **SpecDown**. Shared proposed subtitle is **Markdown for your AI workflow** (29 characters), restoring the October 20 proposal without restoring its obsolete technical claims.
- iOS promotional text: “Read and review the documents behind your AI work. Explore Markdown specs, plans and Mermaid diagrams in a focused view on iPhone and iPad.” (139 characters.)
- Mac promotional text: “A focused reading view beside your AI tools. Review Markdown specs, plans and Mermaid diagrams, with source and preview side by side on Mac.” (140 characters.)
- Description openings explicitly name developers and anyone creating documents with AI tools. Every existing platform feature section and the privacy/offline wording is byte-for-byte preserved after the opening.
- Keywords retain Mermaid discovery after it moves out of the subtitle; iOS uses 95 ASCII bytes and Mac uses 96. Names of other products are not inserted as keywords. AI is already in the subtitle; no two-letter AI keyword is added.
- Only the first screenshot caption per device set gains workflow context. Actual image bytes, capture conditions and all other captions remain unchanged.
- iOS release notes and both reviewer-note files are unchanged. The first sentence of the prepared Mac What's New is aligned with the positioning; the initial Mac portal did not expose that field.

The specific reading benefits remain grounded in current features: formatted tables and highlighted code, Contents and Find, fullscreen diagrams with zoom/pan, and Mac source/preview split view. Public copy does not claim that Cursor, VS Code or Claude lack Markdown rendering, and it does not imply a plugin, direct integration, AI generation, rewriting or editing inside SpecDown. The user’s comparison informs the dedicated-reader positioning rather than a competitor feature claim.

## Metadata and preservation

Apple's [product page guidance](https://developer.apple.com/app-store/product-page/) and [platform version reference](https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information) were checked for subtitle/promo/keyword limits and accurate keyword use. Existing categories (Developer Tools / Productivity), URLs, copyright, name, privacy answers, price, reviewer contacts and artwork remain unchanged.

The October 20 copy review already proposed the selected subtitle and AI reading-companion direction. Its old JSON was not restored: it contains superseded plain-HTTP review notes and an automatic-refresh marketing claim awaiting exact signed MAS acceptance. The current HTTPS and native-feature boundaries remain intact.

All prior proof fields, readable proof, reviewer notes, gallery HTML and status metadata were copied and hashed before editing under `ios/DerivedData/release-copy-ai-positioning-20261101/baseline/`. The before/after field map is `field-changes.json` in that evidence directory. No application source, generated Xcode project, builds, signing, keys, installed apps, artwork or screenshot pixels changed.

## Validation and portal status

The local copy validator passed field limits, ASCII/unique keywords, exact readable-proof values, reviewer-note equality, platform exclusions and caption budgets. The local gallery reads the revised JSON and now clearly says changed fields await portal synchronization. Earlier saved-copy hashes and readback evidence are retained as historical values, not relabeled as proof of this revision.

**These revisions are local drafts for owner proof.** The Mac unlock question from the preceding task is still pending, so no additional Apple session access, authentication, portal field mutation, App Review or public release was attempted. The revised subtitle must be applied in the appropriate draft App Information scope alongside each changed platform field, then read back exactly. The separate signing/TestFlight and GitHub publication questions remain pending and were not treated as answered by this copy direction.

The updated readable copy is [the current proof](release-proof-2026-11-01/copy/proof.md). Its latest field hashes and independent editorial review are retained in the local evidence directory. Source remains `b9e54727f3e18d02a874c5de768f6e0e47def493`, 1.0.1 (229).
