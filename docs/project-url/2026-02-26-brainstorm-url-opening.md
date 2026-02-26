# Brainstorm: URL Opening in SpecDown

**Date:** 2026-02-26

---

## Problem

SpecDown renders local markdown beautifully, but sharing a document means sending a file. If a doc lives on GitHub or another web host, a user must download it, open it, and then share the rendered view separately. This friction reduces SpecDown's usefulness for reviewing shared documents.

## Idea 1: Open from URL (primary)

Paste a URL into the app → fetch the raw markdown → render it in a tab.

**Why this matters:**
- GitHub hosts thousands of `.md` files (READMEs, specs, wikis)
- No download step needed
- URL can be shared to reproduce the exact document view
- Works with any publicly accessible raw markdown URL

**Immediate use cases:**
- Opening GitHub READMEs and spec files directly
- Sharing a SpecDown "view" of a doc by pasting the URL to a colleague
- Reviewing PRs — open the changed `.md` from the GitHub raw URL

### GitHub URL normalization

GitHub's blob URLs are not directly fetchable:
```
https://github.com/user/repo/blob/main/README.md       ← HTML page, not markdown
https://raw.githubusercontent.com/user/repo/main/README.md  ← raw markdown
```

We should auto-detect GitHub blob URLs and convert them so users don't have to know the distinction.

### CORS considerations

Browser fetch is subject to CORS. Key findings:
- `raw.githubusercontent.com` — **CORS allowed** (responds with `Access-Control-Allow-Origin: *`)
- Most CDN-hosted static files — allowed
- GitHub blob pages, arbitrary websites — **blocked** (CORS not set)

Mitigation:
- Auto-convert GitHub blob URLs to raw URLs (sidesteps the common case)
- Show a clear error when CORS blocks: "This server doesn't allow cross-origin requests. Try using the raw file URL."
- Electron: no CORS restrictions — all URLs work without workaround

## Idea 2: Inline Reviewer Comments (future)

Add Google Docs-style margin comments to a rendered markdown view. A reviewer could:
- Select text in the rendered view
- Add a comment pinned to that selection
- Comments saved locally (or in a sidecar `.comments.json`)

**Why deferred:**
- More complex state management (comment anchors, serialization, UI overlay)
- Requires a clear sharing/persistence story before building
- URL opening is simpler and more immediately useful

This is a good idea to spec and build in a future session as `project-url` v2 or a new `project-comments` project.

## Out of Scope for Session 01

- Authentication for private GitHub repos
- Caching fetched URLs
- URL history / bookmarks
- Comments
