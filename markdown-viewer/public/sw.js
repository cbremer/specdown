/* SpecDown service worker — offline support for the web (Pages) surface.
 *
 * Design goals (kept deliberately conservative to avoid the classic
 * "stale/broken cache" failure mode):
 *   - Navigations are NETWORK-FIRST, falling back to the cached shell only when
 *     offline — so an online user always gets fresh HTML, never a stale app.
 *   - Same-origin assets use stale-while-revalidate. Build assets are
 *     content-hashed, so a new deploy ships new URLs; old entries are evicted
 *     when CACHE_NAME is bumped.
 *   - CROSS-ORIGIN requests are never intercepted or cached. The viewer fetches
 *     user-supplied markdown URLs, the GitHub API, and raw content — those must
 *     always hit the network and must not be persisted.
 *
 * This SW is only ever registered on http/https (see features/pwa.js); the
 * Electron (file://) and iOS (specdown://) shells never use it.
 */

const CACHE_NAME = 'specdown-cache-v1';
const APP_SHELL = ['./', './index.html'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle our own origin; let user URLs / GitHub API / raw content pass
  // straight through to the network (never cached).
  if (url.origin !== self.location.origin) return;

  // Navigations: network-first, fall back to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Same-origin assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networked = fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || networked;
    })
  );
});

// Allow the page to trigger an immediate update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
