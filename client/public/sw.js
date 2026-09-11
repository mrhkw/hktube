const CACHE_NAME = "hktube-shell-v10";
const OFFLINE_URL = "/offline.html";
const APP_SHELL = [OFFLINE_URL, "/manifest.webmanifest", "/hktube-icon.svg"];
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
      .then(keys => Promise.all(
        keys
          .filter(key => key.startsWith("hktube-shell-") && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

async function fetchFast(request, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal, cache: "no-store" });
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
    // Caching is an optimization; never block a successful response on it.
  }
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith((async () => {
    const isNavigation = event.request.mode === "navigate";
    const isStaticAsset = STATIC_ASSET.test(url.pathname);

    // Navigation is always network-first. Never serve an old cached HTML shell.
    if (isNavigation) {
      try {
        const response = await fetchFast(new Request(event.request, { cache: "no-store" }));
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        return await cache.match(OFFLINE_URL) || new Response(
          "HkTube is temporarily offline. Please try again.",
          { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
        );
      }
    }

    if (!isStaticAsset) return fetch(event.request);

    try {
      const response = await fetchFast(event.request);
      event.waitUntil(cacheResponse(event.request, response));
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(event.request) || new Response("", { status: 503 });
    }
  })());
});
