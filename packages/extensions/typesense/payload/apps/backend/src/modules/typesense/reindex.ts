/**
 * Núcleo compartido de indexación de productos en Typesense.
 *
 * Tanto el full-sync (scripts/typesense-sync.ts) como los subscribers
 * incrementales (product.*, product-variant.*) y el job de reconciliación
 * pasan por acá, de modo que TODOS produzcan un documento idéntico. Antes el
 * incremental traía menos campos que el full-sync y degradaba el índice:
 *   - sin `variants.inventory_items…` → `stock_available` caía a 0 en cada edit
 *   - sin promociones → borraba `has_promotion/promotions/discount/subtotal`
 * Centralizar los campos + la lógica de promociones acá evita esa divergencia.
 */
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { Logger, MedusaContainer } from '@medusajs/framework/types';
import { QueryContext } from '@medusajs/utils';
import { ProductMapper } from './product-mapper';
import { loadAdvisorRules } from './advisor';
import {
  attachCategoryFullPaths,
  buildCategoryPathMap,
  type CategoryPathMap,
} from './category-paths';
import TypeSenseService from './service';

type AnyRecord = Record<string, unknown>;
type QueryGraph = { graph: (input: unknown) => Promise<{ data: unknown[] }> };

/**
 * Campos que se piden a `query.graph` para armar un documento completo.
 * DEBE incluir todo lo que lee ProductMapper: inventario (para `stock_available`)
 * y precios crudos (fallback de `calculated_price`). No modificar sin actualizar
 * el mapper.
 */
export const PRODUCT_SYNC_FIELDS = [
  '*',
  'variants.*',
  'variants.calculated_price.*',
  'variants.prices.*',
  'variants.inventory_items.*',
  'variants.inventory_items.inventory.*',
  'variants.inventory_items.inventory.location_levels.*',
  'options.*',
  'options.values.*',
  'images.*',
  'categories.*',
  'categories.parent_category.*',
  // Explícito aunque `categories.*` ya lo cubra: de acá saca el asesor guiado el
  // código del ERP (`zeus:0209`) para derivar superficie/ambiente/uso especial.
  // Dejarlo escrito evita que un futuro recorte de `categories.*` lo apague en
  // silencio (el síntoma seria un índice que clasifica todo como `unknown`).
  'categories.external_id',
  'collection.*',
  'type.*',
  'tags.*',
  'sales_channels.*',
] as const;

// ─── Promociones ─────────────────────────────────────────────────────────────

type PromoRule = {
  attribute?: string | null;
  operator?: string | null;
  values?: Array<{ value?: string | null }> | null;
};
type PromotionRecord = {
  id: string;
  code?: string | null;
  type?: string | null;
  status?: string | null;
  is_automatic?: boolean | null;
  campaign?: { id?: string; name?: string; description?: string } | null;
  application_method?: {
    type?: string | null;
    value?: number | null;
    target_type?: string | null;
    allocation?: string | null;
    target_rules?: PromoRule[] | null;
  } | null;
};
type CompactPromotion = {
  id: string;
  code: string;
  type: string;
  status?: string | null;
  is_automatic?: boolean | null;
  campaign?: { id?: string; name?: string; description?: string };
  application_method: {
    type?: string | null;
    value?: number | null;
    target_type?: string | null;
    allocation?: string | null;
  };
};

const PROMOTION_FIELDS = [
  'id',
  'code',
  'type',
  'status',
  'is_automatic',
  'campaign.id',
  'campaign.name',
  'campaign.description',
  'application_method.type',
  'application_method.value',
  'application_method.target_type',
  'application_method.allocation',
  'application_method.target_rules.attribute',
  'application_method.target_rules.operator',
  'application_method.target_rules.values.value',
] as const;

/**
 * Product ids a los que apunta una promoción item-level, resolviendo tanto
 * `items.product.id` como `items.product.collection_id`.
 *
 * Compartido con el hook de workflow de promociones (`promotion-changed-typesense`):
 * cuando una promo cambia hay que reindexar exactamente esos productos.
 */
export async function resolvePromotionTargetProductIds(
  query: QueryGraph,
  promotion: PromotionRecord,
  collectionCache?: Map<string, string[]>,
): Promise<string[]> {
  const am = promotion.application_method;
  if (!am || am.target_type !== 'items') return [];

  const cache = collectionCache ?? new Map<string, string[]>();
  const resolveCollectionProducts = async (collectionId: string): Promise<string[]> => {
    const cached = cache.get(collectionId);
    if (cached) return cached;
    const { data: prods } = (await query.graph({
      entity: 'product',
      fields: ['id'],
      filters: { collection_id: collectionId },
    })) as { data: Array<{ id: string }> };
    const ids = prods.map((p) => p.id);
    cache.set(collectionId, ids);
    return ids;
  };

  const targetIds = new Set<string>();
  for (const rule of am.target_rules ?? []) {
    const values = (rule.values ?? [])
      .map((v) => v.value)
      .filter((v): v is string => Boolean(v));
    if (rule.attribute === 'items.product.id') {
      for (const id of values) targetIds.add(id);
    } else if (rule.attribute === 'items.product.collection_id') {
      for (const colId of values) {
        for (const id of await resolveCollectionProducts(colId)) targetIds.add(id);
      }
    }
  }
  return [...targetIds];
}

/** Trae las promociones activas con los campos que necesita el índice. */
export async function fetchActivePromotions(query: QueryGraph): Promise<PromotionRecord[]> {
  const { data } = (await query.graph({
    entity: 'promotion',
    fields: PROMOTION_FIELDS as unknown as string[],
    filters: { status: 'active' },
  })) as { data: PromotionRecord[] };
  return data;
}

/** Mapa product.id → promociones activas item-level que le aplican. */
export async function buildPromosByProduct(
  query: QueryGraph,
): Promise<Map<string, CompactPromotion[]>> {
  const promotions = await fetchActivePromotions(query);
  const collectionCache = new Map<string, string[]>();
  const promosByProduct = new Map<string, CompactPromotion[]>();

  for (const promo of promotions) {
    const am = promo.application_method;
    if (!am || am.target_type !== 'items') continue;

    const targetIds = await resolvePromotionTargetProductIds(query, promo, collectionCache);
    if (targetIds.length === 0) continue;

    const compact: CompactPromotion = {
      id: promo.id,
      code: promo.code ?? '',
      type: promo.type ?? 'standard',
      status: promo.status,
      is_automatic: promo.is_automatic,
      campaign: promo.campaign
        ? {
            id: promo.campaign.id,
            name: promo.campaign.name,
            description: promo.campaign.description,
          }
        : undefined,
      application_method: {
        type: am.type,
        value: am.value,
        target_type: am.target_type,
        allocation: am.allocation,
      },
    };
    for (const id of targetIds) {
      const list = promosByProduct.get(id) ?? [];
      list.push(compact);
      promosByProduct.set(id, list);
    }
  }

  return promosByProduct;
}

/**
 * Resuelve las promociones activas item-level y las adjunta (mutando) a cada
 * producto: setea `product.promotions` + `discount`/`subtotal` a partir del
 * mejor promo automático. Ver docs/recipes/promotions.md.
 *
 * El mapa de promos viene del caché con TTL corto: durante una ráfaga de eventos
 * (import, edición en lote) esto se llamaba una vez por producto y cada llamada
 * re-consultaba TODAS las promociones activas.
 */
export async function attachActivePromotions(
  query: QueryGraph,
  products: AnyRecord[],
  logger?: Logger,
): Promise<number> {
  if (products.length === 0) return 0;

  try {
    const promosByProduct = await getCachedPromosByProduct(query);

    let withPromos = 0;
    for (const product of products) {
      const promos = promosByProduct.get(product.id as string);
      if (!promos?.length) continue;
      product.promotions = promos;
      withPromos++;

      const variants = Array.isArray(product.variants)
        ? (product.variants as Array<{ calculated_price?: { calculated_amount?: number } }>)
        : [];
      const basePrice = Number(variants[0]?.calculated_price?.calculated_amount) || 0;
      if (basePrice <= 0) continue;

      let bestDiscount = 0;
      for (const promo of promos) {
        if (promo.is_automatic === false) continue; // code-based → sin baja de precio
        if (promo.type === 'buyget') continue; // buyget = badge, no descuento unitario
        const am = promo.application_method;
        let discount = 0;
        if (am.type === 'percentage' && typeof am.value === 'number') {
          discount = Math.round((basePrice * am.value) / 100);
        } else if (am.type === 'fixed' && typeof am.value === 'number') {
          discount = Math.min(Math.round(am.value), basePrice);
        }
        if (discount > bestDiscount) bestDiscount = discount;
      }
      if (bestDiscount > 0) {
        product.discount = bestDiscount;
        product.subtotal = basePrice - bestDiscount;
      }
    }
    return withPromos;
  } catch (err) {
    logger?.warn(`[Typesense] Could not attach promotions: ${(err as Error).message}`);
    return 0;
  }
}

// ─── Cachés de corta vida ────────────────────────────────────────────────────

/**
 * TTL de los cachés compartidos. Corto a propósito: sólo tiene que cubrir una
 * ráfaga de eventos (un import, una edición en lote), no dar consistencia.
 * Los datos que quedan atrás los repara el cron de reconciliación, y los cambios
 * que sí importan invalidan explícitamente (ver `invalidateReindexCaches`).
 */
const CACHE_TTL_MS = 30_000;

type Cached<T> = { value: T; expires: number };

let categoryPathCache: Cached<CategoryPathMap> | null = null;
let promosCache: Cached<Map<string, CompactPromotion[]>> | null = null;
let currencyCache: Cached<string> | null = null;
/** Promesas en vuelo: N eventos simultáneos comparten UNA sola construcción. */
let categoryPathInflight: Promise<CategoryPathMap> | null = null;
let promosInflight: Promise<Map<string, CompactPromotion[]>> | null = null;

/**
 * Invalida los cachés. La llaman el subscriber de categorías y el hook de
 * promociones: sin esto, un rename de categoría o una promo nueva podía
 * reindexar con el mapa viejo si caía dentro de la ventana del TTL — justo el
 * dato que el evento venía a corregir.
 */
export function invalidateReindexCaches(
  what: 'categories' | 'promotions' | 'all' = 'all',
): void {
  if (what === 'categories' || what === 'all') {
    categoryPathCache = null;
    categoryPathInflight = null;
  }
  if (what === 'promotions' || what === 'all') {
    promosCache = null;
    promosInflight = null;
  }
  if (what === 'all') currencyCache = null;
}

/** Mapa de rutas de categoría, cacheado por `CACHE_TTL_MS`. */
export async function getCachedCategoryPathMap(query: QueryGraph): Promise<CategoryPathMap> {
  const now = Date.now();
  if (categoryPathCache && categoryPathCache.expires > now) return categoryPathCache.value;
  if (categoryPathInflight) return categoryPathInflight;

  categoryPathInflight = buildCategoryPathMap(query)
    .then((value) => {
      categoryPathCache = { value, expires: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      categoryPathInflight = null;
    });
  return categoryPathInflight;
}

/** Mapa de promociones por producto, cacheado por `CACHE_TTL_MS`. */
async function getCachedPromosByProduct(
  query: QueryGraph,
): Promise<Map<string, CompactPromotion[]>> {
  const now = Date.now();
  if (promosCache && promosCache.expires > now) return promosCache.value;
  if (promosInflight) return promosInflight;

  promosInflight = buildPromosByProduct(query)
    .then((value) => {
      promosCache = { value, expires: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      promosInflight = null;
    });
  return promosInflight;
}

// ─── Reindexado ──────────────────────────────────────────────────────────────

/**
 * Moneda en la que se piden los `calculated_price`: la DEFAULT de la store, con
 * fallback a la primera región y a `DEFAULT_CURRENCY_CODE`.
 *
 * Estaba duplicado: el loader del sync manual resolvía la moneda de la store,
 * pero el cron y los subscribers usaban `DEFAULT_CURRENCY_CODE || 'ars'` a secas.
 * En una store no-ARS eso indexaba con `calculated_price` sin resolver (precio 0
 * → el storefront filtra el producto). Una sola función para los dos caminos.
 */
export async function resolveSyncCurrency(query: QueryGraph): Promise<string> {
  const now = Date.now();
  if (currencyCache && currencyCache.expires > now) return currencyCache.value;

  let currency = process.env.DEFAULT_CURRENCY_CODE || 'ars';
  try {
    const { data: stores } = (await query.graph({
      entity: 'store',
      fields: ['supported_currencies.currency_code', 'supported_currencies.is_default'],
    })) as {
      data: Array<{
        supported_currencies?: Array<{ currency_code: string; is_default?: boolean }>;
      }>;
    };
    const def = stores?.[0]?.supported_currencies?.find((c) => c.is_default)?.currency_code;
    if (def) currency = def;
  } catch {
    // Se cae al fallback por región abajo.
  }

  try {
    const { data: regions } = (await query.graph({
      entity: 'region',
      fields: ['id', 'currency_code'],
    })) as { data: Array<{ id: string; currency_code?: string | null }> };
    // Preferir una región que coincida con la moneda de la store; si no hay,
    // usar la de la primera región (si no, `calculated_price` no resuelve).
    const matching = regions.find((r) => r.currency_code === currency);
    if (!matching && regions[0]?.currency_code) currency = regions[0].currency_code;
  } catch {
    // Sin regiones se usa lo que haya resuelto la store / el env.
  }

  currencyCache = { value: currency, expires: Date.now() + CACHE_TTL_MS };
  return currency;
}

/** Ids por página de reindex; ver el comentario en `reindexProductsByIds`. */
const REINDEX_ID_CHUNK = 100;

/**
 * Trae los productos indicados con TODOS los campos + category paths +
 * promociones, listos para mapear a documento Typesense. Sólo publicados
 * (status != draft).
 */
async function fetchEnrichedProducts(
  query: QueryGraph,
  productIds: string[],
  pathMap: CategoryPathMap,
  currencyCode: string,
  logger?: Logger,
): Promise<AnyRecord[]> {
  const { data: products } = (await query.graph({
    entity: 'product',
    fields: PRODUCT_SYNC_FIELDS as unknown as string[],
    filters: { id: productIds, status: { $ne: 'draft' } },
    context: {
      variants: {
        calculated_price: QueryContext({ currency_code: currencyCode }),
      },
    },
  })) as { data: AnyRecord[] };

  const enriched = products.map((p) => attachCategoryFullPaths(p, pathMap));
  await attachActivePromotions(query, enriched, logger);
  return enriched;
}

/**
 * Reindexa (upsert) los productos indicados. Los ids que ya no son elegibles
 * (draft o borrados) se ELIMINAN del índice, para que un producto que pasa a
 * borrador desaparezca del storefront. Falla de forma controlada: loguea pero
 * no tira si Typesense está inalcanzable.
 */
export async function reindexProductsByIds(
  container: MedusaContainer,
  productIds: string[],
): Promise<{ upserted: number; removed: number }> {
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return { upserted: 0, removed: 0 };

  const typeSenseService = new TypeSenseService();
  const query = container.resolve<QueryGraph>(ContainerRegistrationKeys.QUERY);

  // El mapa de rutas y la moneda salen del caché con TTL corto: en una ráfaga de
  // eventos esto se reconstruía una vez por llamada (ver `reindex-queue.ts`).
  const pathMap = await getCachedCategoryPathMap(query);
  const currencyCode = await resolveSyncCurrency(query);
  // Reglas del asesor: obligatorio ANTES de mapear, o el incremental produciría
  // documentos sin los campos `advisor_*` y el flujo guiado dejaría de ver esos
  // productos hasta el próximo full-sync.
  await loadAdvisorRules(container);

  const foundIds = new Set<string>();
  let upserted = 0;
  // Chunkeado a propósito: un solo `query.graph` con miles de ids y relaciones
  // profundas (variantes, precios, inventario, promociones) revienta la memoria
  // del contenedor. El catalog sync del ERP emite eventos con el catálogo
  // entero cuando corre un backfill, así que acá llegan miles de ids de una.
  for (let i = 0; i < ids.length; i += REINDEX_ID_CHUNK) {
    const chunk = ids.slice(i, i + REINDEX_ID_CHUNK);
    const enriched = await fetchEnrichedProducts(query, chunk, pathMap, currencyCode, logger);
    for (const product of enriched) {
      foundIds.add(product.id as string);
      try {
        await typeSenseService.createDocumentInDB(ProductMapper.toTypesenseObject(product));
        upserted++;
      } catch (err) {
        logger.warn(
          `[Typesense Sync] Failed to index product ${String(product.id)}: ${(err as Error).message}`,
        );
      }
    }
  }

  // Ids pedidos que no resolvieron → ya no elegibles → sacar del índice.
  let removed = 0;
  for (const id of ids) {
    if (foundIds.has(id)) continue;
    if (await typeSenseService.deleteDocumentInDb(id)) removed++;
  }

  return { upserted, removed };
}

/**
 * El barrido completo ya NO vive acá: lo hace `startTypesenseSync` en
 * `run-sync.ts` (`mode: 'update'`), que además borra huérfanos, deja fila de log
 * y reporta progreso. `reindexAllProducts` era la tercera implementación del
 * mismo barrido y ya había divergido de las otras; el cron
 * `typesense-stock-reconcile` pasa ahora por el orquestador.
 */
