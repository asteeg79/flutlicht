// MyWorkgrid Service Worker.
// Ziel: PWA-Installierbarkeit (Chrome verlangt einen SW mit fetch-Handler) OHNE
// die früheren Sync-Probleme. Deshalb: API-Requests werden NIE gecacht
// (immer Netzwerk → keine veralteten Daten). Gehashte, unveränderliche Assets
// (/_next/static, /icons) cache-first; HTML-Navigationen network-first mit
// Cache nur als Offline-Fallback.

const CACHE = "mwg-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
      } catch {
        /* ignore */
      }
      // Alte Cache-Versionen entfernen.
      try {
        const keys = await caches.keys();
        await Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        );
      } catch {
        /* ignore */
      }
    })(),
  );
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw new Error("offline");
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // nur eigene Origin
  if (url.pathname.startsWith("/api/")) return; // API niemals cachen

  // Unveränderliche, content-gehashte Assets: cache-first.
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // HTML-Navigationen: network-first, Cache als Offline-Fallback.
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req));
  }
});
