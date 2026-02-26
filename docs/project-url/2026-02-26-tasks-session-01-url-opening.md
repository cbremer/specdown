# Tasks: Session 01 — URL Opening

**Date:** 2026-02-26
**Branch:** `claude/add-url-opening-5lhZ8`

---

## Checklist

- [x] Create `docs/project-url/` directory and documentation files
- [x] Update `docs/README.md` to list project-url
- [x] Add URL input section to `markdown-viewer/index.html` (drop zone)
- [x] Implement `normalizeMarkdownUrl()` in `app.js`
- [x] Implement `getFilenameFromUrl()` in `app.js`
- [x] Implement `handleUrl()` in `app.js`
- [x] Wire up URL input events in `DOMContentLoaded`
- [x] Style URL input section in `styles.css`
- [x] Write unit tests in `tests/unit/urlHandling.test.js`
- [x] All tests pass, coverage thresholds met
- [x] Commit and push to feature branch

## Notes

- GitHub blob URL auto-conversion makes the common case seamless
- CORS errors show a clear, actionable message pointing users to the raw URL
- Electron: no additional code needed — renderer fetch has no CORS restrictions
- Watch button already gated on desktop + local path; URL tabs get no watch button automatically
