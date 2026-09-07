import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import type { MedusaRequest } from '@medusajs/framework/http';

/**
 * Proyección de producto para el backoffice: lo que necesitan las cards del
 * selector y del listado de relaciones (PRD §16.2: imagen, nombre, SKU, precio,
 * estado, stock).
 *
 * No reusa `serve/hydrate.ts` a propósito: ese filtra `status: 'published'` porque
 * el storefront no debe ver borradores, mientras que acá el estado es justamente uno
 * de los datos a mostrar — un merchant tiene que poder ver que relacionó un producto
 * que quedó en borrador.
 */

export type ProductCard = {
  id: string;
  title: string | null;
  handle: string | null;
  thumbnail: string | null;
  status: string | null;
  sku: string | null;
  price: number | null;
  currency_code: string | null;
  stock: number;
  /** `true` si alguna variante no controla inventario (stock ilimitado). */
  unlimited_stock: boolean;
};

type RawVariant = {
  sku?: string | null;
  manage_inventory?: boolean | null;
  calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null;
  inventory_items?: Array<{
    inventory?: { location_levels?: Array<{ available_quantity?: number | null }> } | null;
  }> | null;
};

type RawProduct = {
  id: string;
  title?: string | null;
  handle?: string | null;
  thumbnail?: string | null;
  status?: string | null;
  variants?: RawVariant[] | null;
};

const FIELDS = [
  'id',
  'title',
  'handle',
  'thumbnail',
  'status',
  'variants.sku',
  'variants.manage_inventory',
  'variants.calculated_price.calculated_amount',
  'variants.calculated_price.currency_code',
  'variants.inventory_items.inventory.location_levels.available_quantity',
];

const variantStock = (variant: RawVariant): number =>
  (variant.inventory_items ?? []).reduce((acc, item) => {
    const levels = item.inventory?.location_levels ?? [];
    return acc + levels.reduce((sum, level) => sum + (level.available_quantity || 0), 0);
  }, 0);

function toCard(raw: RawProduct, fallbackCurrency: string | null): ProductCard {
  const variants = raw.variants ?? [];
  const amounts = variants
    .map((v) => v.calculated_price?.calculated_amount)
    .filter((amount): amount is number => typeof amount === 'number');

  return {
    id: raw.id,
    title: raw.title ?? null,
    handle: raw.handle ?? null,
    thumbnail: raw.thumbnail ?? null,
    status: raw.status ?? null,
    sku: variants.find((v) => v.sku)?.sku ?? null,
    price: amounts.length ? Math.min(...amounts) : null,
    currency_code: variants.find((v) => v.calculated_price?.currency_code)?.calculated_price
      ?.currency_code ?? fallbackCurrency,
    stock: variants.reduce((acc, v) => acc + variantStock(v), 0),
    unlimited_stock: variants.some((v) => v.manage_inventory === false),
  };
}

/**
 * Resuelve la región para el contexto de precio.
 *
 * Sin contexto de precio las variantes no traen `calculated_price` y las cards salen
 * todas sin precio, que es justo lo que el PRD §16.2 pide mostrar.
 *
 * Orden de preferencia:
 *   1. la `region_id` pedida explícitamente;
 *   2. la región DEFAULT de la tienda;
 *   3. cualquier región, como último recurso.
 *
 * El paso 2 es el que importa y no estaba: antes se tomaba "la primera región" con un
 * `take: 1` SIN `order`, o sea en orden arbitrario de la base. En una tienda con varias
 * regiones eso devolvía cualquiera — en producción caía en una de EUR mientras la
 * tienda opera en ARS, y como esa región no tiene precios cargados, las cards salían
 * con `price: null` y la moneda equivocada. El síntoma era silencioso: no hay error, la
 * card simplemente no muestra precio.
 */
export async function resolvePriceRegion(
  req: MedusaRequest,
  regionId?: string,
): Promise<{ region_id: string | null; currency_code: string | null }> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const readRegion = async (filters?: Record<string, unknown>) => {
    const { data } = await query.graph({
      entity: 'region',
      fields: ['id', 'currency_code'],
      ...(filters ? { filters } : {}),
      pagination: { take: 1, skip: 0 },
    });
    return data[0] as { id?: string; currency_code?: string } | undefined;
  };

  let region = regionId ? await readRegion({ id: regionId }) : undefined;

  if (!region) {
    // Región default de la tienda. Se tolera que falle (una tienda sin store row, o
    // sin default configurado) y se cae al último recurso.
    try {
      const { data } = await query.graph({
        entity: 'store',
        fields: ['default_region_id'],
        pagination: { take: 1, skip: 0 },
      });
      const defaultRegionId = (data[0] as { default_region_id?: string } | undefined)
        ?.default_region_id;
      if (defaultRegionId) region = await readRegion({ id: defaultRegionId });
    } catch {
      region = undefined;
    }
  }

  region ??= await readRegion();

  return {
    region_id: region?.id ?? null,
    currency_code: region?.currency_code?.toLowerCase() ?? null,
  };
}

/** Trae las cards de los ids pedidos, indexadas por id. Incluye borradores. */
export async function loadProductCards(
  req: MedusaRequest,
  productIds: string[],
  price: { region_id: string | null; currency_code: string | null },
): Promise<Map<string, ProductCard>> {
  const ids = [...new Set(productIds)].filter(Boolean);
  if (!ids.length) return new Map();

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: 'product',
    fields: FIELDS,
    filters: { id: ids },
    ...(price.currency_code
      ? {
          context: {
            variants: {
              calculated_price: QueryContext({
                currency_code: price.currency_code,
                ...(price.region_id ? { region_id: price.region_id } : {}),
              }),
            },
          },
        }
      : {}),
  });

  const rows = data as RawProduct[];
  return new Map(
    rows.filter((row) => row?.id).map((row) => [row.id, toCard(row, price.currency_code)]),
  );
}

export { toCard as __toCard };
