# Spec: Article outlines (how and why)

**Date:** 2026-08-20

Write _one_ LinkedIn flagship, then recycle into shorter posts. Fill the origin
story with what actually happened — these outlines do not invent one.

---

## Flagship (the LinkedIn article)

**Working title:** “I got tired of presenting architecture as a screenshot, so
I built a markdown viewer”

**Length:** 800–1,200 words. One screenshot or a 20–40s GIF. End with the hero
feature set.

**Arc**

1. **Problem.** Mermaid in GitHub, VS Code, and Confluence is a static image.
   You cannot present it. You screenshot it, crop it, and apologize.
2. **Decision.** Build a _viewer_, not another editor. No vault, no account,
   no plugin ecosystem. The job is read / present / annotate.
3. **Demo.** Link [the web app](https://cbremer.github.io/specdown). One GIF:
   drop `diagram-showcase.md` → Present → pan one diagram → export PNG.
4. **Three product bets.** Diagrams first. One web app with thin native shells.
   No account.
5. **Soft CTA.** Try it in the browser, star the repo, grab the DMG.

---

## Follow-ups (how I built it)

1. **One codebase, three surfaces** — Vite app in `markdown-viewer/`; Electron
   and WKWebView are shells behind `window.specdown`.
2. **Why `window.print()` is a trap** — viewport-fixed flex layout clips;
   printable document + visible-window iframe vs offscreen PDF.
3. **Electron 32 deleted `File.path`** — live reload/drag-drop broke;
   `webUtils.getPathForFile` in preload.
4. **Don’t ship a 2 MB diagram library on every page** — lazy Mermaid, 28
   language highlight.js, ~261 kB shell.
5. **Rendering untrusted markdown** — DOMPurify, CSP, `htmlLabels: false`,
   comments as `#comment`.
6. **Building a native-feeling web app** — command palette, toasts instead of
   `alert()`, iPhone action sheet vs desktop toolbar.
7. **Release engineering as product** — merge → version bump → DMG + Pages;
   notarization and the “feed 404 while GitHub release exists” window.
8. **Viewer vs Obsidian/Typora** — different job: read/present vs write/vault.

---

## Shorter LinkedIn posts (not articles)

- Before/after: static GitHub Mermaid vs SpecDown presentation mode.
- “Cmd+K in a markdown viewer” screenshot.
- “Paste a GitHub repo URL, pick the README.”
- Honest alpha: shipping often, iOS not on the Store yet.
- “I dogfood architecture reviews in SpecDown.”
