// Kasba offline support: pages come from the network first and fall back to
// the last copy read on this phone, or to the offline page.
const CACHE = 'kasba-v2';
const OFFLINE = '/offline';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, '/favicon.ico'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then(async (c) => {
            await c.put(req, copy);
            // Keep only the last 40 pages so cheap phones do not fill up.
            const keys = await c.keys();
            for (const k of keys.slice(0, Math.max(0, keys.length - 40))) if (!k.url.endsWith(OFFLINE)) await c.delete(k);
          });
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match(OFFLINE)))
    );
  }
});
