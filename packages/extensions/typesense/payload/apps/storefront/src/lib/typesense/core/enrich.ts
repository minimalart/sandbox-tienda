// Enriquecimiento de precios por promoción.
// Los IDs de promociones activas llegan como parámetro — esta función NUNCA
// hace fetch internamente. Pura dado el Set<string>.

import type { TypesenseProductDocument, TypesenseProductsParams } from "../types";

// Parámetros relevantes para el enriquecimiento (subconjunto de TypesenseProductsParams).
type EnrichParams = Pick<TypesenseProductsParams, "promotion" | "salesChannelId">;

/**
 * Filtra y ajusta el pricing de promociones en los productos crudos de Typesense.
 *
 * - Si `activePromoIds` es null, no hay filtro de promociones — se devuelven
 *   los productos tal cual (comportamiento equivalente a cuando no hay canal
 *   configurado o no hay productos con promociones).
 * - Si `activePromoIds` es un Set, se filtran las promociones de cada producto
 *   a solo las que están activas para el canal. Los productos sin ninguna promo
 *   activa que estaban bajo un filtro de campaña (`params.promotion`) se eliminan
 *   del resultado (devuelve null → filtrado por el caller).
 *
 * Devuelve `{ products, promotionFilteredCount }` para que el caller pueda
 * reconstruir el `found` exactamente como lo hace el código original (L687-690):
 *   found = params.promotion && activePromoIds ? products.length : filteredResponse.found
 */
export function applyPromotionPricing(
  rawProducts: TypesenseProductDocument[],
  params: EnrichParams,
  activePromoIds: Set<string> | null,
): { products: TypesenseProductDocument[]; promotionFilteredCount: number } {
  if (!activePromoIds) {
    return { products: rawProducts, promotionFilteredCount: rawProducts.length };
  }

  const mapped = rawProducts
    .map((p) => {
      if (!p.promotions?.length) return p;
      const filtered = p.promotions.filter((promo) =>
        activePromoIds.has(promo.id),
      );
      if (filtered.length === p.promotions.length) return p;
      // Si no queda ninguna promo activa para este canal, limpiar también los
      // campos de precio con descuento para que ni el label ni el tachado rendericen.
      if (filtered.length === 0) {
        if (params.promotion) {
          // El producto no tiene promo activa bajo el filtro de campaña → excluir.
          return null;
        }
        return {
          ...p,
          promotions: filtered,
          discount: 0,
          subtotal: p.price,
          variants: (p.variants ?? []).map((v) => ({
            ...v,
            calculated_price: v.calculated_price
              ? {
                  ...v.calculated_price,
                  original_amount: v.calculated_price.calculated_amount,
                }
              : v.calculated_price,
          })),
        };
      }
      return { ...p, promotions: filtered };
    })
    .filter((p): p is TypesenseProductDocument => Boolean(p));

  return { products: mapped, promotionFilteredCount: mapped.length };
}
