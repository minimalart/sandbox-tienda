// Módulo browser — sin server-only ni barrel index.ts.
// Importa directamente desde ./search-core y ./types para mantener el
// grafo de dependencias libre de cualquier import de server-only.

import { searchTypesenseProductsCore } from "./search-core";
import { getActivePromoIdsClient } from "./active-promotions-client";
import type {
  TypesenseProductDocument,
  TypesenseProductsParams,
  TypesenseProductsResponse,
} from "./types";

/**
 * Búsqueda PLP desde el browser.
 *
 * Fetcha los IDs de promos activas (cacheadas, una vez por sesión/canal)
 * y delega al core puro. La respuesta es idéntica a la del server wrapper —
 * el mismo core garantiza paridad.
 */
export async function searchProductsFromBrowser(
  params: TypesenseProductsParams,
): Promise<TypesenseProductsResponse> {
  const activePromoIds = await getActivePromoIdsClient(params.salesChannelId);
  return searchTypesenseProductsCore(params, activePromoIds);
}

/**
 * Autocomplete desde el browser.
 *
 * NO fetcha promo IDs — el autocomplete solo necesita títulos, no precios.
 * Se pasa `activePromoIds = null` para evitar cualquier acoplamiento con
 * el endpoint de promos en el path más caliente (por tecla + debounce).
 */
export async function autocompleteFromBrowser(
  q: string,
  limit = 10,
): Promise<TypesenseProductDocument[]> {
  const result = await searchTypesenseProductsCore(
    { q, limit, sortBy: "relevance" },
    null,
  );
  return result.products;
}

/**
 * Beacon de analytics en el browser — se dispara UNA vez por búsqueda
 * committed (no por página de infinite scroll, no por keystroke).
 *
 * Usa `navigator.sendBeacon` cuando está disponible; fallback a fetch
 * con `keepalive: true`. Errores silenciados — analytics es best-effort.
 *
 * ── POR QUÉ VA AL PROXY Y NO AL BACKEND ──────────────────────────────────
 *
 * SAME-ORIGIN, a la route handler que reenvía desde el server. Antes pegaba
 * directo a `NEXT_PUBLIC_MEDUSA_BACKEND_URL` y cada búsqueda en producción
 * tiraba dos errores en consola —CORS bloqueado + `net::ERR_FAILED`— contra el
 * host del backend (DESDEELSUR-61, BUG-12). El analytics nunca registró nada.
 *
 * El diagnóstico obvio era "la env apunta al backend equivocado", y cambiarla
 * NO alcanza: aunque apunte al host correcto, el beacon es cross-origin igual y
 * depende de que el `STORE_CORS` del backend liste el dominio del storefront —
 * que es config de otro sistema, se desincroniza en cada dominio nuevo y falla
 * en silencio. Peor: `sendBeacon` NO admite headers custom, así que el camino
 * principal jamás pudo mandar `x-publishable-api-key`.
 *
 * Contra el proxy los dos problemas desaparecen de raíz: mismo origen (no hay
 * preflight ni CORS que configurar) y la llamada al backend la hace el server,
 * que sí puede poner las headers que haga falta. Vale para cualquier dominio sin
 * tocar ninguna env.
 */
const ANALYTICS_ENDPOINT = "/api/store/typesense/analytics";

export function trackSearchClient(query: string, hasResults: boolean): void {
  if (!query || query === "*") return;

  const body = JSON.stringify({ query, hasResults });

  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      // sendBeacon no soporta headers custom — usar Blob con tipo JSON.
      // Ya no hace falta ninguna: el proxy es same-origin.
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(ANALYTICS_ENDPOINT, blob);
      if (!sent) {
        // El UA rechazó el beacon (cola llena) — fallback silencioso
        _trackWithFetch(ANALYTICS_ENDPOINT, body);
      }
      return;
    }
    _trackWithFetch(ANALYTICS_ENDPOINT, body);
  } catch {
    // Analytics best-effort — nunca romper el flujo de búsqueda
  }
}

function _trackWithFetch(url: string, body: string): void {
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {
    // Silenciado intencionalmente
  });
}
