/* CalorieSnap service worker: instant start-up and offline app shell.
 * - App files (/_expo/…, icons, fonts) are content-hashed → cache-first, kept forever.
 * - The page itself (index.html) → network-first, so a new deploy shows up on next open,
 *   falling back to the cached page when offline.
 * - API calls (Gemini, USDA, Open Food Facts) are never cached.
 * - Push: AURA reminders (sent by a free GitHub scheduler); tapping one opens the exact action.
 */
const CACHE = 'cs-shell-v2';
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
          // GitHub Pages answers deep links with status 404 + the app; only cache real 200 pages
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(SCOPE, copy));
          }
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

// ---------- AURA reminders ----------
self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { title: 'AURA', body: e.data ? e.data.text() : '' };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'AURA', {
      body: d.body || '',
      icon: SCOPE + 'icon-192.png',
      badge: SCOPE + 'icon-192.png',
      tag: d.tag || 'aura',
      data: { url: d.url ? SCOPE + d.url.replace(/^\//, '') : SCOPE },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || SCOPE;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(SCOPE) && 'focus' in c) return c.focus().then(() => (c.navigate ? c.navigate(url) : undefined));
      }
      return self.clients.openWindow(url);
    }),
  );
});
