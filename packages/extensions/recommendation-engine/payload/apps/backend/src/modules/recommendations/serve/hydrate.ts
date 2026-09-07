import type { HydratedProduct, HydratedVariant } from '../types';

/**
 * Hidratación de candidatos: UN batch para la unión de toda la cadena MÁS el
 * producto de origen.
 *
 * Incluir el origen en la misma llamada es lo que hace que los filtros de
 * "misma categoría" / "misma marca" cuesten CERO round trips extra: sus categorías,
 * marca y tags llegan en la misma respuesta que los candidatos.
 *
 * Es la llamada más cara del serve (~40% del presupuesto de latencia) y es también
 * la "recuperación completa de información comercial" que el PRD §18.1 excluye del
 * objetivo de 100 ms.
 */

type QueryGraphLike = {
  graph: (config: Record<string, unknown>) => Promise<{ data: unknown[] }>;
};

type RawVariant = {
  id: string;
  sku?: string | null;
  title?: string | null;
  manage_inventory?: boolean | null;
  calculated_price?: {
    calculated_amount?: number | null;
    original_amount?: number | null;
    currency_code?: string | null;
  } | null;
  inventory_items?: Array<{
    inventory?: { location_levels?: Array<{ available_quantity?: number | null }> } | null;
  }> | null;
};

type RawCategory = { id?: string | null; parent_category?: { id?: string | null } | null };

type RawProduct = {
  id: string;
  title?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
  status?: string | null;
  collection_id?: string | null;
  type_id?: string | null;
  metadata?: Record<string, unknown> | null;
  variants?: RawVariant[] | null;
  categories?: RawCategory[] | null;
  tags?: Array<{ value?: string | null }> | null;
  sales_channels?: Array<{ id?: string | null }> | null;
  brand?: { id?: string | null; name?: string | null } | null;
};

const BASE_FIELDS = [
  'id',
  'title',
  'handle',
  'thumbnail',
  'status',
  'collection_id',
  'type_id',
  'metadata',
  'variants.id',
  'variants.sku',
  'variants.title',
  'variants.manage_inventory',
  'variants.calculated_price.calculated_amount',
  'variants.calculated_price.original_amount',
  'variants.calculated_price.currency_code',
  'variants.inventory_items.inventory.location_levels.available_quantity',
  'categories.id',
  'categories.parent_category.id',
  'tags.value',
  'sales_channels.id',
];

const BRAND_FIELDS = ['brand.id', 'brand.name'];

/**
 * ¿Se puede pedir `brand.*`? La extensión `brands` es opcional: en un proyecto
 * generado sin ella el link no existe y pedir esos campos hace fallar la query
 * entera. Se sondea una vez por proceso y se recuerda, así el costo del fallback se
 * paga como máximo una vez (no una vez por request).
 *
 * `null` = todavía no se sabe.
 */
let brandFieldsSupported: boolean | null = null;

/** Sólo para tests: vuelve a dejar el sondeo de marca sin resolver. */
export const resetBrandProbe = (): void => {
  brandFieldsSupported = null;
};

const stockOfRaw = (variant: RawVariant): number =>
  (variant.inventory_items ?? []).reduce((acc, item) => {
    const levels = item.inventory?.location_levels ?? [];
    return acc + levels.reduce((sum, level) => sum + (level.available_quantity || 0), 0);
  }, 0);

const normalizeVariant = (variant: RawVariant): HydratedVariant => ({
  id: variant.id,
  sku: variant.sku ?? null,
  title: variant.title ?? null,
  manage_inventory: variant.manage_inventory ?? null,
  calculated_amount: variant.calculated_price?.calculated_amount ?? null,
  original_amount: variant.calculated_price?.original_amount ?? null,
  currency_code: variant.calculated_price?.currency_code ?? null,
  available: stockOfRaw(variant),
});

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

/**
 * Normaliza la fila cruda del graph a `HydratedProduct`.
 *
 * `category_ids` incluye las categorías propias Y sus padres, para que el filtro de
 * "misma categoría" matchee por rama del árbol y no sólo por la hoja exacta: dos
 * productos de subcategorías hermanas son razonablemente "de la misma categoría".
 *
 * La marca se resuelve por el link `product-brand` y, si no está, cae a
 * `metadata.brand` — que es donde vive la marca cuando la extensión `brands` no
 * está instalada (mismo criterio que el mapper de Typesense).
 */
export function normalizeProduct(raw: RawProduct): HydratedProduct {
  const categoryIds = new Set<string>();
  for (const category of raw.categories ?? []) {
    const id = asString(category?.id);
    if (id) categoryIds.add(id);
    const parentId = asString(category?.parent_category?.id);
    if (parentId) categoryIds.add(parentId);
  }

  const metadata = (raw.metadata ?? null) as Record<string, unknown> | null;
  const brandId = asString(raw.brand?.id);
  const brandName = asString(raw.brand?.name) ?? asString(metadata?.brand);

  return {
    id: raw.id,
    title: raw.title ?? null,
    handle: raw.handle ?? null,
    thumbnail: raw.thumbnail ?? null,
    status: raw.status ?? null,
    collection_id: asString(raw.collection_id),
    type_id: asString(raw.type_id),
    // Sin link de marca, el nombre de `metadata.brand` hace de identidad: es lo
    // único comparable que hay, y "misma marca" sigue funcionando.
    brand_id: brandId ?? (brandName ? `metadata:${brandName.toLowerCase()}` : null),
    brand_name: brandName,
    category_ids: [...categoryIds],
    tag_values: (raw.tags ?? [])
      .map((tag) => asString(tag?.value))
      .filter((value): value is string => value !== null),
    sales_channel_ids: (raw.sales_channels ?? [])
      .map((channel) => asString(channel?.id))
      .filter((value): value is string => value !== null),
    metadata,
    variants: (raw.variants ?? []).map(normalizeVariant),
  };
}

export type HydrateParams = {
  product_ids: string[];
  /** Contexto de precio: sin él las variantes no traen `calculated_price`. */
  currency_code: string;
  region_id?: string | null;
};

/**
 * Trae los productos publicados de la lista, indexados por id.
 *
 * `status: 'published'` va como filtro del graph, así que "no publicado" no gasta
 * un filtro en JS: el producto simplemente no vuelve y el filtro lo cuenta como
 * `not_hydrated`.
 */
export async function hydrateProducts(
  query: QueryGraphLike,
  queryContext: (context: Record<string, unknown>) => unknown,
  params: HydrateParams,
): Promise<Map<string, HydratedProduct>> {
  const ids = [...new Set(params.product_ids)].filter(Boolean);
  if (!ids.length) return new Map();

  const priceContext = queryContext({
    currency_code: params.currency_code,
    ...(params.region_id ? { region_id: params.region_id } : {}),
  });

  const run = async (withBrand: boolean) => {
    const { data } = await query.graph({
      entity: 'product',
      fields: withBrand ? [...BASE_FIELDS, ...BRAND_FIELDS] : BASE_FIELDS,
      filters: { id: ids, status: 'published' },
      context: { variants: { calculated_price: priceContext } },
    });
    return data as RawProduct[];
  };

  let rows: RawProduct[];
  if (brandFieldsSupported === false) {
    rows = await run(false);
  } else {
    try {
      rows = await run(true);
      brandFieldsSupported = true;
    } catch (error) {
      // La extensión `brands` no está instalada (o el link cambió de forma):
      // se recuerda y se reintenta sin esos campos. El filtro de marca cae al
      // fallback por `metadata.brand`.
      if (brandFieldsSupported === null) brandFieldsSupported = false;
      else throw error;
      rows = await run(false);
    }
  }

  return new Map(rows.filter((row) => row?.id).map((row) => [row.id, normalizeProduct(row)]));
}
