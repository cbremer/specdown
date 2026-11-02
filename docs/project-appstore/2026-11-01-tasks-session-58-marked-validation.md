# Session 58 — Marked dependency validation

The owner authorized validating the remaining dependency proposals while keeping
the reviewed Store build 230 frozen and version proposal #357 pending. This task
reviews #319 (`e6b9cdb`) in the isolated `codex/deps-marked-validation` worktree.
Its dependency diff changes only Marked 18.0.14 to 18.1.2 in package.json and the
lockfile. No application implementation or native/version configuration changes
were needed.

## Upstream changes and review scope

Official [18.1.0 notes](https://github.com/markedjs/marked/releases/tag/v18.1.0)
describe link-destination parsing and backtracking changes. The
[18.1.1 notes](https://github.com/markedjs/marked/releases/tag/v18.1.1) and
[18.1.2 notes](https://github.com/markedjs/marked/releases/tag/v18.1.2) include
HTML-block/raw-tag, character-reference, emphasis, list/blockquote and nested
image/link corrections. CLI-only changes do not run in SpecDown. The viewer
still parses synchronously, then applies its existing DOMPurify policy and
document limits before committing a document.

## Real-library checks

The existing Jest suite normally mocks Marked and DOMPurify. The new
`tests/integration/markdown-real.test.js` instead loads the installed Marked UMD
distribution, real DOMPurify and real highlight.js while evaluating the actual
application configuration, sanitizer, admission and rendering modules through
the existing helper. Each test restores the ordinary mock dependencies afterward.

All **26 cases pass**: GFM tables/tasks/links/line breaks; plain authored comments;
active HTML, CSS and application-control attribute removal; unsafe link/resource
policy; literal and highlighted fences; Mermaid source handoff; nested image alt
text; list/blockquote structure; encoded and malformed HTML; size/complexity/depth
rejection preserving the current document; and stale async completion ownership.
An empty Markdown file remains a valid empty tab. Comments containing active HTML
are intentionally dropped by DOMPurify; plain authored comments remain visible.

The same 26 behavioral cases also pass against the installed 18.0.14 baseline.
They establish compatibility and permanent real-library coverage; they are not
claimed as newly failing baseline bugs fixed by this update.

A separate Node/JSDOM check imports the **actual production ESM parser and core
modules**. All **32 parser corpus entries** produce identical ESM/UMD output, and
**24 production-core assertions** pass for synchronous preparation, actual syntax
highlighting, sanitization and rejection limits. These checks use synthetic input
and bundled samples, with no network document loads. Jest keeps Mermaid/Panzoom
and native surfaces mocked; this is not a new real Mermaid SVG, native WebKit,
packaged desktop or physical TestFlight acceptance claim.

## Required gates and preservation

- A physical, worktree-local dependency installation completed with `npm ci` from
  the unchanged lockfile. Lifecycle scripts were disabled, and the existing
  project postinstall verification was then run explicitly. It verifies dependency
  source text and does not access signing keys. Node 22.23.4 satisfies Marked's
  Node >=20 engine; no new engine requirement is introduced here.
- **1,367 tests / 78 suites**, required coverage, lint, typecheck and the production
  web build pass. Desktop main coverage is 72.89% statements / 63.04% branches /
  64.49% functions / 75.49% lines; the known renderer eval-coverage limitation is
  unchanged. The build has the existing large-chunk advisory and produces 110 files.
- Package/viewer build 230 and native marketing 1.0.1/build 230 remain unchanged.
  The canonical checkout, generated Xcode/signing settings, selected Store copy,
  owner data and all frozen 229/230 artifacts are untouched. No new Store artifact
  is implied by this dependency review.
- Parent source review found no blocking issue. This follow-up adds real-library
  regressions and the handoff only. Push, GitHub checks, integration and any merge
  are parent-owned later steps; no signing, upload, Apple access or release occurs
  here.

Local evidence is retained under
`ios/DerivedData/dependency-validation-20261101/marked/`: install and required-gate
logs, `real-markdown-baseline-18.0.14.log`, the ESM check and
`esm-verification.json`, and the final source/build manifest. Exact candidate
hashes and any later GitHub state must be read from that evidence, not inferred
from this session's passing local checks.
