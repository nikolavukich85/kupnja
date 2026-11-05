// Rad bez interneta: sprema aplikaciju i zadnje cijene. Popis je u Firestoreu (ima vlastitu offline pohranu).
const CACHE = "kupnja-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./manifest.webmanifest", "./icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const networkFirst = (req, key) =>
  fetch(req)
    .then((r) => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(key ?? req, copy));
      }
      return r;
    })
    .catch(() => caches.match(key ?? req));

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return; // Google/Firebase idu izravno
  if (e.request.mode === "navigate") return e.respondWith(networkFirst(e.request, "./index.html"));
  if (url.pathname.endsWith("/data/prices.json")) return e.respondWith(networkFirst(e.request, "./data/prices.json"));
  e.respondWith(
    caches.match(e.request).then(
      (hit) =>
        hit ||
        fetch(e.request).then((r) => {
          if (r.ok) {
            const copy = r.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return r;
        })
    )
  );
});
