# Project: Sharing kit

A product-presentation effort so SpecDown can be shared as a **viewer**, not a
file-picker. The live GitHub Pages URL is still the app — the empty state on
the **web** surface is now a showcase; desktop and iOS keep the compact
drop-zone.

## Timeline

| Date       | Doc                                                                                  | Summary                                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-20 | [spec-web-showcase](2026-08-20-spec-web-showcase.md)                                 | Web-only empty-state homepage: hero, live Mermaid, pillars, desktop download, diagram showcase sample; Open Graph unfurl |
| 2026-08-20 | [spec-feature-copy](2026-08-20-spec-feature-copy.md)                                 | LinkedIn-ready positioning, hero feature set, full feature grid, lines to avoid                                          |
| 2026-08-20 | [spec-article-outlines](2026-08-20-spec-article-outlines.md)                         | Flagship LinkedIn article arc, how-I-built-it follow-ups, shorter posts                                                  |
| 2026-08-20 | [spec-sharing-playbook](2026-08-20-spec-sharing-playbook.md)                         | Demo, channels, comment strategy, what not to oversell                                                                   |
| 2026-08-20 | [tasks-session-01-sharing-kit](2026-08-20-tasks-session-01-sharing-kit.md)           | Implement showcase + copy kit + OG card + tests                                                                          |
| 2026-08-22 | [tasks-session-02-starfield-toggle](2026-08-22-tasks-session-02-starfield-toggle.md) | Named Theme catalog (Default, Starfield) on every surface; scalable for future looks                                     |
| 2026-08-22 | [tasks-session-03-aurora-blueprint](2026-08-22-tasks-session-03-aurora-blueprint.md) | Two more empty-state Themes: Aurora (curtains) and Blueprint (spec grid)                                                 |
| 2026-08-23 | [HTML names and press](../project-html/2026-08-23-brainstorm-names-and-press.md)     | Naming council, taglines, press A / embargoed B. Keepers: Specular, Lantern; *Present the diagram…* / *Specs you can stand in front of.*; subtitles *Diagrams you can present* / *The spec reader*. |

## Current status

Shipped in this session: web showcase empty state, social unfurl tags, the
copy kit above, and a named **Theme** picker for the empty-state look (Starfield
on by default for the web homepage; Default on desktop/iOS until opted in).
Add a future look by appending to `visualThemeCatalog` plus a CSS block. The
web app is unchanged as a **viewer** — drop, browse, URL, GitHub repo, folder
(Chromium), and session restore still open documents the same way.

Names and press drafts for the HTML era live with that project:
[`../project-html/2026-08-23-brainstorm-names-and-press.md`](../project-html/2026-08-23-brainstorm-names-and-press.md).

## Naming conventions

Files follow `YYYY-MM-DD-<type>-<detail>.md` with types `brainstorm` / `spec` /
`tasks`. See [`../README.md`](../README.md).
