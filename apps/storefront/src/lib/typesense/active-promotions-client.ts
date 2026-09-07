// Módulo browser — sin server-only ni dependencias de admin.
// Cachea la promesa de IDs de promo por canal para que infinite scroll
// reutilice el mismo resultado sin disparar requests adicionales.

const PROMO_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos — igual que el endpoint

type PromoCacheEntry = {
  promise: Promise<Set<string>>;
  expiresAt: number;
};

// Memo por salesChannelId. Almacena la PROMESA (no el resultado) para que
// llamadas concurrentes se dedupliquen automáticamente sin carrera.
const _promoCacheByChannel = new Map<string, PromoCacheEntry>();

/**
 * Obtiene los IDs de promociones activas para el canal indicado.
 *
 * - Primera llamada: hace fetch a `/api/store/active-promotions` y cachea
 *   la promesa por ~5 min.
 * - Llamadas subsiguientes dentro del TTL: devuelven la promesa cacheada
 *   (el browser/CDN ya la tiene; 0 requests adicionales).
 * - On error: devuelve `Set` vacío — nunca lanza en el path de búsqueda.
 */
export function getActivePromoIdsClient(
  salesChannelId?: string,
): Promise<Set<string>> {
  const channelKey = salesChannelId ?? "__default__";
  const now = Date.now();
  const cached = _promoCacheByChannel.get(channelKey);

  if (cached && now < cached.expiresAt) {
    return cached.promise;
  }

  const url = salesChannelId
    ? `/api/store/active-promotions?salesChannelId=${encodeURIComponent(salesChannelId)}`
    : "/api/store/active-promotions";

  const promise: Promise<Set<string>> = fetch(url)
    .then(async (res) => {
      if (!res.ok) {
        console.warn(
          `[ACTIVE-PROMOTIONS-CLIENT] Respuesta ${res.status} — usando set vacío`,
        );
        return new Set<string>();
      }
      const ids = (await res.json()) as unknown;
      if (!Array.isArray(ids)) {
        return new Set<string>();
      }
      return new Set<string>(ids as string[]);
    })
    .catch((err) => {
      console.warn(
        "[ACTIVE-PROMOTIONS-CLIENT] Error al obtener IDs de promo, degradando:",
        err,
      );
      return new Set<string>();
    });

  _promoCacheByChannel.set(channelKey, {
    promise,
    expiresAt: now + PROMO_CACHE_TTL_MS,
  });

  return promise;
}
