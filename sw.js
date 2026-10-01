/* =====================================================================
   Service Worker – macht die App offline nutzbar.
   Beim ersten Öffnen werden alle Dateien zwischengespeichert. Danach
   startet die App auch ohne Internet.

   WICHTIG nach Änderungen am Code: CACHE_VERSION hochzählen, sonst
   bekommt das iPad weiter die alte Version aus dem Zwischenspeicher.
   ===================================================================== */
const CACHE_VERSION = 'handschrift-v1';

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './vendor/jspdf.umd.min.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
];

// Installation: alle Dateien in den Cache legen
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Aktivierung: alte Cache-Versionen löschen
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Anfragen: zuerst aus dem Cache, sonst aus dem Netz
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      if (cached) return cached;
      return fetch(req).catch(() => {
        // Offline und nicht im Cache: bei Seitenaufrufen die App selbst liefern
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
