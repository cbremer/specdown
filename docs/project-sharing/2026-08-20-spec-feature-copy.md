# Spec: LinkedIn-ready feature copy

**Date:** 2026-08-20
**Audience:** engineers, architects, PMs, and reviewers who _read and present_
specs — not people looking for another editor.

Use this as carousel slides, a LinkedIn post body, or the “what it does”
section of the flagship article. Benefits first; internals stay in the
how-I-built-it outlines.

---

## Positioning

**One-liner:** SpecDown is a markdown _viewer_ where Mermaid diagrams are
first-class — zoom, pan, present, and export — so architecture docs stop being
tiny static images.

**Also interesting (not swapping the one-liner):** *Present the diagram, not a
screenshot* is already the landing title — keep it. *Specs you can stand in
front of* is a format-agnostic second breath (Present as a room). Wordmark
subtitles that are ok: *SpecDown — Diagrams you can present* and
*SpecDown — The spec reader*. HTML-era lede, when the wedge ships: *The reader
for specs — markdown, diagrams, and the HTML your agent just wrote.* Full kit:
[names and press](../project-html/2026-08-23-brainstorm-names-and-press.md).

**Contrast:** Typora and Obsidian edit. GitHub preview is static. SpecDown is
the reading and presenting layer.

**CTA:** [Try it in the browser](https://cbremer.github.io/specdown) (no
account). Desktop builds are on GitHub Releases (macOS signed & notarized,
Windows, Linux).

---

## Hero set (5 slides / 5 bullets)

1. **Present the diagram, not a screenshot.** Fullscreen pan/zoom, minimap, and
   a presentation mode that steps through every Mermaid in the doc (`←` / `→`).
2. **Open anything.** Drop a file, open a folder, paste a raw URL, or paste a
   GitHub repo and pick the markdown.
3. **Built for reading.** TOC, find, split view, annotations, print/PDF — no
   vault, no account, no editor chrome.
4. **Same app everywhere.** Browser (installable PWA, works offline), desktop
   (macOS signed & notarized, Windows, Linux).
5. **Free and open.** MIT. Try it or grab a desktop build from Releases.

---

## Feature grid (site + a “full list” comment)

- **Diagrams:** wheel-zoom, drag-pan, fullscreen, minimap, SVG/PNG export,
  shareable `?diagram=` links, light/dark re-theme, print diagrams in light for
  paper.
- **Markdown:** GitHub Flavored Markdown, syntax highlighting + copy, authored
  HTML comments as styled blocks, raw/preview, split view.
- **Getting docs in:** drag/drop, browse, URL, GitHub repo browser, recents,
  tabs (up to 10), workspace/folder mode with relative `.md` links, desktop live
  reload.
- **Reviewing:** sticky-note annotations with durable anchors; export/import
  JSON.
- **Power user:** command palette (`Cmd/Ctrl+K`), shortcut sheet (`?`), session
  restore (web), custom CSS (desktop), file-info panel.

---

## Lines to avoid

- Don’t call it an editor.
- Don’t imply App Store / TestFlight. iOS is build-from-source today.
- Don’t claim footnotes as a special engine feature.
- Don’t lead with “alpha / v0.0.x” — put maturity in a footnote (“actively
  shipped, still labeled alpha”).
- Don’t invent user counts. Stars and Releases are the only public metrics.
