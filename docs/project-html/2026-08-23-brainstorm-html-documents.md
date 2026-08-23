# Brainstorm — HTML Documents as a First-Class SpecDown Kind

**Date:** 2026-08-23
**Type:** brainstorm (product + UX + engineering plan)
**Scope:** All surfaces — web (GitHub Pages / PWA), desktop (Electron),
iOS/iPadOS (WKWebView shell)
**Decision already taken:** **fork the document runtime.** Do not convert
HTML to markdown. Do not feed HTML through `marked` + `#markdown-content`.

This is a three-lens plan for making SpecDown honest about the files AI
systems actually emit in 2026. It is written to the same standard as the
modernization evaluation
([`docs/project-modernization/2026-06-13-brainstorm-modernization-evaluation.md`](../project-modernization/2026-06-13-brainstorm-modernization-evaluation.md)):
product first, then interaction design, then the engineering that makes
the product safe to ship.

---

## 0. The decision in one page

### What changed in the world

SpecDown's original job is still true: *the reader for specs with serious
diagrams.* What changed is the **artifact**. Agentic coding tools
(Cursor, Claude Code, ChatGPT, Gemini, Copilot) still write long
markdown — and they *also* write complete HTML files, constantly:

| Artifact | Why agents emit HTML instead of markdown |
|---|---|
| Status reports / weekly reviews | Need a designed page, not a GitHub README |
| Architecture explainers | Custom layout, tabs, callouts, in-page nav |
| Dashboards / evals / scorecards | Charts, filters, client-side JS |
| Slide decks | Full-viewport slides; markdown slides are a downgrade |
| Interactive prototypes | Buttons, state, local demo data |
| "Open this in a browser" handoffs | The agent already compiled the doc |

Opening those in Chrome works, and is a bad reading workflow: no live
reload while the agent iterates, no workspace of mixed `.md` + `.html`,
no SpecDown print/PDF path, no tabs/recents/session, and `file://`
sibling assets are a mess. Opening them in SpecDown *today* is
impossible — every gate hard-rejects anything that is not
`.md`/`.markdown`.

### Two rejected designs

**Convert (HTML → markdown via Turndown, then render).** This is the
trap. It throws away the one thing the file was chosen for: the
author's layout, CSS, and interaction. The result looks like a
half-parsed email. Users will correctly call it broken. Agents will
keep emitting HTML. We would be fighting the format.

**Absorb (set `innerHTML` on `#markdown-content`).** This is the
security trap. SpecDown's renderer security is *clean* because every
dynamic HTML path goes through DOMPurify and the app origin never
executes document scripts. Dumping an agent's HTML into the app origin
is an XSS primitive with a file picker as the delivery mechanism. The
v2 audit called renderer security "clean — no injection sink found."
That finding is not optional.

### The fork

```
                    open()
                      │
                      ▼
              detectKind(name)
                 │         │
        markdown │         │ html
                 ▼         ▼
         renderMarkdown   renderHtmlDocument
         (compiler)       (already compiled)
                 │         │
                 ▼         ▼
         #markdown-content  sandboxed <iframe>
         marked → purify    opaque origin + host bridge
         mermaid / TOC /    faithful preview
         annotate / present
                 │         │
                 └────┬────┘
                      ▼
              shared chrome
         tabs · recents · workspace
         live reload · print · palette
         file info · theme chrome
```

Markdown stays the **compiler pipeline** (parse → sanitize → enhance).
HTML is a **document kind** with its own render host. Shared chrome
(tabs, recents, workspace, live reload, print, command palette) is
kind-agnostic. Features that assume a SpecDown-owned DOM (annotations,
presentation, comment-reveal) are **capability-gated** per kind, not
half-wired.

That is the whole project. Everything below is how to do it without
becoming a browser, without diluting markdown, and without giving up
the security posture the modernization wave earned.

---

## 1. Product snapshot (what exists today)

SpecDown is a markdown *viewer* — deliberately not an editor — whose
differentiator is interactive Mermaid: per-diagram pan/zoom, fullscreen
with minimap, presentation mode, SVG/PNG export. One shared
`markdown-viewer/` runs on web, desktop, and iOS.

Every ingress is markdown-only:

| Gate | Where | What it accepts |
|---|---|---|
| Browse / `<input accept>` | `index.html` | `.md,.markdown` |
| Drag-and-drop | `features/file-loading.js` | `VALID_EXTENSIONS` |
| Desktop `Open…` / Finder / `open-file` | `desktop/main.js` | same list |
| Desktop workspace scan | `desktop/main.js` `scanWorkspace` | same list |
| Web workspace scan | `features/workspace.js` | `.md`/`.markdown` links |
| URL fetch | `handleUrl` + `normalizeMarkdownUrl` | any URL, then treated as markdown |
| GitHub repo browser | `features/repo-browser.js` | GitHub search for `.md` |
| PWA "Open with" | `manifest.webmanifest` `file_handlers` | `text/markdown` |
| iOS document types | `ios/project.yml` | `net.daringfireball.markdown`, `public.plain-text` |
| iOS picker UTTypes | `WebBridge.swift` | plainText / sourceCode / json / xml — **not** `public.html` |
| Bundled samples / landing | `landing.js`, iOS sidebar | `.md` only |
| Tab / render | `state.Tab.rawMarkdown` → `renderMarkdown` | always `marked.parse` |

There is no `kind` on a tab. The render function's name is the product
assumption: everything is markdown.

That assumption is now the adoption blocker for the fastest-growing
document source we have — agents.

---

## 2. Product management evaluation

### 2.1 Positioning — expand the job, keep the soul

The honest one-liner today:

> The reader for specs with serious diagrams.

The honest one-liner after this project:

> The reader for AI-generated specs — markdown and HTML — with serious
> diagrams.

We are **not** becoming:

- A browser (address bar, history, multiple origins, extensions)
- An HTML editor or "live server" (Vite/BrowserSync already exist)
- A generic "open any file" kitchen sink (PDF, DOCX, PPTX stay out)
- A markdown converter that "fixes" HTML

We **are** becoming the place you drop whatever the agent just wrote,
and *read* it — with SpecDown's existing reading workflow around it.

That is a tighter product move than it looks. The competition for
markdown-with-Mermaid is still weak (GitHub static diagrams, VS Code
preview, Obsidian-as-editor). The competition for "open this HTML the
agent made" is **Chrome**, which is free, ubiquitous, and terrible at
the *iteration* loop (agent writes file → you reload → you lost your
scroll, your folder, your other tabs, your print settings).

**The wedge is live-reload + workspace + print, not "we render HTML."**
Anyone can iframe a file. SpecDown's unique offer is: the HTML sits in
the same reading surface as the markdown spec it came from, reloads
when the agent saves, prints as a document, and does not execute in
the app origin.

### 2.2 Jobs to be done (ranked)

1. **Agent iteration.** I asked the agent for a report / deck /
   dashboard. It wrote `out/report.html`. I want to see it, say
   "change the chart," and watch it update. (Desktop live reload is
   the killer feature. Web folder + reload-from-disk is the fallback.)
2. **Mixed spec repositories.** A `docs/` folder has `architecture.md`
   *and* `review.html` *and* `slides.html`. I want one workspace, one
   sidebar, relative links that work in both directions.
3. **Faithful reading.** I want the page the agent designed, not a
   SpecDown-styled approximation. Typography, color, layout, and
   in-page JS (tabs, charts) are the document.
4. **Share / archive.** Print or PDF the HTML the same way I print a
   markdown spec — full document, not the visible viewport (the
   hard-won print path must survive).
5. **Review.** Find in document, TOC if the HTML has headings, file
   info, annotations later. Not in v1 if they fight the sandbox.

### 2.3 What we will not ship (the product "no")

Saying no is the whole product. HTML support is how products accidentally
become browsers.

| Temptation | Why we refuse |
|---|---|
| Navigate the iframe to arbitrary http(s) pages | That's a browser. External links leave SpecDown (desktop already has `openExternal`). |
| `allow-same-origin` + `allow-scripts` on `srcdoc` | XSS in the app origin. Absolute veto. |
| Restyle the document with SpecDown tokens | Destroys the artifact. Theme chrome stays *around* the document. |
| Convert HTML → markdown as a default path | See rejected designs. A later "Copy as markdown" is a command, not a viewer. |
| PDF / DOCX / images-as-documents | Different runtimes, different security, different jobs. One new kind per project. |
| Edit the HTML | Viewer, not editor. Raw view is read-only source, same as markdown. |
| Auto-run a local HTTP server | Fixes sibling assets at the cost of ports, firewalls, and "is this a dev tool?" Identity clash. A contained custom protocol on desktop is enough. |
| Execute document scripts in the parent | Never. The host bridge is *our* script, injected, talking via `postMessage`. |

### 2.4 Adoption story (who cares, in order)

1. **The person already using SpecDown desktop for agent-written
   markdown.** They already have live reload. The next file the agent
   writes is `.html`. This is a one-release unlock, not a new audience.
2. **The person who currently `open report.html` in Chrome, then
   alt-tabs back to the agent.** We steal that loop.
3. **Teams reviewing a folder of generated artifacts** (eval HTML +
   design-doc markdown). Workspace mode becomes the review surface.
4. **Web / PWA users** dropping a single file. Weaker (no live reload,
   no sibling assets unless they Open Folder) but it still beats
   "rejected: please select a valid Markdown file."

iOS is last for *distribution* reasons (still no TestFlight), but the
shared renderer must work there from Session 01 or we grow a
platform-skew the iPhone action-sheet lesson already taught us.

### 2.5 Success looks like

- A user can drop `report.html` on any surface and see the page the
  agent designed, inside SpecDown chrome, without a toast that says
  "please select a valid Markdown file."
- The same user can keep a markdown spec and an HTML report open in
  two tabs and not wonder why one of them "looks like GitHub."
- An untrusted HTML file cannot read SpecDown state, cannot hit
  `window.specdown`, cannot run in the app origin. A security review
  of the HTML path should be able to say the same sentence the v2
  audit said about markdown: no injection sink.
- Desktop live reload updates the HTML preview the way it updates
  markdown. This is the demo.
- We have not added a second empty-state product. The landing still
  says SpecDown. The drop card just accepts more files.

### 2.6 Pricing the identity risk

SpecDown's name and README still say *markdown viewer*. That is fine
for a long time. We do **not** rename the app. We do **not** lead the
showcase with "now opens HTML!" like a file-manager changelog.

We change the *job* in the lede ("AI-generated specs") and keep
Mermaid as the differentiator. HTML is how we stay the reader for
those specs as the artifact mix shifts. If, two releases later, HTML
opens outnumber markdown opens, *then* we talk about naming. Not now.

---

## 3. UX design evaluation

### 3.1 The feeling we want

Opening markdown in SpecDown feels like: *the document is the product;
the chrome is a slim reader.* Opening HTML must feel like: *the
document is still the product — and this one brought its own
typesetting.*

The failure modes are both obvious:

- **Over-chrome.** We wrap a designed page in SpecDown's prose column,
  max-width, and tokens. It looks imprisoned. Users will open it in
  Chrome instead.
- **Under-chrome.** We go fullscreen-iframe and lose tabs, filename,
  Live chip, print, find. Then we are Chrome with extra steps.

The design answer is a **document stage**: the iframe is a first-class
surface that owns the content pane (`#markdown-content` becomes a
kind-aware stage, or we add `#document-stage` and keep the markdown
root inside it). SpecDown chrome stays *outside* the stage. The
document's CSS never leaks out; SpecDown's CSS never leaks in
(iframe boundary).

### 3.2 Empty state and first-run

Today the web landing is a showcase: "Drop Markdown File Here," Try
diagram showcase, pillars about diagrams. Desktop/iOS keep the compact
drop-zone.

Copy change, not a redesign:

- Drop card: **"Drop a Markdown or HTML file"**
- Browse accept list includes `.html,.htm`
- Helper line: "HTML opens as the page it is — not converted to
  markdown."
- One bundled sample: `samples/html-showcase.html` — a *designed*
  one-pager (not an unstyled kitchen sink) that shows why the fork
  exists: custom layout, a small chart or tabs, a heading TOC can
  see. The existing Mermaid markdown sample stays the hero; the HTML
  sample is a second button, not a replacement.

Do **not** add a third pillar or a second hero. Coherence debt is how
the v2 audit said the last feature wave felt. HTML is an accepted
*input*, not a new product on the landing.

### 3.3 Kind-aware chrome (the toolbar problem)

The desktop toolbar is already at its limit (Contents / Split /
Annotate / Present / Search / ⋮). HTML must not add a button. It must
*subtract* ones that lie.

| Control | Markdown | HTML v1 | HTML later |
|---|---|---|---|
| Filename + Live chip | yes | yes | |
| File info | yes | yes | |
| Raw / Preview | yes | yes (source / page) | |
| Split | yes | yes (source \| page) | |
| Find | yes | yes (via host bridge) | |
| Contents (TOC) | yes | yes if headings exist | |
| Print / PDF | yes | yes (bridge `print`) | |
| Present | if Mermaid | hidden unless we detect presentable diagrams | Phase 3 enhance |
| Annotate / Notes | yes | hidden | Phase 4, host-bridge anchors |
| Comments (authored `<!-- -->`) | yes | hidden | probably never — HTML comments are source, not a reading feature |
| Workspace Files | if folder open | same | mixed kinds |
| Command palette | all commands | commands that apply; others filtered or disabled with reason | |

iPhone: every new *reachable* action must be added to the iOS action
sheet. For v1 that means Open already works (picker types), Print
already exists, Raw/Find/Contents need sheet entries **if** they are
not already there for markdown. Do not add an "HTML options" row.

Tab chrome: a quiet kind mark, not a badge farm. The tab title is the
filename. A `title` tooltip can say `HTML document`. An optional 12px
`HTML`/`MD` text in the tab is acceptable if it stays visually quieter
than the close button. No file-type icons in two colors — that is a
finder, not a reader.

### 3.4 Theme: the document wins

SpecDown light/dark/auto applies to **chrome**. It does not recolor
the HTML document.

AI HTML almost always ships its own palette. Forcing
`prefers-color-scheme` or injecting SpecDown tokens will fight the
author and create the "imprisoned page" failure.

Optional, later, not v1: a host-bridge message
`{ type: 'specdown-theme', theme: 'dark' }` for documents that
*opt in* (e.g. they already listen to `prefers-color-scheme`). Never
rewrite their CSS.

The empty iframe letterbox (if the document is narrower than the
stage) uses the chrome background, not a second white page.

### 3.5 Trust and the sandbox banner

Users will not understand "opaque origin." They will understand:

> This page runs in a sandbox. It cannot touch SpecDown or your other
> documents.

Show that **once per session** the first time an HTML tab opens, as a
toast (not a modal, not a permanent bar that steals 40px from the
document). A ⋮ menu item "About HTML sandbox…" can repeat it.

If we later add Safe (no-script) vs Faithful (scripts on), that is a
per-tab toggle in the ⋮ menu + palette, default **Faithful**. Safe is
the "I don't know who made this file" escape hatch. Do not put it on
the toolbar.

### 3.6 Error and empty-document states

| Situation | UX |
|---|---|
| `.html` with empty body | Stage shows a quiet empty state: "This HTML file has no content." Raw still works. |
| File too large (cap) | Toast, refuse to open. Same energy as the 10-tab limit. |
| Parse failure (not UTF-8, binary named `.html`) | Toast: "Couldn't read this as text." |
| Document throws in the iframe | Host bridge reports `{ type: 'specdown-error' }`; toast once; Raw still works. Do not white-screen the chrome. |
| Sibling asset 404 (`./chart.js`) | The page looks broken *inside* the iframe, like a browser. v1 toast only if we *know* there is no base (lone dropped file referencing relative URLs). Phase 2 protocol fixes the desktop case. |
| User drops `index.html` + folder | v1: the file opens, assets miss. Desktop tip in the toast: "Open the folder to load images and scripts next to this file." Phase 2 makes Open Folder the real fix. |

### 3.7 Find, TOC, and print — designed for a wall

The iframe is a security wall. The parent cannot read
`contentDocument`. So Find/TOC/Print cannot be "query the rendered
DOM" the way markdown does.

UX implication: we must not ship a Find that only searches the source
and highlights nothing in the page — that feels like a bug. v1 Find
goes through the **host bridge** (our injected script highlights in
the iframe and reports match counts). TOC is built from a
`DOMParser` parse of the source *and* confirmed/refreshed by a
`headings` message from the host after the page's own JS has run
(so JS-injected headings appear). Print is a bridge command, not
`window.print()` on the SpecDown window (the print-clips-to-viewport
bug must not return).

If a slice cannot do Find-in-page honestly, **hide Find** for HTML
rather than ship a lying control. Same rule as Present.

### 3.8 Motion, a11y, focus

- The iframe is a single tab stop. Do not leave the user trapped
  inside the document with no way back — the host cannot fix the
  document's own focus traps, but SpecDown chrome (palette, `?`,
  Find, Esc) must keep working. Esc closes SpecDown overlays first;
  a second Esc is *not* "exit the HTML" (there is nowhere to exit to).
- `prefers-reduced-motion` applies to chrome transitions only.
- Stage iframe needs `title` = filename (accessible name).
- Kind changes must be announced: when a tab switch goes markdown →
  HTML, an `aria-live` polite update ("HTML document") is enough.
- Contrast of chrome stays our problem; contrast inside the document
  is the author's.

### 3.9 Per-surface notes

- **Web.** Drop / browse / URL / Open Folder (Chromium). Lone File
  drop has no directory, so relative assets break — the toast in
  §3.6 is the honesty. PWA file handlers should advertise HTML so
  "Open with SpecDown" works for both kinds.
- **Desktop.** This is the home surface for the job. Finder
  "Open with," dock drop, live reload, workspace scan, File menu
  filters, and (Phase 2) a contained asset protocol. Dialog title
  becomes "Open File" with a Markdown + HTML + All filter list.
- **iOS.** Picker must include `public.html` or users with Files
  full of agent HTML will not see them. iPhone sheet must expose
  Raw / Find / Contents if those are in v1. Do not wait for
  TestFlight to wire the shared renderer — the last project taught
  us "works in the bundle" ≠ "reachable on iPhone."

---

## 4. Engineering evaluation (distinguished-engineer lens)

### 4.1 Why a fork is cheaper than it looks — and more expensive than a flag

Cheaper: the open path is already a funnel (`handleFile` /
`openFileByPath` / `handleUrl` / workspace / iOS `loadFileContent`).
Kind detection is an extension check plus an optional sniff. Tabs
already carry `rawMarkdown`, `viewMode`, `filePath`, `sourceMeta`.
Live reload already re-reads and re-renders. Print already refuses
to print the live viewport.

More expensive: **every feature that walks `#markdown-content` is a
markdown assumption.** A grep today hits render, TOC, search, split,
annotations, comments, diagrams, presentation, print clone,
workspace link clicks, code-copy, creator-detect. A boolean
`isHtml` sprinkled through those modules is how we get a third
"notes" button. The fork has to be a **capability table** + a
single `renderDocument(tab)` entry, not 20 `if (html)` branches.

### 4.2 Security model (non-negotiable)

This is the load-bearing section. If we get it wrong, HTML support
is a vulnerability we shipped on purpose.

**Invariant 1.** Document scripts never run in the SpecDown origin.
Not on web, not in Electron, not in WKWebView.

**Invariant 2.** The preview frame is isolated:

```
sandbox="allow-scripts allow-forms"
```

No `allow-same-origin`. No `allow-top-navigation`. No
`allow-popups` in v1 (external links are rewritten to
`target="_blank" rel="noopener"` and intercepted by the host
bridge → parent → existing desktop `openExternal` / web
`window.open` policy).

**Invariant 3.** We never combine `srcdoc` (or a blob URL that
inherits the app origin) with `allow-same-origin` +
`allow-scripts`. That combination is XSS. The v1 host uses a
**blob: URL** created from a rewritten document, or a **custom
protocol** on desktop (`specdown-doc://`), both of which are
non-app origins. `srcdoc` is allowed only if the iframe stays
*without* `allow-same-origin` (opaque). Prefer blob/protocol so
relative URL resolution has a fighting chance in Phase 2.

**Invariant 4.** The parent talks to the frame only via
`postMessage` with a strict origin check and a typed message
enum (`specdown-ready`, `specdown-headings`, `specdown-find-result`,
`specdown-print-done`, `specdown-open-external`, `specdown-error`).
Unknown messages are dropped. The frame cannot call
`window.specdown` because it cannot see it.

**Invariant 5.** DOMPurify remains the markdown path. It is **not**
the HTML faithful path (it would strip the document). It *is* the
HTML **Safe mode** path (Phase 2) and a defense for any HTML we
*do* inject into the parent (we should inject none).

**Invariant 6.** CSP: the app's meta CSP stays as it is (scripts
`'self' 'unsafe-eval'` for Mermaid; `object-src 'none'`;
`form-action 'none'`). The iframe document gets its **own** CSP
meta we inject:

```
default-src 'none';
script-src 'unsafe-inline' 'unsafe-eval' https: blob:;
style-src 'unsafe-inline' https:;
img-src data: blob: https: http:;
font-src data: https:;
connect-src https:;
object-src 'none';
base-uri 'self';
form-action 'none';
frame-ancestors 'self';
```

`'unsafe-inline'` / `'unsafe-eval'` inside the *frame* is
deliberate: that is how agent HTML is written. It is acceptable
only because of Invariant 1. `connect-src https:` lets charts
fetch; Phase 2 Safe mode sets `connect-src 'none'` and
`script-src` empty.

**Invariant 7.** Desktop path containment for any asset protocol
reuses the workspace rule: resolved paths must stay under the
document's directory (or the workspace root). No
`/etc/passwd`. The relative-link work already taught us this
(`requestOpenRelative` + root containment). Copy that, don't
re-invent it.

**Invariant 8.** Tests that claim to prove sanitizer / sandbox
behavior must exercise the **real** library and a real iframe
policy, not the passthrough DOMPurify mock. The comment-node bug
was the lesson; we will not relearn it with `allow-same-origin`.

### 4.3 Host rewrite (what we do to the file before it hits the frame)

We do not display the raw bytes. We parse with `DOMParser`
(`text/html`), then:

1. Ensure a `<html>`/`<head>`/`<body>` skeleton if the file is a
   fragment (`<div>…</div>` is common from agents).
2. Inject our CSP meta as the first head child.
3. Inject `<script src="…/html-host.js">` (bundled, hashed) as the
   last head child — **our** bridge, small, no deps.
4. Set `<base href="…">` when we have a resolvable base (URL open,
   desktop protocol, workspace). Omit for lone web File drops.
5. Rewrite `target="_top"` / `_parent` on links to `_blank`.
6. Optional: strip `<iframe>`, `<object>`, `<embed>`,
   `<meta http-equiv="refresh">` — nested browsing is how a
   document escapes a sandbox in spirit even when the origin is
   opaque. v1 strips nested frames. Revisit if a real corpus needs
   them.

The rewritten HTML is what the blob/protocol serves. The tab still
stores the **author's** raw source for Raw / Split / save-to-recents
hashing / creator-detect.

### 4.4 Module map (where the fork lives)

Keep the seam boring and local:

| Module | Role |
|---|---|
| `core/document-kind.js` **new** | `detectKind(filename)`, extension lists, capability table. Pure. Unique names (`htmlKind…`) for the eval harness. |
| `features/html-document.js` **new** | Rewrite, blob lifecycle (revoke on tab close / re-render), iframe mount, host-bridge listener, Find/TOC/Print messages. |
| `features/file-loading.js` | `VALID_EXTENSIONS` becomes the union; toast copy changes; URL filename fallback `untitled.html` when the path says so. |
| `core/state.js` | `Tab.kind: 'markdown' \| 'html'`. Keep `rawMarkdown` as the source string in v1 (least churn); rename to `rawSource` only if a session is *only* that rename. |
| `main.js` `renderMarkdown` | Becomes `renderDocument` that dispatches on `kind`. Markdown body stays here or moves to `features/markdown-document.js` if the file grows. |
| `features/tabs.js` | Persist `kind`; reset the stage; don't assume `#markdown-content` innerHTML for HTML tabs. |
| `features/workspace.js` + `desktop/main.js` `scanWorkspace` | Union of extensions; relative link regex includes `html?`. |
| `features/repo-browser.js` | Search `md OR html` or two queries. Don't silently hide HTML in a repo the user pasted. |
| `platform/ios-chrome.js` | Print payload for HTML uses the bridge snapshot or rewritten printable, never the live app layout. |
| `desktop/main.js` | Filters, `isValidOpenableFile`, Finder associations, Phase 2 protocol. |
| `ios/project.yml` + `WebBridge.swift` | `public.html`, picker UTTypes. |
| `public/manifest.webmanifest` | `file_handlers` accept `text/html`. |
| `index.html` | `accept=".md,.markdown,.html,.htm"`; stage markup. |

Do not put HTML policy in `desktop/preload.js` beyond exposing a
future `resolveDocumentAsset` if Phase 2 needs it. The
`window.specdown` bridge stays the only shell coupling.

### 4.5 Feature capability table (engineering view)

```
kind          md   html
tabs          ●    ●
recents       ●    ●
session       ●    ●
live reload   ●    ●
file info     ●    ●
raw / split   ●    ●
print / pdf   ●    ●  (bridge, not app window)
toc           ●    ●  (parser + host refresh)
find          ●    ●  (host highlight) or hidden
workspace     ●    ●  (Phase 1 scan; Phase 2 assets)
relative link ●    ●  (Phase 1 .html in regex)
mermaid       ●    ○  (Phase 3 enhance)
present       ●    ○
annotate      ●    ○  (Phase 4)
comments UI   ●    ○
code-copy     ●    ○  (document owns its <pre>)
custom CSS    ●    ○  (would restyle the artifact)
creator-detect●    ●  (same signatures + generator meta)
```

A feature that is ○ is **not called** for that kind. No empty
panels, no "0 diagrams" Present button.

### 4.6 Surface-specific engineering

**Desktop.** `VALID_EXTENSIONS` and `isValidMarkdownFile` should
become `isOpenableDocument` used by open, drop, session restore,
recents, and workspace. Keep a `isMarkdownDocument` helper for
anything that still *is* markdown-specific (there should be
almost nothing in main.js). Phase 2: `protocol.registerFileProtocol`
or `protocol.handle('specdown-doc')` rooted at the file's
directory; the iframe `src` is `specdown-doc://doc/<id>/` +
relative asset paths. Containment tests go next to the existing
workspace-root tests.

**Web.** Blob URL + optional `<base>` for URL-opened files
(relative assets resolve against the remote URL — CORS still
applies; broken assets fail like a browser). Workspace Open Folder
can, in Phase 2, satisfy relative assets via blob URLs per file
handle. v1 does not need that to be useful.

**iOS.** `loadFileContent(content, filename)` already exists.
Kind comes from `filename`. WKWebView hosting an iframe with a
blob URL works. Security-scoped reads for `public.html` need the
document type registered or Files "Open in SpecDown" won't offer
us. Print stays on `buildPrintableDocument` / the existing
`printDocument` bridge — for HTML, pass a printable snapshot from
the host (`document.documentElement.outerHTML` after load) so
charts exist, then run that through the same print window, not
the live shell.

### 4.7 Test strategy (written to the harness, not around it)

The eval harness (`tests/helpers/loadApp.js`) inlines the module
graph and evals at global scope. **Name every new top-level
binding uniquely** (`htmlDetectKind`, `htmlMountFrame`, …). Do not
export `render` or `openTab`.

What to test in Session 01 (Jest/jsdom):

- `detectKind` for `.md`, `.markdown`, `.html`, `.htm`, case, and
  unknown → reject.
- `handleFile` accepts HTML and creates a tab with `kind: 'html'`
  and does **not** call `marked.parse`.
- `handleFile` still rejects `.txt`, `.pdf`, `.exe`.
- Rewrite injects CSP + host script; does not execute in jsdom
  parent.
- Capability table hides Present/Annotate for HTML.
- Desktop `isOpenableDocument` unit tests (existing
  `desktop-main.test.js` pattern).

What Jest **cannot** honestly prove: Chromium sandbox flags,
`postMessage` isolation, Electron protocol containment, WKWebView
iframe behavior. Those get a short **manual smoke checklist** in
the session tasks (web preview, desktop if a display exists,
iOS simulator when an Apple runner is available). Do not invent
a Playwright suite in Session 01.

What we will not trust: a green suite that never created an
`<iframe sandbox>`. At least one test must assert the iframe
attribute string.

### 4.8 Performance and limits

- **Size cap:** 8 MB UTF-8. Agent HTML is usually tens to hundreds
  of KB. Multi-megabyte inlined-base64 pages exist; they can wait
  behind an explicit raise.
- **Blob revoke** on tab close and before re-render (live reload)
  or we leak.
- **One iframe per HTML tab**, created on activate, destroyed or
  frozen on background. Do not keep 10 live chart pages ticking.
  v1 can keep src and hide; if memory shows up, tear down and
  restore scroll via the host.
- Mermaid stays lazy and **off** the HTML path in v1.

### 4.9 Gotchas we already paid for (do not repurchase)

From `CLAUDE.md` and the retrospective, applied to this project:

- **Print in the visible window.** HTML print goes through the
  existing printable-document path or `iframe` + host
  `window.print()` *inside* a frame that is allowed to print. Do
  not `webContents.print()` on a hidden BrowserWindow. Do not
  `window.print()` the SpecDown shell.
- **iPhone action sheet.** New reading actions must be wired
  there.
- **Passthrough mocks.** Sandbox tests need the real attribute
  and, for purify-on-Safe-mode, the real DOMPurify.
- **`window.prompt`/`alert`.** Any "this HTML looks dangerous,
  continue?" UI is an in-app modal.
- **Electron `File.path`.** Drops still go through
  `getPathForFile` / `openDroppedPath`. HTML does not get a
  second drop path.
- **One logical change per PR.** Session 01 is "kind + open +
  sandboxed preview." Session 02 is workspace/assets or Find/TOC
  honesty. Do not land the protocol and the landing rewrite and
  annotations in one PR.

---

## 5. Feature set (the catalog, with phase tags)

### P0 — Must be true before we claim "we support HTML"

- Open `.html` / `.htm` from browse, drop, desktop dialog, desktop
  OS-open, iOS picker, URL (extension or `Content-Type: text/html`),
  PWA file handler.
- Tab `kind: 'html'`.
- Faithful sandboxed preview (scripts in the frame, not the app).
- Raw source view + split.
- Rejected-file toast updated.
- App origin cannot be reached from document JS (invariants).

### P1 — Reader, not just a frame

- TOC from headings (parser + host refresh).
- Find in page via host bridge (or hidden).
- Print / PDF via host snapshot + existing printable path.
- File info, recents, session restore, live reload.
- Kind-aware toolbar / palette / iOS sheet.
- Landing copy + `html-showcase.html` sample.
- Creator-detect on HTML (`<meta name="generator">` + existing
  signatures in source).

### P2 — Mixed workspace (the real product)

- Workspace scan includes HTML.
- Relative links `.md` ↔ `.html` ↔ `#anchors`.
- Desktop `specdown-doc://` (or equivalent) for sibling assets,
  contained.
- Web folder: resolve relative assets through file handles.
- Lone-file toast pointing at Open Folder.
- GitHub repo browser includes HTML.
- Safe / Faithful per-tab mode.

### P3 — SpecDown-enhance (opt-in, not default)

- Detect `<pre class="mermaid">` / `div.mermaid` in the HTML;
  offer "Render diagrams with SpecDown" which uses our Mermaid
  + pan/zoom + Present. Default remains faithful (their CDN
  script, if any).
- Presentation mode over those enhanced diagrams only.

### P4 — Review workflows

- Annotations via host-bridge anchoring (fingerprint of block
  text, same store schema v2). Hard; do not start from the
  parent DOM.
- Export/import already exists; keys must include kind + a
  stronger identity than filename (content hash) — that is an
  annotations project that HTML can ride.

### Explicitly later / never in this project

- Editing, preview-as-you-type, format-on-save.
- PDF/DOCX.
- Running the document's service worker.
- Full request interception / offline cache of document CDNs
  (privacy + disk).
- Multi-page sites (`about.html` navigating the iframe to
  `pricing.html` as a site). Relative *document* links open a
  **new tab** (or replace the current tab) via the parent, like
  workspace markdown links — they do not navigate the frame.
  That one sentence is how we stay a reader.

---

## 6. Phased roadmap

Sessions are implementation-sized, one PR each, rebase-and-merge.

### Session 01 — Kind + open + sandbox (this project's first code)

See
[`2026-08-23-tasks-session-01-kind-and-open.md`](2026-08-23-tasks-session-01-kind-and-open.md).
Ship the fork's skeleton: detect, accept, isolate, raw, tests,
sample. No workspace, no Find-in-page, no protocol.

**Demo:** drop `html-showcase.html`, see the designed page, toggle
Raw, switch to a markdown tab and back, confirm the document cannot
`alert` in the parent (manual).

### Session 02 — Reader chrome honesty

TOC + Find-via-bridge + Print/PDF snapshot + kind-aware toolbar /
palette / iOS sheet + file info + live reload verification +
creator-detect. Hide anything still dishonest.

### Session 03 — Mixed workspace + links

Scan union, sidebar icons or quiet kind mark, relative links both
ways, repo browser HTML, lone-file asset toast.

### Session 04 — Desktop asset protocol + web folder assets

The "Open Folder and the dashboard's `./chart.js` works" release.
Containment tests. This is the session that makes Faithful mode
real for multi-file agent output.

### Session 05 — Safe mode + trust UX

Per-tab Faithful/Safe, toast + ⋮ copy, Safe = no scripts +
DOMPurify (real library tests). Default stays Faithful.

### Session 06 — Enhance (only if Session 01–04 got used)

Mermaid-in-HTML detection + opt-in SpecDown render + Present.
Skip if we have no evidence anyone wants it.

### Sequencing rationale

Open+sandbox first because every later feature is unsafe or
lying without it. Reader chrome second because a frame without
Find/Print is Chrome. Workspace third because that is the job
in §2.2. Assets fourth because they are the hard desktop
problem and must not block the single-file 80% case. Safe mode
fifth because we need Faithful in the world before we know the
toggle's label. Enhance last — it is a differentiator, not the
reason to exist.

Do **not** start with Mermaid-in-HTML. That is comforting (it
looks like our existing product) and wrong (most agent HTML is
*not* a Mermaid document).

---

## 7. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| We ship XSS via `srcdoc` + same-origin | High if anyone "just wants TOC to be easy" | Invariants 2–3; code review checklist in the spec; a test that fails if `allow-same-origin` appears next to `allow-scripts` on the host iframe |
| We become a bad browser (navigation, CDNs, popups) | Medium (feature requests will ask) | Product "no" list; relative document links open tabs |
| Print regresses to viewport clip | Medium (new full-height ancestor) | Reuse `buildPrintableDocument`; add HTML to the print regression notes |
| Jest is green, production sandbox is not | High (harness + mocks) | Manual smoke; real-attribute test; no Safe-mode claims from passthrough purify |
| iPhone can't reach Raw/Find | High (historical) | Sheet wiring in Session 02, not "desktop works" |
| Sibling assets make v1 feel broken | Medium | Honest toast; Session 04 on the roadmap in the README so it is not forgotten |
| Identity dilution | Low if we keep the landing | Copy discipline in §3.2 |
| Eval-harness name collision | Medium | Unique prefixes (`html*`) from the first file |
| Agent HTML uses ES modules + import maps + shadow DOM | Medium | Faithful iframe handles most; we don't polyfill; Safe mode will look worse and that's OK |
| Nested iframe / open-redirect in document | Medium | Strip nested frames in rewrite; no `allow-top-navigation` |

---

## 8. Open questions (decide in Session 01 or 02, not in the abstract)

1. **Blob URL vs `srcdoc` vs desktop protocol for v1 preview?**
   Recommendation: **blob URL on all surfaces in Session 01**
   (simplest opaque origin). Desktop protocol is Session 04.
   Avoid `srcdoc` unless blob+base is insufficient for a URL-opened
   file (then `<base>` on the blob document is enough).
2. **Do we sniff `Content-Type` on URL open when the path has no
   extension?** Recommendation: yes, `text/html` → html, otherwise
   markdown (today's behavior). Don't sniff bytes for `<!DOCTYPE
   html>` on `.md` files — extension wins.
3. **`.htm`?** Yes. Cost is one string in a list. Agents and
   Windows tools still emit it.
4. **Default Faithful or Safe?** Faithful. Safe-as-default makes
   the feature look broken on the exact files we are targeting.
   Unknown-URL downloads could later default Safe; local files
   the user dropped are a different trust level.
5. **Is iOS in Session 01?** Shared renderer yes; `public.html`
   registration yes (it's a plist/picker change, not TestFlight).
   Device smoke is best-effort.

---

## 9. North-star (how we'll know the phase was the right one)

Six months after Session 01, the desktop app is where someone
leaves an agent-written `docs/` folder open all afternoon:
markdown architecture on the left, HTML review dashboard on the
right, Live chip blinking when the agent saves, Print producing
a real PDF of either kind. Nobody opened Chrome "just to see
the HTML." Nobody converted the HTML to markdown to "use
SpecDown." Nobody filed a security issue that starts with
`innerHTML = fileText`.

That is a better SpecDown. It is still a viewer. It is still
not a browser. It is finally caught up to what the agents write.
