// Service Worker — offline shell อย่างง่าย (ไม่ cache API/transcription)
const CACHE = "ut-static-v3";
const SHELL = ["/", "/guide", "/privacy", "/download", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const url = new URL(ev.request.url);
  // ไม่แตะ API และคำขอ cross-origin
  if (url.pathname.startsWith("/api/") || url.origin !== self.location.origin) return;
  if (ev.request.method !== "GET") return;

  ev.respondWith(
    caches.match(ev.request).then(
      (hit) =>
        hit ||
        fetch(ev.request).then((resp) => {
          if (resp.ok && url.pathname === "/") {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(ev.request, copy));
          }
          return resp;
        })
    )
  );
});
