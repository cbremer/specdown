# Session 02: Require owner archives of code and credentials

**Date:** 2026-09-28. **Scope:** Update preparation documents and the existing Google Sheet. No credential generation, app/source changes, builds or Apple account actions.

- [x] Check whether the plan requires actual recoverable credential copies, rather than storage names or fingerprints alone.
- [x] Add owner archive requirements for source/code, release artifacts and generated reusable secrets; establish private storage before one-time credential generation/download.
- [x] Update AS-009, AS-011 and AS-045..047 actions/acceptance rules and P00/P01/P03/P07 prompts in the Markdown plan and live Sheet.
- [x] Verify matching MD/Sheet text, preserved execution status, dependency references and readable changed rows.

**Plan revision:** 1.1. [Canonical plan](2026-09-28-spec-appstore-release-plan.md). [Live tracker](https://docs.google.com/spreadsheets/d/1dGnVfCIzM4rgqb2_QsfNBh_yhvNYdjte0hs0ost1EKo/edit).

Actual private key files, generated passwords/tokens and reusable recovery codes must be retained in the owner private archive. The Sheet holds their locations and verification status. Final readiness requires verified recovery copies and source/artifact inventories; this session adds the requirement without creating those future archives.

**Verification:** Live readback matched all 22 edited cells, including revision 1.1 and AS-011's dependency on AS-009. Neighbor values/statuses were preserved; changed Markdown tasks/prompts match the Sheet values, and the 50-task dependency/cross-reference validation passes. Independent review confirmed archive coverage and the planning-only boundary. Authenticated Google browser rendering was unavailable, so the actual native Sheet export was imported and rendered using the spreadsheet skill's prescribed XLSX fallback; changed task and prompt text fits without clipping. Formatting and diff checks pass. No credentials, app builds, Apple records or execution archives were created.
