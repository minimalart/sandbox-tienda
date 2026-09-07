import 'server-only';

import { cookies } from 'next/headers';
import {
  emptyRecommendationResponse,
  type RecommendationRequest,
  type RecommendationResponse,
} from '../modules/recommendations/types';

/**
 * Acceso al motor de recomendaciones desde componentes de SERVIDOR.
 *
 * Usa `import "server-only"` y NO `"use server"`. Dos razones:
 *
 *  1. Un archivo `"use server"` sólo puede exportar funciones async — un `export const`
 *     rompe el build de Vercel y `tsc` NO lo caza. Con `server-only` el archivo puede
 *     exportar lo que quiera y el error, si alguien lo importa desde el cliente, es de
 *     compilación y no de runtime.
 *  2. `"use server"` convierte cada export en un endpoint POST invocable. Un fetcher de
 *     recomendaciones no necesita —ni debería tener— esa superficie pública.
 *
 * Este archivo NO importa el SDK ni el resolver de región directamente: los recibe por
 * inyección desde el host vía `createGetRecommendations(deps)`. El motivo es que ambos
 * son host-coupled (tenant activo, config del app) y no viven en el shared package.
 * El host wire-a el factory una sola vez en su BFF y expone la función lista para usar.
 */

const SESSION_COOKIE = '_rec_sid';

/** Cliente mínimo que este helper necesita del SDK del host. */
export interface SdkClientLike {
  client: {
    fetch<T>(path: string, init: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      cache?: RequestCache;
    }): Promise<T>;
  };
}

export interface GetRecommendationsDeps {
  /** SDK del host, con la config del tenant activo. */
  sdk: SdkClientLike;
  /** Cookies del server side. */
  cookies: {
    getActiveSalesChannelId(): Promise<string | null>;
    getAuthHeaders(): Promise<Record<string, string>>;
    getCartId(): Promise<string | null>;
  };
  /**
   * Resolver de región del host (`getRegion(countryCode)`). No está en el shared
   * package porque su implementación tiene tenant coupling.
   */
  getRegion: (countryCode: string) => Promise<{ id?: string | null } | null>;
}

/**
 * Devuelve `getRecommendations` bindeada a las deps del host. Pensar en esto como una
 * "cierre de composición": el host lo llama UNA vez en su BFF y guarda la función.
 *
 * Devuelve una respuesta vacía bien formada ante CUALQUIER problema (motor caído,
 * extensión no instalada en el backend, timeout). Una recomendación es decoración: no
 * puede tumbar una ficha de producto ni convertirse en un error boundary.
 */
export const createGetRecommendations = (
  deps: GetRecommendationsDeps,
): ((request: RecommendationRequest) => Promise<RecommendationResponse>) => {
  return async (request) => {
    try {
      const [salesChannelId, authHeaders, cartId, cookieStore] = await Promise.all([
        deps.cookies.getActiveSalesChannelId(),
        deps.cookies.getAuthHeaders(),
        request.cart_id ? Promise.resolve(request.cart_id) : deps.cookies.getCartId(),
        cookies(),
      ]);

      const region = request.country_code ? await deps.getRegion(request.country_code) : null;

      return await deps.sdk.client.fetch<RecommendationResponse>('/store/recommendations', {
        method: 'POST',
        body: {
          placement: request.placement,
          ...(request.product_id ? { product_id: request.product_id } : {}),
          ...(cartId ? { cart_id: cartId } : {}),
          ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
          ...(region?.id ? { region_id: region.id } : {}),
          ...(cookieStore.get(SESSION_COOKIE)?.value
            ? { session_id: cookieStore.get(SESSION_COOKIE)?.value }
            : {}),
          ...(request.limit ? { limit: request.limit } : {}),
          ...(request.context ? { context: request.context } : {}),
        },
        headers: { ...authHeaders },
        // OBLIGATORIO. Todos los helpers de `lib/data` de este repo usan
        // `cache: "force-cache"`; copiar eso acá haría que muchos usuarios COMPARTAN un
        // `request_id` y corrompería toda la atribución sin ningún síntoma visible.
        // Tampoco se pasan `next.tags`, por lo mismo.
        cache: 'no-store',
      });
    } catch {
      return emptyRecommendationResponse(request.placement);
    }
  };
};
