import { getActivePromotionIdsForChannel } from "@lib/data/active-promotion-ids";
import { getActiveSalesChannelId } from "@lib/data/cookies";
import { NextResponse } from "next/server";

/**
 * GET /api/store/active-promotions
 *
 * Devuelve un `string[]` de IDs de promociones activas para el canal de ventas.
 * Solo IDs — sin campos de admin (rules, campaign, status, etc.). Consumido por el
 * browser para enriquecer precios sin pasar por el proxy.
 *
 * ⚠ ESTA RUTA ERA UN LEAK CROSS-TENANT. Tenía tres capas de caché y ninguna
 * discriminaba por tienda:
 *
 *  1. `export const revalidate = 300` metía la respuesta en el **Full Route Cache de
 *     Next, keyeado SÓLO por URL**. Sin query param, `/api/store/active-promotions`
 *     guardaba UNA respuesta para todas las tiendas.
 *  2. `Cache-Control: public, s-maxage=300` hacía lo mismo en la CDN.
 *  3. El canal caía a `NEXT_PUBLIC_SALES_CHANNEL_ID`, o sea al canal del sitio
 *     PRINCIPAL, cuando no venía el query param.
 *
 * Resultado: el browser de un cliente navegando una tienda recibía las promociones
 * del sitio principal — precios y badges de otro catálogo.
 *
 * (El `unstable_cache` de `active-promotion-ids.ts` NO era parte del problema: keyea
 * por argumento, así que ahí la Data Cache siempre estuvo bien scopeada por canal.)
 *
 * Ahora: sin `revalidate`, el canal se resuelve del contexto de la request igual que
 * en `recommendations` / `tinting/bases` / `wishlist/products`, y el `Cache-Control`
 * depende de si la URL identifica al tenant o no — ver `cacheHeaders()`.
 */

/**
 * Cachear en una caché COMPARTIDA sólo es correcto cuando la URL identifica el
 * tenant. Si el canal salió del contexto de la request (header `x-demo-slug` /
 * cookie), dos tiendas comparten la misma URL: `s-maxage` ahí es exactamente el bug.
 */
const cacheHeaders = (keyedByUrl: boolean): Record<string, string> => ({
  "Cache-Control": keyedByUrl
    ? "public, s-maxage=300, stale-while-revalidate=600"
    : // `private` = sólo el browser puede guardarla, nunca la CDN.
      "private, max-age=60",
});

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  // El query param explícito es el camino preferido: es lo que hace la URL
  // auto-descriptiva y por lo tanto cacheable de forma compartida.
  const fromQuery = searchParams.get("salesChannelId") || undefined;
  const salesChannelId = fromQuery ?? (await getActiveSalesChannelId());
  const headers = cacheHeaders(Boolean(fromQuery));

  if (!salesChannelId) {
    // Sin canal: array vacío (sin promos = sin enriquecimiento).
    return NextResponse.json([], { headers });
  }

  try {
    const promoIds = await getActivePromotionIdsForChannel(salesChannelId);
    return NextResponse.json(Array.from(promoIds) as string[], { headers });
  } catch (error) {
    console.warn(
      "[ACTIVE-PROMOTIONS] Error fetching promotion IDs, returning empty list:",
      error,
    );
    // Degradación graceful: no romper el flujo de búsqueda si el backend falla.
    return NextResponse.json([], { headers });
  }
}
