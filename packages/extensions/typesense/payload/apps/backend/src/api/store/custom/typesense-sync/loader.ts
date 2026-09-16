import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import {
  attachCategoryFullPaths,
  type CategoryPathMap,
} from '../../../../modules/typesense/category-paths';
import {
  attachActivePromotions,
  attachChannelPrices,
  getCachedCategoryPathMap,
  getCachedChannelPriceMap,
  PRODUCT_SYNC_FIELDS,
  resolveSyncCurrency,
} from '../../../../modules/typesense/reindex';

export type LoadSyncProductsResult =
  | { ok: true; products: Record<string, unknown>[] }
  | { ok: false; status: number; message: string };

export type StreamSyncProductsResult =
  | { ok: true; total: number }
  | { ok: false; status: number; message: string };

/**
 * Stream products with full relational data into Typesense, ONE PAGE AT A TIME.
 *
 * Memory: the catalog (with very deep relations) and the mapped docs array used
 * to OOM the 2GB box because the whole thing was accumulated in memory before
 * indexing. This variant fetches a page, hands it to `onPage`, and DROPS it
 * before fetching the next page — the resident set never holds more than one
 * page of products. The active-promotions map is resolved ONCE up front and
 * applied per page, so correctness (has_promotion/discount) is preserved.
 *
 * `loadSyncProducts` (below) is the materializing variant kept for the store
 * route that returns the full catalog as JSON.
 *
 * B2C-only version: no brand/gender/age_group/factory modules.
 */
export async function streamSyncProducts(
  scope: { resolve: <T = unknown>(key: string) => T },
  onPage: (products: Record<string, unknown>[]) => Promise<void> | void,
): Promise<StreamSyncProductsResult> {
  const query = scope.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);

  // Moneda de precios: `resolveSyncCurrency` (módulo) resuelve la default de la
  // store con fallback a región. Estaba duplicado acá y en `reindex.ts`, y las dos
  // copias ya no coincidían: el cron y los subscribers usaban
  // `DEFAULT_CURRENCY_CODE` a secas, así que en una store no-ARS indexaban con
  // `calculated_price` sin resolver (precio 0 → el storefront los filtra).
  const currency_code = await resolveSyncCurrency(query);

  const { data: regions } = (await query.graph({
    entity: 'region',
    fields: ['currency_code', 'id'],
  })) as { data: { id: string; currency_code?: string | null }[] };
  if (regions.length === 0) {
    return { ok: false, status: 400, message: 'No regions available for Typesense sync.' };
  }

  // Rutas canónicas de categoría y promociones activas: ambas del módulo, para
  // que TODOS los caminos de indexación produzcan el mismo documento. Las dos
  // vienen de un caché con TTL corto, así que una ráfaga de páginas no las
  // reconstruye por página.
  let categoryPathMap: CategoryPathMap = new Map();
  try {
    categoryPathMap = await getCachedCategoryPathMap(query);
    console.warn(`[typesense-sync] Category path map built: ${categoryPathMap.size} entries`);
  } catch (err) {
    console.warn('[typesense-sync] Could not build category path map:', (err as Error).message);
  }

  // Precios channel-scoped: se arma UNA sola vez fuera del loop y se aplica por
  // página. Sin esto, el sync sirve `calculated_price` base para todo el
  // catálogo (Medusa no propaga `sales_channel_id` al pricing context) y el
  // HOME del site channel-scoped queda con precios equivocados. Ver
  // `buildChannelPriceMap` en reindex.ts para el detalle del algoritmo.
  const channelPriceMap = await getCachedChannelPriceMap(query, currency_code);
  console.warn(
    `[typesense-sync] Channel price map built: ${channelPriceMap.size} variant(s) with overrides`,
  );

  /**
   * Enriquece una página: ruta completa de categoría + promociones activas (con
   * el descuento ya calculado) + overrides channel-scoped por variant. Se
   * aplica por página y se descarta, para no sostener el catálogo entero en
   * memoria (eso reventaba la caja de 2GB).
   */
  const enrichPage = async (
    page: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> => {
    const enriched = page.map((product) => attachCategoryFullPaths(product, categoryPathMap));
    await attachActivePromotions(query, enriched);
    attachChannelPrices(enriched, channelPriceMap);
    return enriched;
  };

  // Fetch products in PAGES. Medusa's calculated_price resolution silently
  // returns null for variants beyond a few thousand rows when the whole catalog
  // is requested in one query.graph call — which left freshly-imported demo
  // catalogs (the tail) indexed with price 0 and filtered out by the storefront.
  // Paginating keeps each batch small enough that every variant gets its price
  // (same approach as the proven CLI sync, scripts/typesense-sync.ts).
  //
  // Memory: each page is enriched, handed to `onPage`, and then dropped — we
  // never accumulate the whole catalog (it OOM'd the 2GB box).
  const PAGE = 200;
  let total = 0;

  for (let offset = 0; ; offset += PAGE) {
    const { data: page } = (await query.graph({
      // `PRODUCT_SYNC_FIELDS` (módulo) es la lista canónica: incluye inventario
      // (para `stock_available`) y los precios crudos como fallback cuando
      // `calculated_price` no resuelve. Estaba copiada acá y divergía del core.
      entity: 'product',
      fields: PRODUCT_SYNC_FIELDS as unknown as string[],
      filters: { status: { $ne: 'draft' } },
      pagination: { skip: offset, take: PAGE },
      context: {
        variants: {
          calculated_price: QueryContext({ currency_code }),
        },
      },
    })) as { data: Record<string, unknown>[] };

    if (page.length === 0) break;

    await onPage(await enrichPage(page));
    total += page.length;

    if (page.length < PAGE) break;
  }

  console.warn(`[typesense-sync] Streamed ${total} products`);
  return { ok: true, total };
}

/**
 * Load products with full relational data ready to upsert into Typesense.
 *
 * Materializing variant: returns the whole enriched catalog as one array. Kept
 * for the store route (GET /store/custom/typesense-sync) which serializes the
 * full result to JSON. The memory-heavy indexing callers (admin sync route and
 * the demo-store resync) use `streamSyncProducts` instead so they never hold the
 * whole catalog in memory.
 */
export async function loadSyncProducts(scope: {
  resolve: <T = unknown>(key: string) => T;
}): Promise<LoadSyncProductsResult> {
  const enrichedProducts: Record<string, unknown>[] = [];
  const result = await streamSyncProducts(scope, (page) => {
    for (const product of page) enrichedProducts.push(product);
  });
  if (!result.ok) return result;
  return { ok: true, products: enrichedProducts };
}
