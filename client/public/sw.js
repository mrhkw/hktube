const CACHE_NAME = "hktube-shell-v14-clips-reference-v2-2026-09-28";
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
  event.waitUntil((async () => {
    try { await self.registration.navigationPreload.enable(); } catch {}
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("hktube-shell-") && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function fetchNetworkFirst(request, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(new Request(request, { cache: "no-store", signal: controller.signal }));
  } finally {
    clearTimeout(timer);
  }
}

async function cacheResponse(request, response) {
  if (!response?.ok || response.type !== "basic") return;
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  } catch {}
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  event.respondWith((async () => {
    const isNavigation = event.request.mode === "navigate";
    const isStaticAsset = STATIC_ASSET.test(url.pathname);

    if (isNavigation) {
      try {
        const preloaded = await event.preloadResponse;
        if (preloaded) return preloaded;
        return await fetchNetworkFirst(event.request);
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
      const response = await fetchNetworkFirst(event.request);
      event.waitUntil(cacheResponse(event.request, response));
      return response;
    } catch {
      const cache = await caches.open(CACHE_NAME);
      return await cache.match(event.request) || new Response("", { status: 503 });
    }
  })());
});