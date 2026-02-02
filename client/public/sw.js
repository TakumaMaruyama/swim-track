const CACHE_NAME = 'swimtime-v2';
const STATIC_ASSETS = [
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }
  
  if (STATIC_ASSETS.some(asset => url.pathname === asset)) {
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
    return;
  }
  
  event.respondWith(fetch(event.request));
});
