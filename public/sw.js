const CACHE_NAME = "rippers-pwa-v7";
const OFFLINE_URL = "/offline";
const PRECACHE_ASSETS = ["/", OFFLINE_URL, "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  // Never intercept in local development — dev server compiles on demand and
  // can take many seconds on first hit, which looks like a timeout to the SW.
  const url = new URL(event.request.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname.endsWith(".local")) {
    return;
  }

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(
        () => caches.match(OFFLINE_URL) || caches.match("/")
      )
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
