# Project: HTML Documents

A first-class **HTML document kind** for SpecDown — a _forked_ viewing
runtime next to markdown, not HTML forced through `marked`.

AI coding tools emit standalone `.html` as often as `.md` now: reports,
dashboards, slide decks, architecture explainers, prototypes. SpecDown
already wins at _reading_ markdown specs. This project makes the same
reader honest about the other artifact agents actually write.

**Architectural rule:** fork the document runtime at the render boundary.
Do not convert HTML to markdown. Do not inject untrusted HTML into the
app origin. Markdown stays the compiler pipeline; HTML is already compiled.

## Timeline

| Date       | Doc                                                                            | Summary                                                                                                                                                                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-23 | [brainstorm-html-documents](2026-08-23-brainstorm-html-documents.md)           | Three-lens plan (PM / UX / distinguished engineer): why now, what we refuse to become, the runtime fork, security model, feature set, phased roadmap                                                                                                                       |
| 2026-08-23 | [spec-html-v1](2026-08-23-spec-html-v1.md)                                     | Technical specification for the document-kind model, sandboxed iframe host, open-path gates, feature compatibility, and the Phase 0–1 implementation surface                                                                                                               |
| 2026-08-23 | [tasks-session-01-kind-and-open](2026-08-23-tasks-session-01-kind-and-open.md) | First HTML _runtime_ session: `kind`, open gates, sandboxed preview. **Base branch `html`, not `main`.** Implemented.                                                                                                                                                      |
| 2026-08-23 | [council-html-plan-review](2026-08-23-council-html-plan-review.md)             | Four-seat council. Fork holds; blob/srcdoc preview **rejected** (CSP inheritance). Host page + untrusted postMessage. Session 01 is a skeleton, not a launch.                                                                                                              |
| 2026-08-23 | [brainstorm-names-and-press](2026-08-23-brainstorm-names-and-press.md)         | Naming/tagline council: keep SpecDown; HTML-era lede; press A / embargoed B. **Names under research:** Specular, Lantern. **Lines to keep:** _Present the diagram…_ / _Specs you can stand in front of._ **Subtitles ok:** _Diagrams you can present_ / _The spec reader._ |
| 2026-08-25 | [spec-html-staging](2026-08-25-spec-html-staging.md)                           | Staging rail: `html` integration branch, compile-time flag, no merge to `main` until Session 02 go/no-go. Production merge = release.                                                                                                                                      |
| 2026-08-25 | [tasks-session-00-staging-rail](2026-08-25-tasks-session-00-staging-rail.md)   | **First code PR (into `main`):** flag default off, `*:html` scripts, CI artifact. No HTML gates.                                                                                                                                                                           |

## Current Status

**Session 01 sandboxed HTML preview is implemented on `html`.** Flag-off
builds still reject `.html`. Dogfood with `npm run dev:html` /
`preview:html` / `desktop:html`. Do not merge `html` → `main` until the
Session 02 go/no-go.

### How to dogfood

Production-shaped (what users get): `npm run dev` / `build` / `desktop`.
HTML-on staging: `npm run dev:html` / `preview:html` / `desktop:html`.
Do not publish a staging desktop build to the production Release or
`latest*.yml`. Do not put a staging app under `/specdown/html-staging/`
(PWA service worker scope).

The north-star one-liner this project is aiming at:

> SpecDown is the reader for AI-generated specs — markdown _and_ HTML —
> without becoming a browser and without weakening the markdown
> renderer's security posture.

## Naming Conventions

Files follow the repo-wide pattern `YYYY-MM-DD-<type>-<detail>.md` with
types `brainstorm`, `spec`, and `tasks` (see [docs/README.md](../README.md)).
Session 00 is the first code PR (into `main`). Session 02+ should add
`2026-XX-XX-tasks-session-0N-<slice>.md` (PRs into `html`) and
update the timeline above.
