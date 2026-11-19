# RepoBrowser

GitHub repository browser: filter and pick a Markdown file from a public repository opened by URL.

**Source:** `src/features/repo-browser.js`, `.repo-browser-*`. Static rendition.

- Scrim **.5 with a 4px blur** (the only blurred scrim). **z-index 2000.**
- Panel is a fixed **520px** (max 95vw, max-height 70vh), `radius-xl`, no outer padding. A header bar at 1rem 1.25rem has a hairline, a title at 0.95rem/600 with an ellipsis, and a × close that **turns red** on hover (hard-coded `#e74c3c`).
- A filter input row, then a scrolling list.
- **This is the closest to the target anatomy** (header / search / body). Target: Modal size md with a header slot for the filter.
- No Escape handler was found in `repo-browser.js`. Verify that Escape closes it.
