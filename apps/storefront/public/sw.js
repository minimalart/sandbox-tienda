/**
 * Service Worker — Mercatto Repartidores
 *
 * Scope: /driver/ (registrado solo desde el layout del driver)
 * Estrategia:
 *   - App shell (layout, login): cache-first con revalidación background
 *   - Datos API (/store/delivery/*): network-first con fallback a cache
 *   - Assets estáticos (_next/static): cache-first inmutable
 *
 * NO cachea rutas del storefront principal (fuera de /driver).
 */

const SHELL_CACHE = "driver-shell-v1";
const DATA_CACHE = "driver-data-v1";
const STATIC_CACHE = "driver-static-v1";

const SHELL_URLS = ["/driver", "/driver/login"];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const valid = new Set([SHELL_CACHE, DATA_CACHE, STATIC_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !valid.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// ── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar mismo origen y rutas del driver
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/driver") && !url.pathname.startsWith("/api/driver")) return;

  // Assets estáticos (_next/static): cache-first inmutable
  if (url.pathname.startsWith("/_next/static")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // API calls de delivery: network-first
  if (url.pathname.includes("/store/delivery") || url.pathname.includes("/auth/user")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // Pages del driver: stale-while-revalidate
  if (url.pathname.startsWith("/driver")) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }
});

// ── Estrategias ──────────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached ?? new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });
  return cached ?? fetchPromise;
}
