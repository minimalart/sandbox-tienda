import type { MedusaRequest } from '@medusajs/framework';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';

/**
 * Contexto de precios de un entonado: la variante base y el precio de catálogo
 * con el que se desglosa el sobreprecio.
 *
 * El carrito es la fuente del contexto (región, moneda y grupos del cliente)
 * porque es lo único que el storefront tiene siempre a mano y es exactamente lo
 * que Medusa usa para calcular el precio de la variante. Sin carrito se devuelve
 * el SKU igual: la cotización del ERP no depende de nuestra región.
 */

/**
 * Lo único que hace falta para calcular el precio de catálogo de la base: región,
 * moneda y grupos del cliente. Sale del carrito cuando hay, y del país cuando no.
 */
export type TintingPriceContext = {
  region_id: string | null;
  currency_code: string | null;
  customer_group_ids: string[];
};

export type TintingCartContext = TintingPriceContext & {
  cart_id: string;
};

type CartRow = {
  id: string;
  region_id?: string | null;
  currency_code?: string | null;
  customer?: { groups?: Array<{ id?: string }> | null } | null;
};

export async function loadCartContext(
  req: MedusaRequest,
  cartId: string
): Promise<TintingCartContext | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = (await query.graph({
    entity: 'cart',
    fields: ['id', 'region_id', 'currency_code', 'customer.groups.id'],
    filters: { id: cartId },
  })) as { data: CartRow[] };

  const cart = data?.[0];
  if (!cart) return null;
  return {
    cart_id: cart.id,
    region_id: cart.region_id ?? null,
    currency_code: cart.currency_code ?? null,
    customer_group_ids: (cart.customer?.groups ?? [])
      .map((g) => g?.id)
      .filter((id): id is string => Boolean(id)),
  };
}

type RegionRow = {
  id: string;
  currency_code?: string | null;
  countries?: Array<{ iso_2?: string | null }> | null;
};

/**
 * Contexto de precios a partir del país de la URL, para el caso sin carrito.
 *
 * Trae TODAS las regiones y matchea en memoria en vez de filtrar por
 * `countries.iso_2`: son un puñado por tienda, y así no se depende de que el
 * módulo de regiones acepte ese filtro anidado en `query.graph`.
 */
export async function loadRegionContext(
  req: MedusaRequest,
  countryCode: string
): Promise<TintingPriceContext | null> {
  const iso = countryCode.trim().toLowerCase();
  if (!iso) return null;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = (await query.graph({
    entity: 'region',
    fields: ['id', 'currency_code', 'countries.iso_2'],
  })) as { data: RegionRow[] };

  const region = (data ?? []).find((row) =>
    (row.countries ?? []).some((country) => country?.iso_2?.toLowerCase() === iso)
  );
  if (!region) return null;

  return {
    region_id: region.id,
    currency_code: region.currency_code ?? null,
    // Sin carrito no hay cliente, así que no hay lista de mayorista que aplicar.
    customer_group_ids: [],
  };
}

export type TintingVariantInfo = {
  variant_id: string;
  /** SKU = código de artículo en el ERP: es la bisagra entre Medusa y Zeus. */
  sku: string | null;
  title: string | null;
  product_title: string | null;
  thumbnail: string | null;
  /** Precio de catálogo de la base con el contexto del carrito, si hubo. */
  base_unit_price: number | null;
};

type VariantRow = {
  id: string;
  sku?: string | null;
  title?: string | null;
  product?: { title?: string | null; thumbnail?: string | null } | null;
  calculated_price?: { calculated_amount?: number | null } | null;
};

export async function loadVariantInfo(
  req: MedusaRequest,
  variantId: string,
  context: TintingPriceContext | null
): Promise<TintingVariantInfo | null> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const priceContext =
    context?.currency_code && context.region_id
      ? QueryContext({
          currency_code: context.currency_code,
          region_id: context.region_id,
          ...(context.customer_group_ids.length
            ? { customer: { groups: context.customer_group_ids.map((id) => ({ id })) } }
            : {}),
        })
      : null;

  const { data } = (await query.graph({
    entity: 'product_variant',
    fields: [
      'id',
      'sku',
      'title',
      'product.title',
      'product.thumbnail',
      ...(priceContext ? ['calculated_price.calculated_amount'] : []),
    ],
    filters: { id: variantId },
    ...(priceContext ? { context: { calculated_price: priceContext } } : {}),
  })) as { data: VariantRow[] };

  const variant = data?.[0];
  if (!variant) return null;
  return {
    variant_id: variant.id,
    sku: variant.sku?.trim() || null,
    title: variant.title ?? null,
    product_title: variant.product?.title ?? null,
    thumbnail: variant.product?.thumbnail ?? null,
    base_unit_price: variant.calculated_price?.calculated_amount ?? null,
  };
}

export type TintingBaseVariant = TintingVariantInfo & {
  product_id: string | null;
  product_handle: string | null;
  currency_code: string | null;
};

type BaseVariantRow = VariantRow & {
  product?:
    | (VariantRow['product'] & {
        id?: string | null;
        handle?: string | null;
        status?: string | null;
        sales_channels?: Array<{ id?: string | null }> | null;
      })
    | null;
  calculated_price?: {
    calculated_amount?: number | null;
    currency_code?: string | null;
  } | null;
};

/**
 * SKU → variante de Medusa, para el flujo inverso (color → bases): la data
 * maestra da códigos de artículo y hace falta el producto vendible detrás.
 *
 * El canal se pide como CAMPO y se compara en JS, no como filtro anidado:
 * es el patrón probado del repo (`workflows/create-recurring-order.ts`), y sin
 * el filtro un demo listaría —y vendería— artículos del canal de otro tenant.
 * Un producto sin canales asignados se deja pasar: es catálogo global, la misma
 * regla que aplica el alta de compras recurrentes.
 */
export async function loadVariantsBySku(
  req: MedusaRequest,
  skus: string[],
  context: TintingPriceContext | null,
  salesChannelId: string | null
): Promise<Map<string, TintingBaseVariant>> {
  const out = new Map<string, TintingBaseVariant>();
  const wanted = [...new Set(skus.map((s) => s?.trim()).filter(Boolean))] as string[];
  if (!wanted.length) return out;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // Igual que loadVariantInfo: sin región + moneda no hay calculated_price, y
  // pedirlo igual devuelve null en vez de fallar.
  const priceContext =
    context?.currency_code && context.region_id
      ? QueryContext({
          currency_code: context.currency_code,
          region_id: context.region_id,
          ...(context.customer_group_ids.length
            ? { customer: { groups: context.customer_group_ids.map((id) => ({ id })) } }
            : {}),
        })
      : null;

  const { data } = (await query.graph({
    entity: 'product_variant',
    fields: [
      'id',
      'sku',
      'title',
      'product.id',
      'product.title',
      'product.handle',
      'product.thumbnail',
      'product.status',
      'product.sales_channels.id',
      ...(priceContext
        ? ['calculated_price.calculated_amount', 'calculated_price.currency_code']
        : []),
    ],
    filters: { sku: wanted },
    ...(priceContext ? { context: { calculated_price: priceContext } } : {}),
  })) as { data: BaseVariantRow[] };

  for (const variant of data ?? []) {
    const sku = variant.sku?.trim();
    if (!sku) continue;
    if (variant.product?.status && variant.product.status !== 'published') continue;

    const channels = variant.product?.sales_channels ?? [];
    if (salesChannelId && channels.length && !channels.some((c) => c?.id === salesChannelId)) {
      continue;
    }

    out.set(sku, {
      variant_id: variant.id,
      sku,
      title: variant.title ?? null,
      product_title: variant.product?.title ?? null,
      thumbnail: variant.product?.thumbnail ?? null,
      base_unit_price: variant.calculated_price?.calculated_amount ?? null,
      product_id: variant.product?.id ?? null,
      product_handle: variant.product?.handle ?? null,
      currency_code: variant.calculated_price?.currency_code ?? context?.currency_code ?? null,
    });
  }

  return out;
}
