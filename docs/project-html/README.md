# Project: HTML Documents

A first-class **HTML document kind** for SpecDown — a *forked* viewing
runtime next to markdown, not HTML forced through `marked`.

AI coding tools emit standalone `.html` as often as `.md` now: reports,
dashboards, slide decks, architecture explainers, prototypes. SpecDown
already wins at *reading* markdown specs. This project makes the same
reader honest about the other artifact agents actually write.

**Architectural rule:** fork the document runtime at the render boundary.
Do not convert HTML to markdown. Do not inject untrusted HTML into the
app origin. Markdown stays the compiler pipeline; HTML is already compiled.

## Timeline

| Date       | Doc                                                                                          | Summary                                                                                                                                                                 |
| ---------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-23 | [brainstorm-html-documents](2026-08-23-brainstorm-html-documents.md)                         | Three-lens plan (PM / UX / distinguished engineer): why now, what we refuse to become, the runtime fork, security model, feature set, phased roadmap                    |
| 2026-08-23 | [spec-html-v1](2026-08-23-spec-html-v1.md)                                                   | Technical specification for the document-kind model, sandboxed iframe host, open-path gates, feature compatibility, and the Phase 0–1 implementation surface            |
| 2026-08-23 | [tasks-session-01-kind-and-open](2026-08-23-tasks-session-01-kind-and-open.md)                | First implementation session: `kind` on tabs, accept `.html`/`.htm` at every open gate, sandboxed faithful preview, raw source, sample, tests                           |
| 2026-08-23 | [council-html-plan-review](2026-08-23-council-html-plan-review.md)                           | Adversarial council. Thesis holds; Session 01 amended (CSP, honest chrome, no launch), then platform gates (live-reload DI, print CSS, 8 MB at read, iOS UTI) |

## Current Status

**Planning complete and council-amended; implementation not started.**
The fork thesis survived review. Session 01 is ready only from the
**amended** spec + checklist — the first draft would have shipped a
blank iframe (parent CSP), a lying Print button, and markdown-only
folders. Start at
[tasks-session-01-kind-and-open](2026-08-23-tasks-session-01-kind-and-open.md)
after reading the [council](2026-08-23-council-html-plan-review.md).

The north-star one-liner this project is aiming at:

> SpecDown is the reader for AI-generated specs — markdown *and* HTML —
> without becoming a browser and without weakening the markdown
> renderer's security posture.

## Naming Conventions

Files follow the repo-wide pattern `YYYY-MM-DD-<type>-<detail>.md` with
types `brainstorm`, `spec`, and `tasks` (see [docs/README.md](../README.md)).
The next implementation session should add
`2026-XX-XX-tasks-session-02-<slice>.md` and update the timeline above.
