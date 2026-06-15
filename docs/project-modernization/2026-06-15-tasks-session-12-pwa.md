# Tasks — Session 12: Phase 3 (PWA — installable + offline web app)

**Date:** 2026-06-15
**Type:** tasks (session-level implementation checklist)
**Phase:** 3 — distribution

Makes the **web (GitHub Pages) surface** installable and offline-capable. Scoped
strictly to the web: the same `dist/` is loaded by the Electron (`file://`) and
iOS WKWebView (`specdown://`) shells, where a service worker is unsupported and
pointless, so registration is guarded off there.

---

## What shipped

- **`markdown-viewer/public/manifest.webmanifest`** — name/short_name, relative
  `start_url`/`scope` (`./`, so it works under the Pages subpath `/specdown/`),
  `display: standalone`, theme/background colors, and icons (the existing
  512×512 `favicon.png` + scalable `favicon.svg`, copied into
  `public/icons/`). Vite's `publicDir` copies these verbatim into `dist/`.
- **`markdown-viewer/public/sw.js`** — a deliberately conservative service worker:
  - **navigations are network-first**, falling back to the cached shell only when
    offline — so an online user never gets a stale app;
  - same-origin assets use **stale-while-revalidate** (build assets are
    content-hashed, so new deploys ship new URLs; old entries evict on
    `CACHE_NAME` bump);
  - **cross-origin is never intercepted/cached** — user-supplied markdown URLs,
    the GitHub API, and raw content always hit the network and are never
    persisted.
- **`markdown-viewer/src/features/pwa.js`** (`// @ts-check`) —
  `registerServiceWorker()` / `shouldRegisterServiceWorker()`, registered from
  `init()`. Guards: **not** Electron, **not** iOS-native, `serviceWorker` in
  `navigator`, and `http(s)` only (never `file://`/`specdown://`).
- **`index.html`** — `<link rel="manifest">`, `<meta name="theme-color">`, and an
  `apple-touch-icon` (all harmless/ignored in the native shells).

## Why no service-worker library

Hand-rolled rather than `vite-plugin-pwa`/Workbox to keep full control of the
multi-surface concern (web-only registration) and the cross-origin exclusion,
and to avoid a plugin injecting registration that could fire in the Electron/iOS
shells. The runtime strategy (network-first nav + SWR assets) needs no precache
manifest, so Vite's content-hashing isn't a problem.

## Verification

- `npm run build` ✓ — `manifest.webmanifest`, `sw.js`, and `icons/` land in
  `dist/`; the manifest/theme-color links survive into `dist/index.html`.
- `npm run lint` ✓, `npm run typecheck` ✓ (`pwa.js` passes the global `checkJs`),
  `npm test` → **356 passed** (+5: registration guards + manifest/asset checks).
- CSP is already satisfied (`default-src 'self'` covers the manifest fetch and
  the worker script).

## Manual checks for the user (web only)

After this deploys to Pages: open in Chrome → DevTools **Application** tab →
**Manifest** (installable, icons resolve) and **Service Workers** (activated);
the **Install** affordance appears in the address bar; toggling offline still
loads the shell. Lighthouse PWA audit is a good one-click check.

## Possible follow-ups (not in this PR)

- A maskable icon (needs a padded safe-zone PNG) for a nicer installed icon.
- An in-app "update available" toast when a new SW is waiting (the SW already
  honors a `SKIP_WAITING` message).
