import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import { SHOP_BY_LOOK_MODULE } from '../../../modules/shop-by-look';
import ShopByLookModuleService from '../../../modules/shop-by-look/service';
import {
  STORE_CONFIG_MODULE,
  STORE_SETTING_KEYS,
  type StoreConfigLike,
} from '../../../lib/foreign-modules';
import { siteIdFromPublishableKey } from '../../../lib/multistore';

type VariantRow = {
  id: string;
  title?: string;
  manage_inventory?: boolean;
  calculated_price?: { calculated_amount?: number; currency_code?: string } | null;
  options?: Array<{ id: string; value: string; option?: { id: string; title: string } | null }>;
  inventory_items?: Array<{
    inventory?: { location_levels?: Array<{ available_quantity?: number }> } | null;
  }>;
};
type ProductRow = {
  id: string;
  title?: string;
  handle?: string;
  thumbnail?: string | null;
  status?: string;
  variants?: VariantRow[];
};

const stockOf = (v: VariantRow): number => {
  if (v.manage_inventory === false) return 999999;
  return (v.inventory_items ?? []).reduce((acc, it) => {
    const levels = it.inventory?.location_levels ?? [];
    return acc + levels.reduce((a, l) => a + (l.available_quantity || 0), 0);
  }, 0);
};

const asIdArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
};

/**
 * Un look aplica al contexto si su scope está vacío (global) o incluye el valor.
 * `strict` (contexto demo) descarta los globales: un look sin canal deja de verse
 * dentro de una demo para que muestre solo lo suyo (misma regla que el blog).
 */
const scopeMatches = (
  scope: unknown,
  current: string | undefined,
  strict = false
): boolean => {
  const ids = asIdArray(scope);
  if (ids.length === 0) return !strict;
  if (!current) return false;
  return ids.includes(current);
};

/**
 * GET /store/shop-by-look — looks activos para el canal/región actuales.
 *
 * Query: `sales_channel_id`, `region_id` (los manda el storefront).
 * - Si el toggle global está apagado → { looks: [] }.
 * - Filtra por segmentación (canal/región), enriquece productos con precio (según
 *   región) y stock, oculta productos sin stock / inexistentes, y descarta looks
 *   que se quedan sin productos válidos.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const salesChannelId =
    typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined;
  const regionId = typeof req.query.region_id === 'string' ? req.query.region_id : undefined;
  const strict = req.query.strict === '1' || req.query.strict === 'true';

  // El toggle de LA TIENDA, con fallback al global (`readSetting` es precedencia).
  // Sin `siteId` una tienda que apagó la sección la seguía viendo publicada porque
  // mandaba la fila de la instancia: el operador apaga, mira su sitio, y sigue ahí.
  //
  // OJO: el `sales_channel_id` de arriba, el que decide QUÉ looks se ven, sigue
  // saliendo del query param —lo declara el cliente— y eso NO se cierra acá. El
  // storefront lo pisa con la key confiable; migrar acá es un cambio pendiente y
  // está documentado en el host multistore (`store-routes.ts`).
  const storeConfig: StoreConfigLike = req.scope.resolve(STORE_CONFIG_MODULE);
  const enabled = await storeConfig.getBooleanSetting(
    STORE_SETTING_KEYS.SHOP_BY_LOOK_ENABLED,
    false,
    await siteIdFromPublishableKey(req)
  );
  if (!enabled) {
    res.json({ looks: [] });
    return;
  }

  const service: ShopByLookModuleService = req.scope.resolve(SHOP_BY_LOOK_MODULE);
  const looks = await service.listShopByLooks(
    { is_active: true },
    { relations: ['products'], order: { sort_order: 'ASC', created_at: 'DESC' } }
  );

  const applicable = looks.filter(
    (look: Record<string, unknown>) =>
      scopeMatches(look.sales_channel_ids, salesChannelId, strict) &&
      scopeMatches(look.region_ids, regionId)
  );

  if (applicable.length === 0) {
    res.json({ looks: [] });
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // Moneda para el contexto de precios (según región solicitada, con fallback).
  const { data: regions } = await query.graph({
    entity: 'region',
    fields: ['id', 'currency_code'],
    ...(regionId ? { filters: { id: regionId } } : {}),
  });
  const region = regions[0];

  const priceContext = QueryContext({
    currency_code: region?.currency_code ?? 'ars',
    region_id: region?.id,
  });

  // Junta todos los product_id de todos los looks para una sola consulta.
  const allProductIds = Array.from(
    new Set(
      applicable.flatMap((look: Record<string, unknown>) =>
        ((look.products as Array<{ product_id: string }>) ?? []).map((p) => p.product_id)
      )
    )
  );

  let productMap = new Map<string, ProductRow>();
  if (allProductIds.length) {
    const { data: products } = (await query.graph({
      entity: 'product',
      fields: [
        'id',
        'title',
        'handle',
        'thumbnail',
        'status',
        'variants.id',
        'variants.title',
        'variants.manage_inventory',
        'variants.options.id',
        'variants.options.value',
        'variants.options.option.id',
        'variants.options.option.title',
        'variants.calculated_price.calculated_amount',
        'variants.calculated_price.currency_code',
        'variants.inventory_items.inventory.location_levels.available_quantity',
      ],
      filters: { id: allProductIds, status: 'published' },
      context: { variants: { calculated_price: priceContext } },
    })) as { data: ProductRow[] };
    productMap = new Map(products.map((p) => [p.id, p]));
  }

  const enriched = applicable
    .map((look: Record<string, unknown>) => {
      const hotspots = ((look.products as Array<Record<string, unknown>>) ?? [])
        .slice()
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

      const products = hotspots
        .map((hs) => {
          const product = productMap.get(hs.product_id as string);
          if (!product) return null; // producto borrado / no publicado

          const variants = (product.variants ?? []).map((v) => ({
            id: v.id,
            title: v.title,
            calculated_amount: v.calculated_price?.calculated_amount ?? null,
            currency_code: v.calculated_price?.currency_code ?? region?.currency_code ?? null,
            available: stockOf(v),
            options: (v.options ?? []).map((o) => ({
              value: o.value,
              option_id: o.option?.id,
              option_title: o.option?.title,
            })),
          }));

          const configuredVariantId = (hs.variant_id as string | null) ?? null;

          // Stock: si hay variante configurada, mira esa; si no, cualquier variante con stock.
          const inStock = configuredVariantId
            ? (variants.find((v) => v.id === configuredVariantId)?.available ?? 0) > 0
            : variants.some((v) => v.available > 0);
          if (!inStock) return null; // PRD: productos sin stock se ocultan

          return {
            product_id: product.id,
            variant_id: configuredVariantId,
            pos_x: Number(hs.pos_x ?? 50),
            pos_y: Number(hs.pos_y ?? 50),
            title: product.title,
            handle: product.handle,
            thumbnail: product.thumbnail ?? null,
            variants,
          };
        })
        .filter(Boolean);

      return {
        id: look.id,
        title: look.title,
        subtitle: look.subtitle ?? null,
        cta_label: look.cta_label ?? null,
        image_url: look.image_url,
        image_alt: look.image_alt ?? null,
        placement: look.placement ?? 'after_featured',
        products,
      };
    })
    // PRD: un look sin productos válidos no se muestra.
    .filter((look) => look.products.length > 0);

  res.json({ looks: enriched });
}
