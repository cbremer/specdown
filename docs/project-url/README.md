# project-url

Open markdown files directly from the web — paste a URL, see the rendered document.

## What This Project Is

SpecDown natively loads local files. This project adds URL-based loading so users can open any publicly accessible markdown file without downloading it first. The primary use case is GitHub-hosted documentation and READMEs.

A second idea — inline reviewer comments (Google Docs-style) — is scoped out here but not implemented in the first session.

## Timeline

| Date | Type | File | Notes |
|------|------|------|-------|
| 2026-02-26 | brainstorm | [2026-02-26-brainstorm-url-opening.md](2026-02-26-brainstorm-url-opening.md) | Problem framing, CORS notes, future comments idea |
| 2026-02-26 | spec | [2026-02-26-spec-url-v1.md](2026-02-26-spec-url-v1.md) | Technical specification v1 |
| 2026-02-26 | tasks | [2026-02-26-tasks-session-01-url-opening.md](2026-02-26-tasks-session-01-url-opening.md) | Session 01 implementation checklist |

## Current Status

Session 01 complete — URL opening implemented in web and Electron apps.

## Naming Conventions

Files in this folder follow the project-wide pattern:

```
YYYY-MM-DD-<type>-<detail>.md
```

## Public repository browsing (1.0.2 development)

The shared viewer lists public GitHub repositories without authentication through repository metadata and Git Trees. Bare repository URLs select the default branch; `/tree/<branch>` and folder URLs resolve the longest valid branch/revision and filter its subtree. Slash-containing branches can be percent encoded. File selections use a commit-pinned raw URL, so a branch update cannot switch the selected snapshot. Existing raw Markdown and blob URLs retain their normal loading flow.

Git Trees has no pagination cursor. A truncated recursive result triggers nonrecursive subtree traversal; incomplete results are never displayed as complete. Each listing has a 30-second deadline and ceilings of 32 requests, 8 MiB aggregate response bytes, 20,000 entries, 2,000 Markdown files and eight branch/path candidates. Larger repositories can still be opened using individual raw Markdown URLs. Rate limits, unavailable branches/repositories, network errors and capacity failures preserve the current document and show recovery guidance. Private repository login and credential storage are outside this flow.

API references: [Git trees](https://docs.github.com/en/rest/git/trees), [repository metadata](https://docs.github.com/en/rest/repos/repos#get-a-repository), [Code Search authentication](https://docs.github.com/en/rest/search/search#search-code).
