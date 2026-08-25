# Spec: HTML staging rail

**Date:** 2026-08-25
**Status:** Specified (process + isolation contract; no product
code in this file)
**Companion:** [brainstorm](2026-08-23-brainstorm-html-documents.md) ·
[spec v1](2026-08-23-spec-html-v1.md) ·
[council](2026-08-23-council-html-plan-review.md) ·
[Session 00](2026-08-25-tasks-session-00-staging-rail.md)

HTML work shares `markdown-viewer/` with the shipped markdown
app. A merge to `main` is not a preview: it is a **release**.
This spec is how we try HTML without giving that release to
everyone.

Session 01 does **not** start until Session 00 has landed on
`main` and the `html` integration branch exists.

---

## 1. Why this exists

Today, anything that reaches `main` does all four:

1. **Version bump** (patch) on `main`
2. **Desktop** — signed DMG / Win / Linux on the GitHub Release,
   including `latest*.yml` (auto-update)
3. **Web** — GitHub Pages at
   `https://cbremer.github.io/specdown/`
4. **iOS** — the next source build picks up `markdown-viewer/`

There is no staging URL, no feature flag, and no second Pages
site. Session 01 as originally scheduled would have been a
normal PR into `main`. That would ship a new content pane, a
parent CSP change (`frame-src`), new open gates, and an iframe
lifecycle into the app every current user already has.

The council already said Session 01 is a skeleton, not a
launch, and that Sessions 01–04 are one bet to **kill/pause**
if the Session 02 desktop demo is not “local HTML + Live chip
+ print.” That demo must happen **off production**. This rail
is that off-ramp.

### What we are protecting

| Surface | Failure if we are sloppy |
|---|---|
| Markdown drop / browse / URL / repo | HTML rewrite or `kind` dispatch runs `marked` wrong, or not at all |
| Mermaid pan/zoom / Present | Stage CSS or `#document-stage` clips or steals events |
| Print / PDF | New full-height ancestor + `frame-src` + iframe leftover (CLAUDE.md print gotcha) |
| Parent CSP | Loosening `script-src` to make the preview work is XSS |
| Desktop auto-update | A bad HTML build on the Release is what every DMG checks next |
| PWA | A staging folder *under* `/specdown/` is in the production service worker’s scope |

### Non-goals

- A second product, rename, or landing rewrite
- Playwright in Session 00 (Jest golden-path + manual smoke)
- TestFlight / a staging DMG on the production update feed
- Letting `?html=1` on the production origin turn the gates on
  (that is a drive-by enable of the preview host)
- Putting HTML staging at
  `https://cbremer.github.io/specdown/html-staging/` — the PWA
  service worker is registered at `./sw.js` and claims that
  whole origin path

---

## 2. Three layers (all required)

Git isolation without a flag still ships layout/CSP the moment
someone merges early. A flag without git isolation still
version-bumps six times while the wedge is half-done. A preview
URL without either still tempts “just land it on Pages.”

Use all three.

### Layer A — Integration branch `html`

- Create `html` from `main` **after** Session 00 merges.
- Sessions 01–04 (and 05–06 if they happen) are PRs whose
  **base is `html`**, not `main`.
- `html` does **not** run version-bump, `desktop.yml`, or
  production `static.yml`. Those stay `main`-only.
- Rebase (or merge) `main` into `html` after every version-bump
  on `main`, so the branch does not rot.
- One logical change per PR still holds. Rebase-and-merge into
  `html`. Do not squash a multi-commit session.
- Feature branch names stay `cursor/…` / `claude/…`. Only the
  **base** changes.

Kill/pause (council): if Session 02’s staging demo fails, stop
merging into `html` and do not open `html` → `main`.

### Layer B — Compile-time flag `VITE_HTML_DOCUMENTS`

Default **off**. Production `npm run build` (Pages + release
desktop + iOS CI on `main`) does not set it.

When **off**, the running app must behave as today’s markdown
viewer:

- Open gates stay `.md` / `.markdown` (and the current iOS
  picker set). `.html` is still rejected.
- No `#html-frame` in the DOM.
- No `#document-stage` wrapper (do not re-parent markdown “just
  in case” — that is how print clips).
- Source `index.html` CSP on `main` stays as it is. `frame-src`
  is a **build transform** on HTML-on builds only, until the
  production flip.
- `detectKind('x.html')` may exist as a pure function, but
  ingress must not call it for acceptance until the flag is on.

When **on** (staging builds and, later, the flip):

- Session 01+ behavior from the HTML spec applies.
- Parent CSP may gain `frame-src 'self' file: specdown:` only.
  Still no `blob:` and no `'unsafe-inline'` on parent
  `script-src`.

**Vite mode:** `.env.html` contains `VITE_HTML_DOCUMENTS=true`.
Scripts (Session 00):

| Script | Meaning |
|---|---|
| `npm run dev` / `build` / `desktop` | Flag **off** — production-shaped |
| `npm run dev:html` | `vite --mode html` |
| `npm run build:html` | HTML-on `dist/` |
| `npm run preview:html` | Serve that `dist/` (port 4179) |
| `npm run desktop:html` | HTML-on renderer **and** `VITE_HTML_DOCUMENTS=true electron .` |

Electron **main** is not Vite-bundled. The desktop script must
export the env var into the main process so `isOpenableDocument`
and the renderer cannot disagree (HTML UI + OS-open still
rejecting `.html` is a staging lie).

**Eval harness:** do not rely on a bare `import.meta.env` as the
only signal — `loadApp.js` evals at global scope. Unique names
(`htmlDocumentsEnabled`, `htmlDocumentsEnabledFlag`). Prefer a
Vite `define` boolean literal plus a `process.env` check in
`desktop/main.js`.

**Layout is not behind the flag.** `#document-stage`, extra CSS, and
a CSP transform can still break markdown Print/Present the moment
they exist in the source you merge. The flag only keeps `.html`
*rejected* on production-shaped builds. That is why Sessions 01–04
stay on `html` until the golden path has been run **against that
layout**, not only against `main` as it looks today.

### Layer C — Staging surfaces (where humans actually try it)

Daily loop (required):

1. `npm run dev:html` — web, port 5179
2. `npm run preview:html` — production-shaped HTML-on bundle
3. `npm run desktop:html` — only where a display exists; **never**
   `desktop:build` from this branch onto a `v*` tag

CI (required in Session 00):

- Push/PR to `html`: existing lint / typecheck / `test:ci`
- **Matrix or second job:** flag off *and* flag on, once HTML
  modules exist (Session 01). Session 00 only needs the helper
  unit-tested both ways.
- Upload `markdown-viewer/dist` from `build:html` as a workflow
  artifact named `html-staging-web` (reviewers can unzip +
  `npx serve`).

Public HTTPS (optional, not a Session 00 blocker):

- A **different origin**, e.g. a tiny `specdown-html` repo’s
  GitHub Pages, or Cloudflare Pages on this repo.
- Same-origin `/html-staging/` under production Pages is
  **disallowed** (service worker scope).
- If a public origin is added, it must noindex, must not
  register as the PWA for the production start_url, and must
  never publish `latest*.yml`.

---

## 3. Production vs staging

| | `main` (shipped) | `html` (dogfood) | After go/no-go |
|---|---|---|---|
| Version bump / Release / auto-update | yes | **no** | one merge → one bump |
| Pages `cbremer.github.io/specdown` | flag **off** | not this URL | flag **on** |
| Open `.html` | reject | accept (flag-on build) | accept |
| Landing / OG / README lede | unchanged | unchanged | still unchanged until copy is a deliberate PR |
| `fileAssociations` / PWA HTML handler | unchanged | unchanged (Session 04) | Session 04, still not default-app |
| Press B | embargoed | embargoed | still embargoed until Live + print on **production** |

---

## 4. Process

### 4.1 Order of work

```
Session 00  ──PR→  main     rails only (flag, scripts, CI, docs)
                 then: git branch html main && push

Session 01–04  ──PR→  html   HTML runtime, still not a release

Session 02 staging demo
        │
        ├─ fail → pause; do not merge to main
        └─ pass → PR html → main (flag on in that build)
                   still no landing launch, no OS HTML handler
```

Session 00 **may** merge to `main`. It must be behavior-neutral
for users: same gates, same DOM, same CSP source, same Pages.

### 4.2 Markdown golden path (every HTML PR)

Automated (Jest; flag-off job must stay green):

- Existing markdown / Mermaid / tabs / workspace / desktop
  `artifactName` tests
- Flag **off:** `.html` still rejected at ingress (file-loading +
  `desktop/main.js`); `accept` attribute unchanged; no
  `#html-frame`; source CSP string unchanged (static grep of
  `markdown-viewer/index.html`, not `loadApp`)
- Flag **on** (from Session 01): HTML tests from spec §8, **and**
  the flag-off job still run on the same SHA

Manual, on `preview:html` or `desktop:html`, before merging into
`html`:

1. Drop `diagram-showcase.md` (or equivalent) — Mermaid zoom,
   Present, export
2. Markdown Print/PDF — not clipped to the viewport
3. Drop a `.txt` — still rejected
4. Close last tab — landing, no leftover iframe
5. Then the HTML checklist for that session

Do not treat “HTML sample looks good” as the only smoke.

### 4.3 Go / no-go (`html` → `main`)

All of:

- Session 02 desktop staging demo: local `.html` + Live chip +
  print from inside the isolated frame
- Flag-off CI green (markdown product still identical in that
  job)
- Flag-on CI green
- Parent `script-src` still has no `'unsafe-inline'` and no
  `blob:` on production-shaped HTML-on CSP
- No `fileAssociations` / `file_handlers` HTML claim in that
  merge
- Rollback plan below is written in the merge PR body

The merge is **one** PR into `main` (rebase if `html` is linear).
That is the first HTML *release*. It is still not Press B and
not a landing change.

### 4.4 Rollback (after a production flip)

Fast: set the production workflows to build **flag off**
(`static.yml` / `desktop.yml` / iOS web copy) and ship that
hotfix. Do not attach a flag-on artifact to the Release in
between.

Slower: revert the `html` → `main` merge. Prefer the flag off
hotfix if the markdown path is fine and only HTML is on fire.

Do **not** roll back by publishing a staging Electron build
onto the existing tag. `artifactName` and `latest*.yml` stay
production-only.

### 4.5 What not to do

- Merge Session 01 to `main` “behind a comment” or a
  `localStorage` kill switch with the flag compiled on
- `workflow_dispatch` `desktop.yml` against `html` and upload
  to the current Release
- Loosen parent CSP on `main` to “get ready”
- Add `#document-stage` on the flag-off path
- Use `--no-verify` or skip the flag-off test job

---

## 5. iOS

No auto-update channel. Blast radius is source builds and CI.
Still:

- Session 01 iOS picker / UTI changes live on `html`, not
  `main`
- Session 00 may add `html` to `ios.yml` `push.branches` so the
  simulator build runs there
- Do not redeclare `public.html` under
  `UTImportedTypeDeclarations` (council)

---

## 6. Acceptance (this spec is in force when)

- Session 00 checklist is done on `main`
- `html` exists and is protected from version-bump by simply
  not being `main`
- README / Session 01 / HTML spec say: **base `html`, flag on
  for dogfood, production stays off until go/no-go**
- A reviewer can exercise HTML without installing a Release
  DMG (`dev:html` / `preview:html` / `desktop:html` / CI
  artifact)
