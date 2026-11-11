/* CalorieSnap service worker: instant start-up and offline app shell.
 * - App files (/_expo/…, icons, fonts) are content-hashed → cache-first, kept forever.
 * - The page itself (index.html) → network-first, so a new deploy shows up on next open,
 *   falling back to the cached page when offline.
 * - API calls (Gemini, USDA, Open Food Facts) are never cached.
 */
const CACHE = 'cs-shell-v1';
const SCOPE = self.registration.scope; // e.g. https://user.github.io/calorie-snap/

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([SCOPE, SCOPE + 'manifest.webmanifest', SCOPE + 'apple-touch-icon.png'])).catch(() => undefined));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.href.startsWith(SCOPE)) return; // other origins (APIs) go straight to network

  const isPage = req.mode === 'navigate';
  if (isPage) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SCOPE, copy));
          return res;
        })
        .catch(() => caches.match(SCOPE).then((r) => r || Response.error())),
    );
    return;
  }
  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && (url.pathname.includes('/_expo/') || url.pathname.includes('/assets/') || /\.(png|ico|ttf|woff2?)$/.test(url.pathname))) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
