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
 */
export function trackSearchClient(query: string, hasResults: boolean): void {
  if (!query || query === "*") return;

  const backendUrl =
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
  const publishableApiKey =
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

  const url = `${backendUrl}/store/typesense/analytics`;
  const body = JSON.stringify({ query, hasResults });

  try {
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      // sendBeacon no soporta headers custom — usar Blob con tipo JSON
      const blob = new Blob([body], { type: "application/json" });
      // Nota: sendBeacon no permite x-publishable-api-key; el backend debe
      // aceptar requests sin esa header desde el browser como best-effort.
      const sent = navigator.sendBeacon(url, blob);
      if (!sent) {
        // El UA rechazó el beacon (cola llena) — fallback silencioso
        _trackWithFetch(url, body, publishableApiKey);
      }
      return;
    }
    _trackWithFetch(url, body, publishableApiKey);
  } catch {
    // Analytics best-effort — nunca romper el flujo de búsqueda
  }
}

function _trackWithFetch(
  url: string,
  body: string,
  publishableApiKey: string,
): void {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (publishableApiKey) {
    headers["x-publishable-api-key"] = publishableApiKey;
  }
  fetch(url, { method: "POST", headers, body, keepalive: true }).catch(
    () => {
      // Silenciado intencionalmente
    },
  );
}
