// My Trips — Service Worker
// Cache app shell (cache-first). Trip itinerary data uses network-first with cache fallback.
// Use only relative URLs so the site keeps working on GitHub Pages under a subpath.

'use strict';

const CACHE_NAME = 'my-travel-log-v1';

// App shell: files needed for the site to boot offline.
// All paths are relative to the service worker's scope.
// Trip data files are listed explicitly here (in addition to the index) so
// every known trip is available offline right after install, not only after
// the user has opened it once. Add new trips to this list when they're added
// to data/trips/index.json.
const APP_SHELL = [
  './',
  './index.html',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/storage.js',
  './manifest.webmanifest',
  './data/trips/index.json',
  './data/trips/korea-2026.json',
  './data/trips/china-2025.json',
];

self.addEventListener('install', (event) => {
  // Do not call skipWaiting() here: let the new worker stay in 'waiting' state
  // so the app can show an "update available" banner and let the user decide
  // when to activate it (see the 'message' listener below).
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle same-origin GETs; ignore Google Maps and other external links.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Trip data files: network-first with cache fallback.
  if (url.pathname.includes('/data/trips/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // App shell and other same-origin assets: cache-first with network fallback.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // Navigation fallback: serve cached index.html so hash routes work offline.
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return Response.error();
        });
    }),
  );
});
