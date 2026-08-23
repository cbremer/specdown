# Council Review — HTML Documents Plan

**Date:** 2026-08-23
**Type:** council (adversarial review of a plan, before code)
**Subject:** [brainstorm](2026-08-23-brainstorm-html-documents.md) ·
[spec v1](2026-08-23-spec-html-v1.md) ·
[Session 01](2026-08-23-tasks-session-01-kind-and-open.md)
**Method:** four seats (security, product, UX, platform) challenged
the plan against *current* code, not against the plan's own claims.
This file is the chair's synthesis: what survived, what was wrong,
what Session 01 must change.

---

## Verdict

**The thesis is solid. The Session 01 contract was not.**

Ship the fork. Do not convert. Do not `innerHTML` the file into the
app origin. Faithful-as-default for local files. Capability table,
not `if (html)` soup. That stack survived every seat.

**Do not implement Session 01 as originally written.** As specified,
the first PR would:

1. **Fail to show the page** — the app CSP blocks `blob:` iframes.
2. **Lie about Print** — `#ios-print-button` and `performPrint()`
   still clone `#markdown-content` (empty for HTML) or fall through
   to `window.print()` on the shell (the viewport-clip bug).
3. **Lie about folders** — workspace scan stays markdown-only, so
   "we open HTML" is false the moment someone drops a `docs/` folder.
4. **Invite a Session 02 XSS** — printing a Faithful snapshot via
   `frameDoc.write()` in a same-origin iframe is the Absorb attack
   with a Print button on it.

Direction: **ship-with-fixes**. The amendments below are now in the
spec and Session 01 checklist. Implementation starts from those, not
from the first draft.

---

## Seats

| Seat | Charge | Verdict |
|---|---|---|
| **Security** | Attack the sandbox, CSP, print, host bridge | Fork is the right isolation. Three fatals if implemented as drafted. |
| **Product** | Is this the right phase? Will the "no" list hold? | Right phase *if* Session 01 stays tiny. v2 said "consolidate, don't add" — this is the one addition that is a job, not a feature. |
| **UX** | Lying controls, landing, chrome vs document | Coherent *after* hiding Print/Find/TOC/Comments/Annotate/Present on HTML until they are honest. Folder-drop is the first-run trap. |
| **Platform** | Missed gates, harness, Electron/iOS | `fileAssociations`, session restore, tab/iframe lifecycle, `handleUrl` Content-Type, and the eval harness were under-specified. |

---

## 1. Challenges that landed (adopted)

### F1 — Parent CSP will block the preview iframe

**Seat:** Security, verified in `markdown-viewer/index.html`.

The app CSP is:

```
default-src 'self' file: specdown:;
script-src 'self' 'unsafe-eval' file: specdown:;
…
```

There is **no** `frame-src` or `child-src`. CSP3 falls `frame-src`
back to `default-src`. `blob:` is not in `default-src`. Session 01's
`iframe.src = URL.createObjectURL(...)` is therefore **blocked in
production** on web, and likely on desktop (`file:`) and iOS
(`specdown:`) too.

The plan's Invariant 6 said "the app's meta CSP stays as it is."
That sentence is false if we use blob URLs.

**Amendment:** Session 01 adds an explicit

```
frame-src 'self' blob: file: specdown:
```

Do **not** add `blob:` to `script-src`. A test must assert the
production `index.html` CSP allows `frame-src` blob and does not
allow `blob:` on `script-src`.

### F2 — Session 02 print-as-specified is XSS

**Seat:** Security, verified in `platform/ios-chrome.js`
(`printViaHiddenFrame` → `frameDoc.write(printableHtml)` into a
**same-origin, unsandboxed** iframe) and `desktop/main.js`
(`loadPrintableWindow` writes a temp `.html` and `loadFile`s it).

Spec §5 said: host returns `document.documentElement.outerHTML`
(post-JS, scripts and all) and the parent "wraps the snapshot in
the print window/iframe already used for markdown."

That write is the Absorb design we vetoed. Faithful HTML in a
same-origin print iframe runs document scripts in the SpecDown
origin. Desktop PDF is the same class of bug (temp file +
`loadFile`, `sandbox: true` on the *BrowserWindow* but still an
app-controlled document executing attacker HTML).

**Amendment (design now, code in Session 02):**

- **Preferred:** print *from inside* the opaque preview iframe
  (`specdown-print` → host calls `window.print()`). Charts exist.
  Scripts stay in the opaque origin. The dialog attaches to the
  visible window (macOS sheet rule still holds because the iframe
  is in the visible window).
- **Fallback:** print a **script-stripped** rewrite (no event
  handlers, no `<script>`). Never `document.write` Faithful HTML
  into a same-origin frame.
- Session 01: **Print is a hidden capability for HTML.** Cmd+P /
  File > Print / `#ios-print-button` / `#print-button` must not
  call `performPrint()` on an HTML tab (toast if invoked: "Print
  for HTML lands next"). Markdown print is unchanged.

### F3 — Iframe self-navigation turns SpecDown into a browser

**Seat:** Security + Product.

`sandbox` without `allow-top-navigation` stops the iframe from
navigating *the parent*. It does **not** stop
`location.href = 'https://…'` *inside* the iframe. Agent HTML
(or a `data:text/html` / `javascript:` link) can replace the
preview with an arbitrary site. That is the #1 way the "no
browser" list fails in practice.

Desktop `will-navigate` allows `file:` and opens http(s)
externally — it is a **main-frame** guard. Subframe navigation
is a separate hole (`will-frame-navigate` is not wired).

**Amendment:**

- Invariant 9: the preview `src` must remain the blob (or
  protocol URL) we minted. On `load`, if it is not, reset to
  the blob and toast.
- Desktop Session 01: `will-frame-navigate` — deny anything
  that is not our blob / `about:blank` / `file:` (app). http(s)
  from a subframe → `openExternal`, do not display in-frame.
- Rewrite: strip `<base target>`, neutralize `javascript:` and
  `data:text/html` `href`s.

### H1 — `fileAssociations` missing from the gate table

**Seat:** Platform, verified in `package.json` →
`build.fileAssociations` (only `md` / `markdown`).

Without this, a released desktop build will not offer SpecDown
in Finder / Explorer "Open with" for `.html`. The in-app dialog
can still open them. The OS-open job in the brainstorm ("this
is the home surface") would be false for a full release cycle.

**Amendment (first pass):** Session 01 adds an HTML
`fileAssociations` entry.

**Reversed (product seat):** OS/PWA HTML handler is an identity
event. Slip `fileAssociations` and `file_handlers` to Session 04.
In-app dialog filter “HTML” is enough for Session 01.

### H2 — Workspace listing must move into Session 01

**Seat:** UX + Platform.

`scanWorkspace` and the web folder walk still use markdown-only
predicates. Session 01 advertising "drop HTML" plus an existing
**Open Folder** button produces "No markdown files found" on a
folder of agent reports. That is a first-run defect, not a
Phase-2 nice-to-have.

Relative *link following* and sibling assets stay later.
**Listing** is one helper and must ship with the kind.

**Amendment:** `isOpenableDocument` is used by `scanWorkspace`
and the web walk in Session 01. Empty-folder copy becomes
"No Markdown or HTML files found." Link clicks on `.html` can
wait for Session 03 if the regex is not ready — but the sidebar
must *show* the files.

### H3 — Tab / empty-state iframe lifecycle was hand-waved

**Seat:** Platform, verified in `features/tabs.js`.

`createTab` / `switchTab` / `closeTab` all call `renderDoc(content,
filename)` — fine once that dispatches. `showDropZone` only
`setHtml('markdown-content', '')`. It does not clear
`#html-frame.src` or revoke the blob. Closing the last HTML tab
leaves a live sandboxed document ticking under the landing.

`tab.scrollTop` is applied to `#markdown-content`, which is hidden
on HTML preview. Accept scroll-loss for Session 01; do not pretend
it works.

**Amendment:** Session 01 tasks include `htmlTeardownFrame()` on
empty state, tab close of the last HTML tab, and before swapping
blobs. One iframe, many tabs: every activate remounts the blob
from `tab.rawMarkdown`.

### H4 — `handleUrl` does not read `Content-Type`

**Seat:** Platform, verified in `features/file-loading.js`.

The spec already required extensionless URL + `text/html` → html.
The Session 01 checklist never mentioned `handleUrl`. Today's
code always `createTab(filename, markdown)` and filename from the
path (`untitled.md` for `/`). A gist or `raw` URL without `.html`
would render as markdown garbage.

**Amendment (first pass):** Session 01 — `handleUrl` passes
`Content-Type` into `detectKind`.

**Reversed (product seat):** Session 01 is extension-only.
Content-Type sniff + Faithful is a new trust model. Remote HTML
waits for Session 05 with Safe-as-default.

### H5 — 8 MB cap must be HTML-only

**Seat:** Security / Platform.

The spec put the cap on `handleFile` / `openFileByPath` /
`handleUrl` without saying "HTML." A large markdown spec would
start getting refused. Cap the HTML path only.

### H6 — iOS sheet and desktop Print are lying on day one

**Seat:** UX, verified in `index.html` (`#ios-print-button`,
`#ios-comments-button`, `#ios-annotations-button`,
`#ios-split-button`, `#ios-present-button`).

Session 01 hid Present / Annotate / Comments in the task list
and left Print as "may no-op." An iPhone user has no toolbar;
the sheet *is* the product. Print-on-empty-`#markdown-content`
is worse than a missing button.

**Amendment:** `documentCapabilities('html')` in Session 01 is
`preview`, `raw`, `split` (only if split actually hosts the
iframe), `liveReload`, `fileInfo`. Everything else **hidden**,
including Print / Find / TOC / Comments / Annotate / Present.
`syncIOSChrome` must consult the table. Palette commands that
are hidden are omitted, not disabled-without-reason.

### H7 — Permissions-Policy and rewrite gaps

**Seat:** Security.

The iframe needs `allow=""` (or an explicit deny list:
camera, microphone, geolocation, payment, usb, display-capture)
so Faithful pages cannot prompt for device APIs.

Rewrite must also: strip `<base target>`, remove
`meta[http-equiv=set-cookie]` if present, and not assume
DOMParser preserves a doctype (re-emit `<!DOCTYPE html>`).

### H8 — Host module vs eval harness

**Seat:** Platform, verified in `tests/helpers/loadApp.js`.

If `html-host.js` is a relative import, the harness inlines it
into the **parent** global scope. A host file with `function
onMessage` or `let ready` will collide. The host must export
only a string constant (`htmlHostInlineSource`) and use
`htmlHost*` prefixes if it has any bindings. No top-level
side effects — the parent must not run the host.

### H9 — Product "no" list needs a mechanical guard

**Seat:** Product.

The no-browser rule fails the first time a document navigates
(F3) or Print writes into the app origin (F2). Those are now
invariants, not prose. Remaining social pressure (PDF, edit,
"just allow-same-origin so TOC is easier") is a review
checklist item on every HTML PR, already started in spec §6.

### H10 — Faithful-for-URLs is a different trust level

**Seat:** Product + Security.

A local drop is a file the user had. A pasted URL is whoever
answered. Session 01 uses the same sandbox for both (isolation
does not depend on trust). Session 05 Safe mode should
**default Safe for URL-opened HTML** and Faithful for local
paths. Recorded now so we do not paint a single global default.

---

## 2. Challenges that did not land (plan holds)

| Challenge | Why we rejected it |
|---|---|
| "v2 said consolidate, don't add — HTML is the wrong phase." | Consolidation was about tokens, toolbar collision, and unsigned Win/Linux update. Those shipped or were scoped. HTML is a *job* the current gates refuse. Doing it as a forked kind is smaller than another chrome feature. Caveat: Session 01 stays skeletal so we don't recreate coherence debt. |
| "Just open HTML in Chrome; SpecDown should stay markdown." | Chrome has no live reload + mixed workspace + SpecDown print. That *is* the product. We are not competing on being a browser. |
| "Safe-as-default so we never run scripts." | Makes the feature look broken on dashboards/decks — the files we cited as the reason. Isolation (opaque iframe) is the control, not script-stripping. Safe is the escape hatch. |
| "Convert to markdown for TOC/Find, preview as HTML." | Two sources of truth. Find wouldn't match the page. Rejected again. |
| "srcdoc is simpler than blob." | srcdoc + `allow-same-origin` + scripts = XSS. srcdoc without same-origin is viable but worse for later `<base>` / assets. Stick to blob; fix CSP (F1). |
| "Add `allow-same-origin` so parent can read TOC." | Veto stands. Host bridge or hide TOC. |
| "Skip iOS until TestFlight." | Shared renderer + picker types are cheap. Skipping them is how iPhone becomes a second product. Device smoke stays best-effort. |
| "Session 01 should include Mermaid-in-HTML so it feels like SpecDown." | Comforting, wrong corpus. Most agent HTML is not a Mermaid document. Enhance stays last. |
| "Rename `rawMarkdown` now." | Pure churn across the eval harness. Alias later. |
| "8 MB is too small / too large." | Fine as a first cap; raise with evidence. HTML-only (H5). |

---

## 3. UX honesty contract (Session 01)

What the user may do with an HTML tab on day one:

- Open (drop, browse, URL with `.html`/`.htm` or `text/html`,
  desktop dialog, OS-open once `fileAssociations` land, iOS picker,
  workspace **listing**)
- See the page in the stage (blob iframe)
- Raw / Split (source | page)
- File info, recents, session restore, live reload (path-backed)
- Switch tabs without leaking the last blob under the landing

What they must **not** see as if it worked:

- Print / PDF
- Find
- Contents
- Present, Annotate, Comments
- Sibling `./chart.js` (no toast-storm; one toast if the rewrite
  saw relative URLs and we have no `baseHref`)

Landing: change "Drop Markdown File Here" → "Drop a Markdown or
HTML file." One sample button, Mermaid stays the hero. No new
pillar.

---

## 4. Resolved contradictions

| Was | Now |
|---|---|
| Brainstorm Invariant 2: `allow-scripts allow-forms`. Spec: `allow-scripts` only. | **`allow-scripts` only.** Injected iframe CSP has `form-action 'none'`. Forms that need submit are Session 05+ if ever. |
| Brainstorm Invariant 6: app CSP unchanged. | **App CSP gains `frame-src` blob.** Script policy unchanged. |
| Workspace scan "Session 03" vs "Session 01 uses the helper." | **Listing in Session 01.** Links/assets later. |
| Print "designed in spec, maybe no-op in Session 01." | **Hidden in Session 01.** Host-internal print in Session 02. No same-origin `document.write` of Faithful HTML. |
| Size cap on all opens. | **HTML only.** |

---

## 5. Open questions — council answers

1. **Blob vs srcdoc vs protocol for v1?** Blob + `frame-src` fix.
   Protocol remains Session 04. Avoid srcdoc.
2. **Sniff Content-Type on extensionless URLs?** **No in
   Session 01** (product addendum). Extension-only. Sniffing
   turns the existing URL box into a scripted browser. Session 05
   ships Safe-default for remote ingress if URL HTML is fetched.
3. **`.htm`?** Yes.
4. **Default Faithful or Safe?** Local Faithful. Remote HTML is
   not a Session 01 job. When URL HTML ships, default **Safe**.
5. **iOS in Session 01?** Shared renderer + picker `UTType.html`.
   No sample button, no TestFlight dependency.

---

## 6. Is the plan solid?

**Yes, after the amendments.** The product move is the right
one for 2026 artifacts. The engineering move (fork + opaque
iframe + capability table) is the only move that does not
either destroy the file or destroy the security posture.

What was *not* solid was treating Session 01 as "accept the
extension and put it in an iframe" without:

- changing the **parent** CSP,
- locking iframe navigation,
- hiding every chrome control that still walks
  `#markdown-content`,
- listing HTML in workspaces,
- specifying iframe teardown,
- forbidding same-origin print of Faithful HTML.

Those are now in the spec and the Session 01 checklist.
A later session that wants `allow-same-origin`, parent
`innerHTML`, or Print-via-`document.write` has to win an
argument against F1–F3 in this file first.

**Council recommendation:** implement Session 01 from the
amended spec. Do not open a "just the iframe" spike that
skips F1 or H6 — that spike would look broken and teach
the wrong lesson about the fork.

---

## 7. Addendum — Product + UX seats (same day)

Independent seats pushed back on the *first* council pass
where it still launched HTML as a product. Adopted:

**Product (right phase with caveats).** Sessions 01–04 are
one bet. Kill/pause if after Session 02 the desktop demo is
not “local HTML + Live chip + print.” Do not change the
one-liner. Do not register SpecDown as a system/PWA HTML
handler in Session 01 (`fileAssociations` and
`file_handlers` slip to Session 04). Session 01 URL path is
**extension-only** (`.html`/`.htm`); no `Content-Type` sniff.
Decks, prototypes, and “apps with filters” are not success
metrics. Session 02 is Print, not Find. Expand the no-list:
no localhost/`ws:` in document CSP, no cookie jar, no
default-app claim, nested frames stay stripped (no “revisit”).

**UX (will feel broken unless chrome honesty is the slice).**
`documentCapabilities` must gate toolbar, palette
`isAvailable`, iOS sheet, **and** `⌘F`/`⌘P`. `performPrint()`
returns immediately on HTML — no `window.print()` fallback.
On HTML render/switch: clear TOC, close search, force
annotate **off**, hide iframe on Raw. `#document-stage` is
the flex preview child — do **not** nest `#html-frame` inside
`.markdown-content` (prose padding imprisons the page). Split
CSS targets the stage. Lone-file relative-URL toast in
Session 01. No landing copy change, no second/third sample
button (sample file is QA-only). Host key-forward for
⌘K/⌘F/⌘P/`?`/Esc, or document “click the filename to return
focus.” Relabel Raw → Source when the control is shared.

**Reversed from the first pass:** H1 (OS HTML association)
and H4 (Content-Type sniff) are **not** Session 01. They
were the launch. Workspace listing (H2) stays.

---

## 8. Addendum — Platform seat (same day)

The fork is right. These gates were still missing after the
product/UX tighten:

- **Live reload DI.** `configureDesktop`, `configureTabs`, and
  `configureViewMode` all take `renderMarkdown`. If any stay on
  the markdown function, a Live save or Raw→Preview runs
  `marked.parse` on HTML. `refresh-file` still uses
  `isValidMarkdownFile`. Wire all three + the IPC to
  `renderDocument(tab)` (kind on the tab, not re-detected).
- **Stage apply on raw.** `tabs.js` / `view-mode.js` raw paths
  write `#markdown-content` and return **without** hiding the
  iframe. Raw-on-HTML leaves the page sitting on the source.
- **8 MB at read**, not at rewrite (`handleFile` /
  `openFileByPath` / iOS `openDocument`). Rewrite is too late.
- **`#document-stage` `@media print` reset in Session 01**
  even though HTML print is Session 02. New full-height
  ancestor otherwise reclips markdown Cmd+P (`CLAUDE.md`).
- **iOS UTI.** Add `public.html` to `LSItemContentTypes` only.
  Do not redeclare it under `UTImportedTypeDeclarations`. Rank
  stays Alternate. iPad `ContentView.swift` label can say
  “Open File”; no new sample button.
- **Drops stay on `getPathForFile`.** No `file.path` (Electron
  32+).
- **Inverted tests** go red for the right reason
  (`desktop-main.test.js` `.html` false, file-loading toast
  copy). Update them in the same PR. CSP proof is a **static
  grep** of `index.html` — `loadApp` copies `<body>` only.
- **Session 04, if `fileAssociations` land:** macOS
  `open-file` is not enough; Win/Linux need `process.argv` /
  `second-instance` or the association is paper.

Workspace listing stays one helper on desktop **and** the web
walk (H2). Do not leave Open Folder kind-skewed.
