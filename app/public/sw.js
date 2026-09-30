// Übernommen aus Workgrid public/sw.js, angepasst: eigener Cache-Name (fm-v…), Push- und
// notificationclick-Handler ergänzt (fehlten in Workgrid, KONZEPT 8.5).
// Flutlicht Service Worker.
// Ziel: PWA-Installierbarkeit (Chrome verlangt einen SW mit fetch-Handler) OHNE
// die früheren Sync-Probleme. Deshalb: API-Requests werden NIE gecacht
// (immer Netzwerk → keine veralteten Daten). Gehashte, unveränderliche Assets
// (/_next/static, /icons) cache-first; HTML-Navigationen network-first mit
// Cache nur als Offline-Fallback.

const CACHE = "fm-v2"; // hochzählen, wenn sich Dateien unter /icons ändern (cache-first)

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

// Push: Benachrichtigung anzeigen (Payload aus lib/push.ts: title, body, url, tag).
self.addEventListener("push", (e) => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(d.title ?? "Flutlicht", {
      body: d.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png", // Android zeigt Badges nur als Silhouette
      data: { url: d.url ?? "/team" },
      tag: d.tag,
    }),
  );
});

// Tippen auf die Benachrichtigung: offenes Fenster nutzen, sonst neu öffnen.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        const url = e.notification.data?.url ?? "/team";
        for (const c of list) {
          if ("focus" in c) {
            c.navigate(url);
            return c.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
