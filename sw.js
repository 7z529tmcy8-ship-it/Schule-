/* Service Worker von Chronothek – macht die App offline nutzbar.
   Nach Änderungen am Code CACHE_VERSION hochzählen. */
const CACHE_VERSION = 'chronothek-v9';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

// Alte Caches löschen (auch die des früheren Spiels)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => cached || fetch(req).catch(() => {
      if (req.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    }))
  );
});
