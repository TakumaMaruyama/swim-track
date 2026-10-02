const CACHE_NAME = "swimtime-static-v3";
const STATIC_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
  "/manifest.json",
];

const isCacheableAsset = (request) => {
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  return /\.(?:js|css|png|jpg|jpeg|svg|ico|webp|woff2?)$/i.test(url.pathname);
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName.startsWith("swimtime-static-") && cacheName !== CACHE_NAME)
          .map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // HTMLナビゲーションは常に最新を優先（古いindex.html固定化を防ぐ）
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => new Response(`<!doctype html>
      <html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
      <title>SwimTrack</title><body style="font:16px system-ui;text-align:center;padding:20vh 20px;color:#334155">
      <h1>SwimTrack</h1><p role="alert">接続できません。通信状況を確認して、もう一度開いてください。</p>
      <button onclick="location.reload()">再読み込み</button></body></html>`, {
        status: 503,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      })));
    return;
  }

  if (!isCacheableAsset(event.request)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.ok) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
