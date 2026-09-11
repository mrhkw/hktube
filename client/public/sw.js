const CACHE_NAME = "hktube-shell-v7";
const OFFLINE_URL = "/offline.html";
const APP_SHELL = ["/", OFFLINE_URL, "/manifest.webmanifest", "/hktube-icon.svg"];
const STATIC_ASSET = /\.(?:js|css|woff2?|png|jpe?g|webp|svg|ico)$/i;

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

async function fetchFast(request, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function cacheResponse(request, response) {
  if (!response?.ok || response.type !== "basic") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {
    // Caching is an optimization; never block navigation on it.
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request) || await cache.match("/");
      try {
        const response = await fetchFast(new Request(event.request, { cache: "no-store" }), 5000);
        void cacheResponse(event.request, response);
        return response;
      } catch {
        return cached || await cache.match(OFFLINE_URL);
      }
    })());
    return;
  }

  if (event.request.destination === "script" || event.request.destination === "style" || STATIC_ASSET.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(event.request);
      if (cached) {
        event.waitUntil(fetchFast(event.request, 5000).then(response => cacheResponse(event.request, response)).catch(() => undefined));
        return cached;
      }
      try {
        const response = await fetchFast(event.request, 5000);
        void cacheResponse(event.request, response);
        return response;
      } catch {
        return new Response("", { status: 503 });
      }
    })());
    return;
  }

  event.respondWith(
    fetchFast(event.request, 5000)
      .then(response => { void cacheResponse(event.request, response); return response; })
      .catch(() => caches.match(event.request))
  );
});
