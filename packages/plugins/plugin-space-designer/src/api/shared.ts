import type { MedusaRequest } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError, Modules } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import type { z } from 'zod';
import { SPACE_DESIGNER_MODULE } from '../modules/space-designer';
import type SpaceDesignerModuleService from '../modules/space-designer/service';
import type {
  SpaceCatalogProduct,
  SpaceConfigV1,
  SpaceConfigurator,
  SpaceSnapshot,
} from '../types';
import { selectionErrors } from '../validation';

export const serviceOf = (req: MedusaRequest): SpaceDesignerModuleService =>
  req.scope.resolve(SPACE_DESIGNER_MODULE);
export const invalid = (message: string): never => {
  throw new MedusaError(MedusaError.Types.INVALID_DATA, message);
};
export const missing = (): never => {
  throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No encontramos el recurso en esta tienda.');
};
export function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success)
    return invalid(
      parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
    );
  return parsed.data;
}
export const customerOf = (req: MedusaRequest): string | null =>
  (req as unknown as { auth_context?: { actor_id?: string } }).auth_context?.actor_id ?? null;
export function storeChannels(req: MedusaRequest, requireSelection = false): string[] {
  const ids =
    (req as unknown as { publishable_key_context?: { sales_channel_ids?: string[] } })
      .publishable_key_context?.sales_channel_ids ?? [];
  if (!ids.length)
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      'La clave de tienda no tiene un canal habilitado.'
    );
  const selected = req.query.sales_channel_id;
  if (selected !== undefined) {
    if (typeof selected !== 'string' || !ids.includes(selected))
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'El canal elegido no está habilitado por la clave de tienda.'
      );
    return [selected];
  }
  if (requireSelection && ids.length > 1)
    return invalid('Elegí el canal activo para consultar el configurador.');
  return ids;
}
/** Admin selected-site headers are operator context; store scope ONLY comes from the key. */
export async function adminChannels(req: MedusaRequest): Promise<string[] | null> {
  const raw = req.headers['x-site-id'];
  const siteId = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!siteId || siteId === '*') return null;
  let sites: {
    listDemoStores: (
      filter: unknown,
      config: unknown
    ) => Promise<{ sales_channel_id?: string; b2b_sales_channel_id?: string }[]>;
  };
  try {
    sites = req.scope.resolve('demo_store');
  } catch {
    return missing();
  }
  const [site] = await sites.listDemoStores({ id: siteId }, { take: 1 });
  if (!site) return missing();
  return [site.sales_channel_id, site.b2b_sales_channel_id].filter((id): id is string =>
    Boolean(id)
  );
}
export function channelFilter(
  channels: string[] | null,
  includeGlobal = true
): Record<string, unknown> {
  if (channels === null) return {};
  return includeGlobal
    ? { $or: [{ sales_channel_id: channels }, { sales_channel_id: null }] }
    : { sales_channel_id: channels };
}
export function assertChannel(
  channel: string | null,
  channels: string[] | null,
  includeGlobal = true
): void {
  if (
    channels !== null &&
    !(channel === null && includeGlobal) &&
    (!channel || !channels.includes(channel))
  )
    missing();
}
export async function configuratorById(
  req: MedusaRequest,
  id: string,
  published = false
): Promise<SpaceConfigurator> {
  const rows = await serviceOf(req).listSpaceConfigurators(
    { id, ...(published ? { status: 'published' } : {}) },
    { take: 1 }
  );
  const row = rows[0] as unknown as SpaceConfigurator | undefined;
  if (!row) return missing();
  assertChannel(row.sales_channel_id, published ? storeChannels(req) : await adminChannels(req));
  return row;
}
export async function assertUniqueSlug(
  req: MedusaRequest,
  slug: string,
  id?: string
): Promise<void> {
  const rows = await serviceOf(req).listSpaceConfigurators({ slug }, { take: 1 });
  if (rows[0] && rows[0].id !== id) invalid('Ya existe un configurador con esa URL.');
}

type VariantRow = {
  id: string;
  title?: string;
  sku?: string | null;
  manage_inventory?: boolean;
  allow_backorder?: boolean;
  calculated_price?: { calculated_amount?: number | null; currency_code?: string | null } | null;
  inventory_items?: {
    required_quantity?: number;
    inventory?: { location_levels?: { available_quantity?: number }[] };
  }[];
  product?: {
    id: string;
    title?: string;
    handle?: string | null;
    thumbnail?: string | null;
    status?: string;
    sales_channels?: { id: string }[];
  };
};
export async function variantsFor(
  req: MedusaRequest,
  ids: string[],
  price?: PriceContext | null
): Promise<VariantRow[]> {
  if (!ids.length) return [];
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'product_variant',
    fields: [
      'id',
      'title',
      'sku',
      'manage_inventory',
      'allow_backorder',
      'product.id',
      'product.title',
      'product.handle',
      'product.thumbnail',
      'product.status',
      'product.sales_channels.id',
      'inventory_items.required_quantity',
      'inventory_items.inventory.location_levels.available_quantity',
      ...(price ? ['calculated_price.calculated_amount', 'calculated_price.currency_code'] : []),
    ],
    filters: { id: [...new Set(ids)] },
    ...(price
      ? {
          context: {
            calculated_price: QueryContext({
              region_id: price.region_id,
              currency_code: price.currency_code,
              ...(price.customer_group_ids.length
                ? { customer: { groups: price.customer_group_ids.map((id) => ({ id })) } }
                : {}),
            }),
          },
        }
      : {}),
  });
  return data as unknown as VariantRow[];
}
export async function validateCatalog(
  req: MedusaRequest,
  config: SpaceConfigV1,
  channel: string | null,
  published: boolean
): Promise<void> {
  const variants = new Map(
    (
      await variantsFor(
        req,
        config.products.map((product) => product.variant_id)
      )
    ).map((variant) => [variant.id, variant])
  );
  for (const product of config.products) {
    const variant = variants.get(product.variant_id);
    if (!variant || variant.product?.id !== product.product_id)
      return invalid(
        `La variante de ${product.label ?? product.id} no pertenece al producto elegido.`
      );
    if (published && variant.product?.status !== 'published')
      invalid(
        `Publicá el producto ${product.label ?? product.id} antes de publicar el configurador.`
      );
    if (channel && !variant.product?.sales_channels?.some((row) => row.id === channel))
      invalid(`El producto ${product.label ?? product.id} no pertenece al canal del configurador.`);
  }
}
export function availableVariant(variant: VariantRow): boolean {
  if (variant.manage_inventory === false || variant.allow_backorder) return true;
  const items = variant.inventory_items ?? [];
  return (
    items.length > 0 &&
    items.every(
      (item) =>
        (item.inventory?.location_levels ?? []).reduce(
          (sum, level) => sum + (level.available_quantity ?? 0),
          0
        ) >= (item.required_quantity ?? 1)
    )
  );
}
export async function publicCatalog(
  req: MedusaRequest,
  config: SpaceConfigV1,
  price?: PriceContext | null
): Promise<SpaceCatalogProduct[]> {
  const channels = storeChannels(req, true);
  const output = new Map<string, SpaceCatalogProduct>();
  for (const variant of await variantsFor(
    req,
    config.products.map((product) => product.variant_id),
    price
  )) {
    const product = variant.product;
    if (
      !product ||
      product.status !== 'published' ||
      !product.sales_channels?.some((channel) => channels.includes(channel.id))
    )
      continue;
    const entry = output.get(product.id) ?? {
      id: product.id,
      title: product.title ?? '',
      handle: product.handle ?? null,
      thumbnail: product.thumbnail ?? null,
      variants: [],
    };
    entry.variants.push({
      id: variant.id,
      title: variant.title ?? '',
      sku: variant.sku ?? null,
      calculated_amount: variant.calculated_price?.calculated_amount ?? null,
      currency_code: variant.calculated_price?.currency_code ?? null,
      available: availableVariant(variant),
    });
    output.set(product.id, entry);
  }
  return [...output.values()];
}
export type PriceContext = {
  region_id: string;
  currency_code: string;
  customer_group_ids: string[];
  sales_channel_id?: string;
  cart_id?: string;
};
export async function cartContext(req: MedusaRequest, cartId: string): Promise<PriceContext> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'cart',
    fields: [
      'id',
      'sales_channel_id',
      'region_id',
      'currency_code',
      'customer_id',
      'completed_at',
      'customer.groups.id',
    ],
    filters: { id: cartId },
  });
  const cart = data[0] as unknown as
    | {
        id: string;
        sales_channel_id: string;
        region_id: string;
        currency_code: string;
        customer_id: string | null;
        completed_at: string | null;
        customer?: { groups?: { id: string }[] };
      }
    | undefined;
  if (!cart || cart.completed_at || !storeChannels(req).includes(cart.sales_channel_id))
    return missing();
  if (cart.customer_id && cart.customer_id !== customerOf(req)) return missing();
  if (!cart.region_id || !cart.currency_code)
    return invalid('El carrito todavía no tiene región y moneda.');
  return {
    cart_id: cart.id,
    sales_channel_id: cart.sales_channel_id,
    region_id: cart.region_id,
    currency_code: cart.currency_code,
    customer_group_ids: cart.customer?.groups?.map((group) => group.id) ?? [],
  };
}
export async function priceContext(req: MedusaRequest): Promise<PriceContext | null> {
  const requestedRegion = req.query.region_id;
  if (
    requestedRegion !== undefined &&
    (typeof requestedRegion !== 'string' || !requestedRegion.trim())
  )
    return invalid('La región elegida no es válida.');
  let cart: PriceContext | null = null;
  if (typeof req.query.cart_id === 'string') {
    try {
      cart = await cartContext(req, req.query.cart_id);
    } catch (error) {
      // A stale browser cart must not hide the published configurator. Fall back
      // to the requested region, never another customer's price context.
      if (!(error instanceof MedusaError) || error.type !== MedusaError.Types.NOT_FOUND)
        throw error;
    }
  }

  // A customer can open the designer before creating a cart, or while their
  // browser still holds a guest cart. Resolve group pricing from the session.
  const customerId = customerOf(req);
  let customerGroups: string[] = [];
  if (customerId) {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'customer',
      fields: ['id', 'groups.id'],
      filters: { id: customerId },
    });
    const customer = data[0] as unknown as { id: string; groups?: { id: string }[] } | undefined;
    customerGroups =
      customer?.id === customerId ? (customer.groups?.map((group) => group.id) ?? []) : [];
  }
  if (cart && (requestedRegion === undefined || requestedRegion === cart.region_id))
    return { ...cart, customer_group_ids: customerGroups };
  if (typeof requestedRegion !== 'string') return null;
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: 'region',
    fields: ['id', 'currency_code'],
    filters: { id: requestedRegion },
  });
  const region = data[0] as unknown as { id: string; currency_code: string } | undefined;
  return region
    ? {
        region_id: region.id,
        currency_code: region.currency_code,
        customer_group_ids: customerGroups,
      }
    : invalid('La región elegida no existe.');
}
export function validateSelection(
  config: SpaceConfigV1,
  snapshot: SpaceSnapshot,
  templateId?: string
): void {
  const errors = selectionErrors(config, snapshot, templateId);
  if (errors.length) invalid(errors.join(' '));
}

/** Use the link entity: filtering nested product.sales_channels is unsupported. */
export async function productIdsForChannels(
  req: MedusaRequest,
  channels: string[]
): Promise<string[]> {
  const ids = new Set<string>();
  for (let skip = 0; ; skip += 1000) {
    const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: 'product_sales_channel',
      fields: ['product_id'],
      filters: { sales_channel_id: channels },
      pagination: { skip, take: 1000 },
    });
    for (const row of data as unknown as { product_id: string }[]) ids.add(row.product_id);
    if (data.length < 1000) return [...ids];
    if (skip >= 20000) invalid('El catálogo de este canal requiere una búsqueda más específica.');
  }
}
export async function adminProductLookup(
  req: MedusaRequest,
  input: { q?: string; limit: number; offset: number; sales_channel_id?: string }
) {
  const siteChannels = await adminChannels(req);
  if (input.sales_channel_id) assertChannel(input.sales_channel_id, siteChannels, false);
  const channels = input.sales_channel_id ? [input.sales_channel_id] : siteChannels;
  const ids = channels === null ? null : await productIdsForChannels(req, channels);
  if (ids?.length === 0)
    return { products: [], count: 0, offset: input.offset, limit: input.limit };
  const service = req.scope.resolve(Modules.PRODUCT);
  const [rows, count] = await service.listAndCountProducts(
    { ...(input.q ? { q: input.q } : {}), ...(ids ? { id: ids } : {}) },
    { skip: input.offset, take: input.limit, relations: ['variants'], order: { title: 'ASC' } }
  );
  const products: SpaceCatalogProduct[] = rows.map((product) => ({
    id: product.id,
    title: product.title,
    handle: product.handle ?? null,
    thumbnail: product.thumbnail ?? null,
    variants: (product.variants ?? []).map((variant) => ({
      id: variant.id,
      title: variant.title ?? '',
      sku: variant.sku ?? null,
      calculated_amount: null,
      currency_code: null,
      available: true,
    })),
  }));
  return { products, count, offset: input.offset, limit: input.limit };
}
