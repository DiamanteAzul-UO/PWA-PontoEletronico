// =============================================
// SERVICE WORKER - PONTO ELETRÔNICO
// Cache de recursos + suporte offline
// =============================================

const CACHE_NAME = "ponto-eletronico-v2";
const PRECACHE = ["/", "/manifest.json", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.map((name) => (name !== CACHE_NAME ? caches.delete(name) : undefined))))
      .then(() => self.clients.claim())
      .then(() => self.skipWaiting())
  );
});

// Fetch
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // API: Network only, com resposta 503 offline (app trata via IndexedDB)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(JSON.stringify({ erro: "Sem conexão", offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
      )
    );
    return;
  }

  // Estáticos e navegação: Network first, fallback para cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const home = await caches.match("/");
          if (home) return home;
        }
        return Response.error();
      })
  );
});

// Background Sync - avisar o app para sincronizar registros pendentes
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-registros") {
    event.waitUntil(
      self.clients.matchAll().then((clients) =>
        clients.forEach((client) => client.postMessage({ tipo: "SYNC_REGISTROS" }))
      )
    );
  }
});

// Push (futuro)
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title || "Ponto Eletrônico", {
      body: data.body || "Lembre-se de bater o ponto!",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      vibrate: [200, 100, 200],
    })
  );
});
