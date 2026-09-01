/* Service Worker for Sentinel PWA */
const CACHE_NAME = 'sentinel-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', '/index.html', '/manifest.json']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/') || event.request.method !== 'GET') {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        if (res.ok && (event.request.url.startsWith('http') && event.request.url.includes(self.location.origin))) {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return res;
      }).catch(() => caches.match('/index.html').then((r) => r || new Response('Offline', { status: 503 })));
    })
  );
});
