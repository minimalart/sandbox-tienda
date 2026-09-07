import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import { PDF_CATALOG_MODULE } from '../../../../modules/pdf-catalog';
import PdfCatalogModuleService from '../../../../modules/pdf-catalog/service';

/**
 * Soft dependency: el módulo de store-config vive en el host. Se resuelve por
 * string en runtime y si no está registrado se trata como "feature apagada".
 * Es la misma semántica que tenía la extensión cuando el toggle era falsy.
 */
const STORE_CONFIG_MODULE = 'store_config';
const PDF_CATALOG_ENABLED_KEY = 'pdf_catalog_enabled';

type StoreConfigLike = {
  getBooleanSetting?: (key: string, fallback: boolean) => Promise<boolean>;
};

type VariantRow = {
  id: string;
  title?: string;
  manage_inventory?: boolean;
  calculated_price?: { calculated_amount?: number; currency_code?: string } | null;
  options?: Array<{ value: string; option?: { id: string; title: string } | null }>;
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

/**
 * GET /store/pdf-catalog/active — el catálogo PDF activo para el canal actual.
 *
 * Query: `sales_channel_id` (obligatorio para resolver el activo), `region_id`
 * (para el precio de los hotspots de producto).
 * - Si el toggle global está apagado → { catalog: null }.
 * - Si el canal no tiene catálogo activo o el activo no está publicado → { catalog: null }.
 * - Enriquece hotspots de producto con precio (según región) y stock.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const salesChannelId =
    typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined;
  const regionId = typeof req.query.region_id === 'string' ? req.query.region_id : undefined;

  // Toggle global — la feature está apagada por defecto y si el módulo de
  // store-config no está instalado tampoco hay flag que preguntar.
  let storeConfig: StoreConfigLike | null = null;
  try {
    storeConfig = req.scope.resolve(STORE_CONFIG_MODULE) as StoreConfigLike;
  } catch {
    storeConfig = null;
  }
  const enabled = storeConfig?.getBooleanSetting
    ? await storeConfig.getBooleanSetting(PDF_CATALOG_ENABLED_KEY, false)
    : false;
  if (!enabled || !salesChannelId) {
    res.json({ catalog: null });
    return;
  }

  const service: PdfCatalogModuleService = req.scope.resolve(PDF_CATALOG_MODULE);

  // Fila de activación del canal → catálogo.
  const [channel] = await service.listPdfCatalogChannels({
    sales_channel_id: salesChannelId,
  });
  if (!channel) {
    res.json({ catalog: null });
    return;
  }

  const catalog = (await service.retrievePdfCatalog(channel.catalog_id, {
    relations: ['hotspots'],
  })) as Record<string, any>;

  if (!catalog || !catalog.published) {
    res.json({ catalog: null });
    return;
  }

  const hotspots = ((catalog.hotspots as Array<Record<string, any>>) ?? [])
    .slice()
    .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

  // Enriquecer productos referenciados por hotspots de tipo product.
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

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

  const productIds = Array.from(
    new Set(
      hotspots
        .filter((h) => h.type === 'product' && h.product_id)
        .map((h) => h.product_id as string)
    )
  );

  let productMap = new Map<string, ProductRow>();
  if (productIds.length) {
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
        'variants.options.value',
        'variants.options.option.id',
        'variants.options.option.title',
        'variants.calculated_price.calculated_amount',
        'variants.calculated_price.currency_code',
        'variants.inventory_items.inventory.location_levels.available_quantity',
      ],
      filters: { id: productIds, status: 'published' },
      context: { variants: { calculated_price: priceContext } },
    })) as { data: ProductRow[] };
    productMap = new Map(products.map((p) => [p.id, p]));
  }

  const enrichedHotspots = hotspots
    .map((h) => {
      const base = {
        id: h.id,
        type: h.type as 'product' | 'video' | 'text',
        page_index: Number(h.page_index ?? 0),
        pos_x: Number(h.pos_x ?? 50),
        pos_y: Number(h.pos_y ?? 50),
      };

      if (h.type === 'video' || h.type === 'text') {
        return { ...base, data: h.data ?? {} };
      }

      // product
      const product = productMap.get(h.product_id as string);
      if (!product) return null; // borrado / no publicado → se oculta

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

      const configuredVariantId = (h.variant_id as string | null) ?? null;
      const inStock = configuredVariantId
        ? (variants.find((v) => v.id === configuredVariantId)?.available ?? 0) > 0
        : variants.some((v) => v.available > 0);
      if (!inStock) return null;

      return {
        ...base,
        product: {
          product_id: product.id,
          variant_id: configuredVariantId,
          title: product.title,
          handle: product.handle,
          thumbnail: product.thumbnail ?? null,
          variants,
        },
      };
    })
    .filter(Boolean);

  res.json({
    catalog: {
      id: catalog.id,
      name: catalog.name,
      pdf_url: catalog.pdf_url,
      pages: Number(catalog.pages ?? 0),
      hotspots: enrichedHotspots,
    },
  });
}
