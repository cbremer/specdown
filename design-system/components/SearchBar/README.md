# SearchBar

In-document find bar: query, match count, previous/next, close.

**Source:** `.search-bar`, `.search-input`, `mark.search-highlight` ("Search Bar"). Static rendition.

- The bar is `bg-primary` with a bottom hairline. Padding 0.5rem 1rem, gap `space-2`.
- Input: `bg-secondary`, `border-color` that turns `accent-color` on focus, `radius-md`, max 320px.
- Count in `ui-caption` `text-secondary`. Nav buttons follow the toolbar button pattern at `radius-sm`.
- Matches use `search-highlight`; the current match uses `search-highlight-current` with an outline. The dark highlight text is below 4.5:1 (flagged).
