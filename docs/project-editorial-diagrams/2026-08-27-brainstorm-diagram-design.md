# Brainstorm — Pervading [diagram-design](https://github.com/cathrynlavery/diagram-design) through SpecDown

**Date:** 2026-08-27
**Type:** brainstorm (pre-code)
**Trigger:** How might SpecDown absorb something like Cathryn Lavery's
diagram-design skill — 39 editorial diagram types, self-contained HTML + SVG,
explicitly "no Mermaid slop"?
**Baseline:** SpecDown `main` at v0.0.185. diagram-design ~v2.5.10 (39 types,
semantic patterns, optional motion, draw.io / Mermaid *redraw*).

---

## 1. What the two products actually are

They look like competitors. They aren't.

| | **diagram-design** | **SpecDown** |
|---|---|---|
| Job | An **agent skill** that *authors* a diagram | A **viewer** that *presents* a document |
| Input | A prompt, a `.drawio`, or a Mermaid block | A `.md` / `.markdown` file (drop, URL, workspace, GitHub) |
| Output | One self-contained `.html` (inline SVG; optional `.svg` / `.png` export) | Interactive reading surface: TOC, find, annotations, print, presentation |
| Diagram model | Finished drawing. Layout, type ramp, and brand tokens are authored into the SVG. | Live render. A fenced ` ```mermaid ` block is compiled at view time by the Mermaid engine. |
| Design stance | One accent, 4px grid, hairlines, no shadows, density 4/10. Brand from your site. | Mermaid's default / dark themes, system UI fonts, expand-to-explore chrome. |
| Runtime | None required. Open the HTML in a browser. Motion is optional and pinned. | Vite bundle + DOMPurify + lazy Mermaid + Panzoom. CSP forbids arbitrary scripts. |

diagram-design's "no Mermaid slop" line is about **generation quality** — generic
rounded boxes, automatic layout, pastel fills — not about SpecDown's viewer
chrome. SpecDown already decided (2026-07-22, inline-static UX) that diagrams
should read as **document content**, with pan/zoom/export living in fullscreen.
That is the reading posture editorial diagrams want.

The complementary sentence:

> **diagram-design draws. SpecDown presents.**

Pervading one through the other means making SpecDown a first-class surface for
the files the skill already emits — not cloning the skill, and not replacing
Mermaid for the documents that still want a live source.

---

## 2. Why this is tempting (and where the temptation goes wrong)

**Tempting because:**

- SpecDown's identity is "diagrams as first-class." The skill produces diagrams
  that look like they belong in a magazine. Putting those through SpecDown's
  expand / present / print / workspace path is an obvious product move.
- The skill can already **redraw** Mermaid. A folder of SpecDown docs could
  grow a sibling set of editorial HTML without throwing the source away.
- Workspace mode already wants to be "open this spec folder." Today it only
  lists `.md` / `.markdown`. The skill's natural habitat is a folder of
  `architecture.html` next to `README.md`.
- Presentation mode walks `.diagram-wrapper svg`. If editorial SVGs enter that
  wrapper, Present just works.

**Wrong if we:**

- **Become a generator.** Shipping 39 type grammars, a style guide, onboarding,
  and Python extractors inside SpecDown duplicates a 27k-star skill we don't
  own and can't keep current.
- **Replace Mermaid.** Live-source diagrams (edit the fence, refresh, see the
  graph) are still the right tool for many specs. Editorial HTML is a
  *deliverable*, not a language.
- **InnerHTML the whole HTML file.** That's an XSS hole. The skill's motion
  variant also carries a JS controller SpecDown's CSP will (and should) block.
- **Retheme them like Mermaid.** Print currently re-renders from
  `data-mermaid-source` into the light theme. Editorial diagrams carry their
  own `paper` / `ink` / `accent` tokens. Recoloring them is vandalism.

---

## 3. Options

### A. Viewer for the skill's HTML (recommended first cut)

Open a diagram-design `.html` the way we open a `.md`: drop / browse / workspace
/ URL. **Extract the primary inline SVG**, sanitize it, wrap it in
`createDiagramContainer`. The document chrome (filename, expand, fullscreen,
presentation, SVG/PNG export) applies. The HTML around the SVG (eyebrow, title,
optional editorial cards) can become a thin caption, or be dropped in v1.

Detection, not a new format: look for a root `<svg role="img">` (the skill's
a11y contract). Unknown HTML is rejected with a toast — we are not a general
HTML viewer.

### B. Markdown includes (the "pervade the spec" path)

A `.md` stays the document. Editorial diagrams appear *inside* it:

1. **Relative HTML include** — `![Architecture](./architecture.html)` or a
   dedicated fence, resolved like workspace `.md` links, SVG extracted and
   inlined. This is how a spec folder actually works.
2. **Fenced SVG / raw `<svg>`** — already close to what marked + DOMPurify
   would pass if we opted in; no new authoring tool required, but nobody
   hand-writes these SVGs.
3. **Fenced `diagram-html`** — paste the whole HTML blob into markdown.
   Ugly, huge diffs, still needs the same extractor.

(1) is the one that matches how the skill is used. (2)/(3) are escape hatches.

### C. Aesthetic pervade only — restyle Mermaid

Point SpecDown's Mermaid config at hairlines, one accent, denser type. Cheap,
stays in-language, and **does not fix layout slop**. Mermaid still auto-places
nodes. This can be a later theme experiment; it is not an integration with
diagram-design.

### D. In-app redraw (reject)

Call the skill, or vendor `mermaid_extract.py` + type templates, to turn a
Mermaid fence into editorial HTML at view time. SpecDown would need an LLM, a
Python runtime, or a frozen snapshot of 39 grammars. Out of scope. Redraw
belongs in the agent that already has the skill installed.

### E. Partnership / positioning only (not a SpecDown code change)

Tell that ecosystem "open the HTML in SpecDown for present / pan / print."
Useful after A exists. Empty as a first move.

---

## 4. Hard constraints (from SpecDown's actual code)

These are the gotchas that decide the shape of A, not polish items.

**File-type gates are everywhere.** `.html` is explicitly *not* valid today:

- `markdown-viewer/src/features/file-loading.js` — `VALID_EXTENSIONS = ['.md', '.markdown']`
- `desktop/main.js` — same list; `isValidMarkdownFile` rejects `.html` (tested)
- Workspace scan (`scanWorkspace` / web directory walk) only collects markdown
- PWA `file_handlers` declare `.md` / `.markdown` only
- GitHub repo browser searches markdown

A first cut that "just" opens HTML has to touch every one of those, plus iOS
document types if we want Open-in-SpecDown later. Prefer a **narrow allow**:
diagram-shaped HTML, not `index.html` from a random site.

**Sanitize, don't execute.** Render path is `marked.parse` →
`DOMPurify.sanitize(..., { ADD_TAGS: ['#comment'] })`. Diagram SVGs get a
second pass with `foreignObject`. CSP:

```
script-src 'self' 'unsafe-eval' file: specdown:
font-src 'self' data: file: specdown:
```

Consequences:

- Inline motion controllers will not run. v1 is the **static first frame** (the
  skill's own default). Do not add `unsafe-inline` scripts or `srcdoc` iframes
  to "support animation."
- Google Fonts (Geist, Instrument Serif) will not load. The templates already
  fall back to `system-ui` / `serif` / `ui-monospace`. Accept the fallback in
  v1 rather than punching `fonts.googleapis.com` into CSP and the PWA cache.
- Extract **the SVG node only**. Never assign the full HTML document to
  `innerHTML`. Strip `<script>`, event handlers, `foreignObject` from
  untrusted HTML unless we prove the skill needs it (its examples use SVG
  text, not HTML labels).

**Do not retheme.** `rerenderPrintDiagramsLight` only touches
`svg[data-mermaid-source]`. Editorial SVGs must **not** get that attribute.
Theme toggle must not re-run Mermaid against them. Sit them on their own
`paper` token (almost always light) even when SpecDown is in dark mode — a
paper-colored inset, like a figure on a dark page. Recoloring brand tokens to
follow `--bg` is how you get "Mermaid slop" with extra steps.

**Presentation, print, export already almost work** once the SVG is in
`.diagram-wrapper`:

- Presentation walks those SVGs
- Export serializes the SVG / rasterizes it
- Print clones the DOM and only re-renders mermaid-sourced diagrams

The remaining print work is CSS: don't clip a wide editorial `viewBox` the way
a live `window.print()` would (existing `buildPrintableDocument` rule), and
don't force a dark-on-dark figure.

**iPhone:** any new "Open HTML" / "Include diagram" control that lands in the
desktop toolbar also needs the iOS action sheet. iPad keeps the toolbar.

**Eval harness:** new module-private names must not collide under
`tests/helpers/loadApp.js`. Don't call a helper `openTab`.

---

## 5. Recommended direction

**SpecDown stays a viewer. Mermaid stays. Editorial HTML becomes a second
diagram *source*, not a second engine.**

Ship in this order, each a single PR:

### Slice 1 — Open one diagram HTML

Drop / browse a skill-generated `.html`. Extract SVG → `createDiagramContainer`.
Caption from `<h1>` / `aria-labelledby` if present. Reject HTML that isn't
diagram-shaped. No workspace, no markdown includes, no fonts CSP change, no
motion.

Success looks like: open
[`example-architecture`](https://github.com/cathrynlavery/diagram-design/blob/main/skills/diagram-design/assets/)
(any light variant), expand, present (one slide), export SVG/PNG, print.

### Slice 2 — Workspace + file associations

Workspace scan includes diagram HTML next to markdown. Relative links from a
`.md` to a `.html` open the diagram as its own tab (same containment rules as
today's `.md` links). Desktop/PWA handlers gain `.html` **only if** we keep the
diagram-shaped reject — otherwise SpecDown becomes an accidental HTML opener.

### Slice 3 — Inline include in markdown

A relative image / explicit include of `./foo.html` extracts the SVG into the
rendered document so a spec can keep narrative and editorial figures together.
This is the actual "pervade" step. It depends on the extractor from slice 1
being a pure function.

### Explicitly later / never

| Idea | Verdict |
|---|---|
| Restyle Mermaid to hairlines + one accent | Optional theme experiment; not this project |
| Run motion JS | Never in-process; static frame only |
| Vendor the 39 type references / Python extractors | Never |
| "Redraw this Mermaid in SpecDown" button | Never — that's the agent + skill |
| General HTML / URL-as-page viewer | Never |
| Dark-mode recolor of editorial tokens | Never |

---

## 6. Product framing (if we ship it)

Don't market "SpecDown now does editorial diagrams" as if we generate them.
The honest line:

> Write diagrams with your agent. Read them in SpecDown — next to the spec,
> with present / pan / print.

Mermaid remains the live-source path. Editorial HTML is the publish-quality
path. A workspace can hold both.

---

## 7. Open questions for a spec (not blockers for slice 1)

1. **Full-editorial variants** wrap the SVG in cards + hero copy. v1 can drop
   the chrome and keep the SVG; a later slice could render the caption row.
2. **Multi-SVG HTML** (gallery `index.html`) — reject, or present as a deck?
   Reject in slice 1.
3. **Onboarded brand fonts** that aren't Google Fonts (self-hosted `@font-face`
   in the HTML) — still blocked by CSP. Fallback is correct until we have a
   reason to allow listed font origins.
4. **Should `.svg` files open too?** The skill's export command emits them.
   Smaller surface than HTML; could be slice 1b.
5. **GitHub repo browser** — search currently markdown-only. Include `*.html`
   in a spec folder? Easy to flood with app HTML. Probably opt-in / name
   heuristic (`example-*.html`, files that contain `role="img"` after fetch).

---

## 8. Decision

Proceed with **A → slice 1** when we next want this: SpecDown as a sanitized
SVG viewer for diagram-design HTML, using the existing diagram chrome, with
Mermaid untouched.

Do not start on C, D, or motion. Do not widen file-type gates until the
extractor can say "this is a diagram" with a test.
