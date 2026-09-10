const CACHE_NAME = "hktube-shell-v4";
const OFFLINE_URL = "/offline.html";
const APP_SHELL = ["/offline.html", "/manifest.webmanifest", "/hktube-icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Never serve a stale HTML app shell. This prevents an older cached bundle
  // from keeping a broken/stale HkTube page alive after a new deployment.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(new Request(event.request, { cache: "no-store" }))
        .catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => undefined);
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
