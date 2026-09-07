import { Modules } from '@medusajs/framework/utils';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { loadProductCards, resolvePriceRegion, type ProductCard } from '../helpers';

import { productIdsForSite } from '../../../../lib/multistore/product-scope';

/**
 * GET /admin/recommendations/products — buscador de productos del selector de
 * relaciones (PRD §16.2).
 *
 * La búsqueda va por el servicio del módulo Product y no por `query.graph`: `q` es
 * un filtro de texto libre que implementa el módulo (título, descripción, handle,
 * SKU de variante) y pasarlo por el graph no es un contrato estable. El enriquecido
 * con precio y stock sí va por el graph, en una segunda pasada acotada a los ids del
 * resultado.
 *
 * También acepta `ids` para rehidratar las cards de una selección ya guardada sin
 * volver a buscar.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.validatedQuery as {
    q?: string;
    ids?: string | string[];
    region_id?: string;
    limit?: number;
    offset?: number;
  };

  const limit = query.limit ?? 20;
  const offset = query.offset ?? 0;
  const price = await resolvePriceRegion(req, query.region_id);

  // Camino "rehidratar selección": ids explícitos, sin búsqueda.
  const explicitIds = Array.isArray(query.ids)
    ? query.ids
    : typeof query.ids === 'string'
      ? query.ids.split(',').map((id) => id.trim()).filter(Boolean)
      : [];

  if (explicitIds.length) {
    // También acá: rehidratar una selección guardada no puede traer de vuelta un
    // producto que ya no es de esta tienda.
    const allowed = await productIdsForSite(req);
    const scopedIds = allowed ? explicitIds.filter((id) => allowed.includes(id)) : explicitIds;
    const cards = await loadProductCards(req, scopedIds.slice(0, 100), price);
    // Se respeta el orden pedido: es el orden en que el merchant los ordenó.
    const products = scopedIds
      .map((id) => cards.get(id))
      .filter((card): card is ProductCard => Boolean(card));
    res.status(200).json({ products, count: products.length, offset: 0, limit: products.length });
    return;
  }

  /**
   * El selector sólo puede ofrecer productos que la tienda vende: elegir uno de otra
   * arma una relación que el storefront nunca va a poder mostrar, y el operador la ve
   * configurada y "sin efecto" sin entender por qué.
   */
  const siteProductIds = await productIdsForSite(req);
  if (siteProductIds?.length === 0) {
    res.status(200).json({ products: [], count: 0, offset, limit });
    return;
  }

  const productModule = req.scope.resolve(Modules.PRODUCT);
  const [rows, count] = await productModule.listAndCountProducts(
    {
      ...(query.q ? { q: query.q } : {}),
      ...(siteProductIds ? { id: siteProductIds } : {}),
    },
    { select: ['id'], take: limit, skip: offset, order: { title: 'ASC' } },
  );

  const ids = (rows as Array<{ id: string }>).map((row) => row.id);
  const cards = await loadProductCards(req, ids, price);
  const products = ids
    .map((id) => cards.get(id))
    .filter((card): card is ProductCard => Boolean(card));

  res.status(200).json({ products, count, offset, limit });
}
