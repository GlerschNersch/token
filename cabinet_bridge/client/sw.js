// HomeArcade service worker — shell caching for offline/installable PWA
// Cache name includes the version so every addon update busts the old cache.
const CACHE = "home-arcade-v0.3.8";
const SHELL = [
  "./",
  "./index.html",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  // Delete every cache that isn't the current version
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Only handle same-origin GET requests; pass API calls straight through
  if (event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Always revalidate the shell (network-first for HTML)
      if (url.pathname === "/" || url.pathname.endsWith("/index.html")) {
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached || caches.match("./index.html"));
      }
      // Static assets: cache-first
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && url.pathname.startsWith("/assets/")) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match("./index.html"));
    })
  );
});
